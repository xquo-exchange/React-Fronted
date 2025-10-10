import React, { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import "./StakeBox.css";
import "../components/SwapBox.css";
import { useWallet } from "../hooks/useWallet";
import { ethers } from "ethers";
import curve from "@curvefi/api";

// Pool ID for USDC/rUSDY on Curve
const USDC_RUSDY_POOL_ID = "factory-stable-ng-161";

// Token addresses
const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const RUSDY_ADDRESS = "0xaf37c1167910ebc994e266949387d2c7c326b879";

const StakeBox = ({ onShowToast }) => {
  const { walletAddress: account, isConnected, connectWallet } = useWallet();
  const [showWarning, setShowWarning] = useState(false);
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState("");
  const [showStatus, setShowStatus] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const autoHideTimer = useRef(null);

  const [mode, setMode] = useState("stake");
  
  const [usdcBalance, setUsdcBalance] = useState("0");
  const [lpTokenBalance, setLpTokenBalance] = useState("0");

  const rpcProvider = new ethers.providers.JsonRpcProvider(
    "https://mainnet.infura.io/v3/2dd1a437f34141deb299352ba4bbd0e2"
  );

  // Helper function to parse error messages
  const parseError = (error) => {
    const errorStr = String(error).toLowerCase();
    
    // User rejected transaction
    if (errorStr.includes("user rejected") || 
        errorStr.includes("user denied") || 
        errorStr.includes("rejected") ||
        errorStr.includes("action_rejected")) {
      return "Transaction cancelled by user";
    }
    
    // Insufficient funds
    if (errorStr.includes("insufficient funds")) {
      return "Insufficient funds for transaction";
    }
    
    // Network issues
    if (errorStr.includes("network") || errorStr.includes("timeout")) {
      return "Network error. Please try again";
    }
    
    // Gas estimation failed
    if (errorStr.includes("gas")) {
      return "Gas estimation failed. Transaction may fail";
    }
    
    // Balance issues
    if (errorStr.includes("insufficient") && errorStr.includes("balance")) {
      return "Insufficient token balance";
    }
    
    // Generic error - try to extract meaningful message
    if (error.message) {
      // Extract just the first sentence or up to first colon
      const message = error.message.split(/[:\n]/)[0];
      if (message.length < 100) return message;
    }
    
    return "Transaction failed. Please try again";
  };

  // Fetch USDC balance
  useEffect(() => {
    const fetchUsdcBalance = async () => {
      if (!account) {
        setUsdcBalance("0");
        return;
      }

      try {
        const usdcContract = new ethers.Contract(
          USDC_ADDRESS,
          ["function balanceOf(address) view returns (uint256)"],
          rpcProvider
        );
        const balance = await usdcContract.balanceOf(account);
        const formatted = ethers.utils.formatUnits(balance, 6);
        setUsdcBalance(formatted);
      } catch (error) {
        console.error("Error fetching USDC balance:", error);
        setUsdcBalance("0");
      }
    };

    fetchUsdcBalance();
  }, [account]);

  // Fetch LP token balance
  useEffect(() => {
    const fetchLpBalance = async () => {
      if (!account || !isConnected) {
        setLpTokenBalance("0");
        return;
      }

      try {
        await curve.init(
          "Web3",
          { externalProvider: window.ethereum, network: "mainnet" },
          { gasPrice: 0, chainId: 1 }
        );
        await curve.stableNgFactory.fetchPools();

        const usdyPool = curve.getPool(USDC_RUSDY_POOL_ID);
        if (!usdyPool) {
          console.error("Pool not found");
          return;
        }

        const tokenBalances = await usdyPool.wallet.lpTokenBalances();
        const lpBalance = tokenBalances["lpToken"] || "0";
        setLpTokenBalance(lpBalance);
      } catch (error) {
        console.error("Error fetching LP balance:", error);
        setLpTokenBalance("0");
      }
    };

    fetchLpBalance();
  }, [account, isConnected]);

  useEffect(() => {
    if (isConnected && showWarning) setShowWarning(false);
  }, [isConnected, showWarning]);

  const closeWarning = () => {
    if (autoHideTimer.current) clearTimeout(autoHideTimer.current);
    setShowWarning(false);
  };

  const setMaxAmount = () => {
    if (mode === "stake") {
      setAmount(usdcBalance);
    } else {
      setAmount(lpTokenBalance);
    }
  };

  // Execute Deposit (USDC → LP tokens)
  const executeDeposit = async () => {
    if (!account || !window.ethereum) {
      if (onShowToast) onShowToast("error", "Please connect your wallet");
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      if (onShowToast) onShowToast("error", "Please enter a valid amount");
      return;
    }

    setIsLoading(true);
    setStatus("Initializing Curve connection...");

    try {
      await curve.init(
        "Web3",
        { externalProvider: window.ethereum, network: "mainnet" },
        { gasPrice: 0, chainId: 1 }
      );
      await curve.stableNgFactory.fetchPools();

      const usdyPool = curve.getPool(USDC_RUSDY_POOL_ID);
      if (!usdyPool) throw new Error("USDC/rUSDY pool not found");

      setStatus("Checking USDC balance...");

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const usdcContract = new ethers.Contract(
        USDC_ADDRESS,
        [
          "function balanceOf(address) view returns (uint256)",
          "function allowance(address owner, address spender) view returns (uint256)",
          "function approve(address spender, uint256 amount) returns (bool)",
        ],
        provider.getSigner()
      );

      const balance = await usdcContract.balanceOf(account);
      const requiredAmount = ethers.utils.parseUnits(amount, 6);

      if (balance.lt(requiredAmount)) {
        throw new Error(
          `Insufficient USDC balance. You have ${ethers.utils.formatUnits(
            balance,
            6
          )} but need ${amount}`
        );
      }

      setStatus("Checking USDC approval...");

      const poolAddress = usdyPool.address;
      const currentAllowance = await usdcContract.allowance(account, poolAddress);

      if (currentAllowance.lt(requiredAmount)) {
        setStatus("Requesting USDC approval...");
        const approveTx = await usdcContract.approve(poolAddress, requiredAmount);
        setStatus("Waiting for approval confirmation...");
        await approveTx.wait();
        setStatus("USDC approved successfully!");
      }

      setStatus("Executing deposit...");

      const depositTx = await usdyPool.deposit([amount, "0"], 0.1);

      setStatus("Waiting for transaction confirmation...");
      const receipt = await rpcProvider.waitForTransaction(depositTx);

      if (!receipt) throw new Error("Transaction not found");

      setStatus("Deposit completed successfully! 🎉");
      if (onShowToast)
        onShowToast("success", "Successfully deposited USDC!", depositTx);

      const newUsdcBalance = await usdcContract.balanceOf(account);
      setUsdcBalance(ethers.utils.formatUnits(newUsdcBalance, 6));

      const tokenBalances = await usdyPool.wallet.lpTokenBalances();
      setLpTokenBalance(tokenBalances["lpToken"] || "0");

      setAmount("");
      setTimeout(() => setShowStatus(false), 3000);
    } catch (error) {
      console.error("Deposit error:", error);
      const friendlyError = parseError(error);
      setStatus(friendlyError);
      if (onShowToast) onShowToast("error", friendlyError);
    } finally {
      setIsLoading(false);
    }
  };

  // Execute Withdrawal (LP tokens → USDC)
  const executeWithdrawal = async () => {
    if (!account || !window.ethereum) {
      if (onShowToast) onShowToast("error", "Please connect your wallet");
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      if (onShowToast) onShowToast("error", "Please enter a valid amount");
      return;
    }

    setIsLoading(true);
    setStatus("Initializing Curve connection...");

    try {
      await curve.init(
        "Web3",
        { externalProvider: window.ethereum, network: "mainnet" },
        { gasPrice: 0, chainId: 1 }
      );
      await curve.stableNgFactory.fetchPools();

      const usdyPool = curve.getPool(USDC_RUSDY_POOL_ID);
      if (!usdyPool) throw new Error("USDC/rUSDY pool not found");

      setStatus("Checking LP token balance...");

      const tokenBalances = await usdyPool.wallet.lpTokenBalances();
      const currentLpBalance = tokenBalances["lpToken"] || "0";

      if (parseFloat(currentLpBalance) < parseFloat(amount)) {
        throw new Error(
          `Insufficient LP token balance. You have ${currentLpBalance} but need ${amount}`
        );
      }

      setStatus("Executing withdrawal...");

      const withdrawTx = await usdyPool.withdraw(amount, 0.1);

      setStatus("Waiting for transaction confirmation...");
      const receipt = await rpcProvider.waitForTransaction(withdrawTx);

      if (!receipt) throw new Error("Transaction not found");

      setStatus("Withdrawal completed successfully! 🎉");
      if (onShowToast)
        onShowToast("success", "Successfully withdrew USDC!", withdrawTx);

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const usdcContract = new ethers.Contract(
        USDC_ADDRESS,
        ["function balanceOf(address) view returns (uint256)"],
        provider
      );
      const newUsdcBalance = await usdcContract.balanceOf(account);
      setUsdcBalance(ethers.utils.formatUnits(newUsdcBalance, 6));

      const newTokenBalances = await usdyPool.wallet.lpTokenBalances();
      setLpTokenBalance(newTokenBalances["lpToken"] || "0");

      setAmount("");
      setTimeout(() => setShowStatus(false), 3000);
    } catch (error) {
      console.error("Withdrawal error:", error);
      const friendlyError = parseError(error);
      setStatus(friendlyError);
      if (onShowToast) onShowToast("error", friendlyError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleActionClick = () => {
    if (!isConnected) {
      setShowWarning(true);
      if (autoHideTimer.current) clearTimeout(autoHideTimer.current);
      autoHideTimer.current = setTimeout(() => setShowWarning(false), 3000);
      if (onShowToast) onShowToast("error", "Connect your wallet first");
      return;
    }

    setShowStatus(true);
    if (mode === "stake") {
      executeDeposit();
    } else {
      executeWithdrawal();
    }
  };

  return (
    <>
      <div className="stake-box">
        <div className="switch-buttons">
          <div className="stake-mode-switch" style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
            <button
              className={`mode-btn ${mode === "stake" ? "active" : ""}`}
              onClick={() => {
                setMode("stake");
                setAmount("");
              }}
            >
              Deposit
            </button>
            <button
              className={`mode-btn ${mode === "unstake" ? "active" : ""}`}
              onClick={() => {
                setMode("unstake");
                setAmount("");
              }}
            >
              Withdraw
            </button>
          </div>

          <div className="balance-display">
            <span className="balance-label">
              Available:{" "}
              {mode === "stake"
                ? `${parseFloat(usdcBalance).toFixed(2)} USDC`
                : `${parseFloat(lpTokenBalance).toFixed(6)} LP`}
            </span>
            <button onClick={setMaxAmount} className="max-button-inline">
              MAX
            </button>
          </div>

          <div className="stake-input-container">
            <input
              type="text"
              inputMode="decimal"
              className="stake-box-input"
              placeholder={
                mode === "stake"
                  ? "Amount of USDC to deposit"
                  : "Amount of LP tokens to withdraw"
              }
              value={amount}
              onChange={(e) => {
                const value = e.target.value;
                if (value === "" || /^\d*\.?\d*$/.test(value)) {
                  setAmount(value);
                }
              }}
            />
          </div>

          <button
            className="stake-box-button"
            onClick={handleActionClick}
            disabled={isLoading || !amount || parseFloat(amount) <= 0}
          >
            {isLoading
              ? "Processing..."
              : mode === "stake"
              ? "Deposit"
              : "Withdraw"}
          </button>
        </div>
      </div>

      {showWarning &&
        ReactDOM.createPortal(
          <div className="swap-warning" onClick={closeWarning}>
            <div
              className="swap-warning__content"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="swap-warning__title">Wallet not connected</h3>
              <p className="swap-warning__text">
                Connect Your MetaMask Wallet to continue.
              </p>
              <div className="swap-warning__actions">
                <button className="btn-secondary" onClick={closeWarning}>
                  Close
                </button>
                <button
                  className="btn-primary"
                  onClick={() => {
                    closeWarning();
                    connectWallet();
                  }}
                >
                  Connect MetaMask
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {showStatus &&
        ReactDOM.createPortal(
          <div className="swap-warning">
            <div className="swap-warning__content status-modal">
              <h3 className="swap-warning__title">Operation Status</h3>

              {isLoading && (
                <div className="status-spinner">
                  <div className="spinner"></div>
                </div>
              )}

              <p className="swap-warning__text status-text">
                {status || "Waiting for confirmation..."}
              </p>

              {!isLoading && (
                <div className="swap-warning__actions">
                  <button
                    className="btn-primary"
                    onClick={() => setShowStatus(false)}
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

export default StakeBox;