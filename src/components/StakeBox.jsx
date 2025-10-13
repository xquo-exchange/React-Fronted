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

const StakeBox = ({ onShowToast, prefillAmount, onPrefillUsed }) => {
  const { walletAddress: account, isConnected, connectWallet } = useWallet();
  const [showWarning, setShowWarning] = useState(false);
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState("");
  const [showStatus, setShowStatus] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const autoHideTimer = useRef(null);

  const [mode, setMode] = useState("stake");
  const [strategy, setStrategy] = useState("enhanced"); // New: Strategy selection
  
  const [usdcBalance, setUsdcBalance] = useState("0");
  const [lpTokenBalance, setLpTokenBalance] = useState("0");
  
  // Pool stats
  const [poolStats, setPoolStats] = useState({
    totalLiquidity: "0",
    apy: "0",
    userPositionUSD: "0"
  });

  const rpcProvider = new ethers.providers.JsonRpcProvider(
    "https://mainnet.infura.io/v3/2dd1a437f34141deb299352ba4bbd0e2"
  );
  
  // APY rates for strategies
  const CONSERVATIVE_APY = 8.5; // 8.5%
  const ENHANCED_APY = 12.5; // 12.5%
  const EARLY_WITHDRAWAL_FEE = 0.5; // 0.5%

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
        
        // Fetch pool stats
        try {
          const tvl = await usdyPool.stats.totalLiquidity();
          
          // Get virtual price of LP token (how much 1 LP token is worth in pool's base currency)
          let lpTokenPrice = 1; // Default fallback
          try {
            const virtualPrice = await usdyPool.stats.virtualPrice();
            lpTokenPrice = parseFloat(virtualPrice) || 1;
          } catch (e) {
            console.log("Could not fetch virtual price, using 1:1 ratio");
          }
          
          const userPositionUSD = parseFloat(lpBalance) * lpTokenPrice;
          
          setPoolStats({
            totalLiquidity: tvl || "0",
            apy: strategy === "conservative" ? CONSERVATIVE_APY.toString() : ENHANCED_APY.toString(),
            userPositionUSD: userPositionUSD.toFixed(2),
            lpTokenPrice: lpTokenPrice.toFixed(4) // Store LP token price
          });
        } catch (error) {
          console.error("Error fetching pool stats:", error);
        }
      } catch (error) {
        console.error("Error fetching LP balance:", error);
        setLpTokenBalance("0");
      }
    };

    fetchLpBalance();
  }, [account, isConnected, strategy, usdcBalance]);

  useEffect(() => {
    if (isConnected && showWarning) setShowWarning(false);
  }, [isConnected, showWarning]);

  // Handle prefill from swap success
  useEffect(() => {
    if (prefillAmount && prefillAmount !== '') {
      setAmount(prefillAmount);
      setMode('stake'); // Switch to stake mode
      if (onPrefillUsed) {
        onPrefillUsed(); // Clear the prefill so it doesn't happen again
      }
    }
  }, [prefillAmount, onPrefillUsed]);

  const closeWarning = () => {
    if (autoHideTimer.current) clearTimeout(autoHideTimer.current);
    setShowWarning(false);
  };
  
  // Calculate projected yields
  const calculateYield = () => {
    if (!amount || parseFloat(amount) <= 0) return { daily: 0, monthly: 0, yearly: 0 };
    
    const principal = parseFloat(amount);
    const apy = strategy === "conservative" ? CONSERVATIVE_APY : ENHANCED_APY;
    
    const yearly = principal * (apy / 100);
    const monthly = yearly / 12;
    const daily = yearly / 365;
    
    return {
      daily: daily.toFixed(2),
      monthly: monthly.toFixed(2),
      yearly: yearly.toFixed(2)
    };
  };
  
  // Calculate unstake summary
  const calculateUnstakeSummary = () => {
    if (!amount || parseFloat(amount) <= 0) return { usdc: 0, fee: 0, net: 0 };
    
    const lpAmount = parseFloat(amount);
    const lpPrice = parseFloat(poolStats.lpTokenPrice) || 1; // Use stored LP token price
    const estimatedUSDC = lpAmount * lpPrice;
    const fee = estimatedUSDC * (EARLY_WITHDRAWAL_FEE / 100);
    const netAmount = estimatedUSDC - fee;
    
    return {
      usdc: estimatedUSDC.toFixed(2),
      fee: fee.toFixed(2),
      net: netAmount.toFixed(2)
    };
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

      setStatus("Checking rUSDY balance...");

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
          `Insufficient rUSDY balance. You have ${ethers.utils.formatUnits(
            balance,
            6
          )} but need ${amount}`
        );
      }

      setStatus("Checking rUSDY approval...");

      const poolAddress = usdyPool.address;
      const currentAllowance = await usdcContract.allowance(account, poolAddress);

      if (currentAllowance.lt(requiredAmount)) {
        setStatus("Requesting rUSDY approval...");
        const approveTx = await usdcContract.approve(poolAddress, requiredAmount);
        setStatus("Waiting for approval confirmation...");
        await approveTx.wait();
        setStatus("rUSDY approved successfully!");
      }

      setStatus("Executing deposit...");

      const depositTx = await usdyPool.deposit([amount, "0"], 0.1);

      setStatus("Waiting for transaction confirmation...");
      const receipt = await rpcProvider.waitForTransaction(depositTx);

      if (!receipt) throw new Error("Transaction not found");

      setStatus("Deposit completed successfully! 🎉");
      if (onShowToast)
        onShowToast("success", "Successfully deposited rUSDY!", depositTx);

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

      const withdrawTx = await usdyPool.withdrawImbalance([amount, 0], 0.1);

      setStatus("Waiting for transaction confirmation...");
      const receipt = await rpcProvider.waitForTransaction(withdrawTx);

      if (!receipt) throw new Error("Transaction not found");

      setStatus("Withdrawal completed successfully! 🎉");
      if (onShowToast)
        onShowToast("success", "Successfully withdrew rUSDY!", withdrawTx);

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

  const yieldProjection = calculateYield();
  const unstakeSummary = calculateUnstakeSummary();

  return (
    <>
      <div className="stake-container">
        {/* Pool Detail Card */}
        <div className="pool-detail-card">
          <h3 className="pool-title">rUSDY/USDC Liquidity Pool</h3>
          <div className="pool-stats-grid">
            <div className="pool-stat">
              <span className="pool-stat-label">Total Liquidity</span>
              <span className="pool-stat-value">${parseFloat(poolStats.totalLiquidity).toLocaleString()}</span>
            </div>
            <div className="pool-stat">
              <span className="pool-stat-label">Your Position</span>
              <span className="pool-stat-value">${poolStats.userPositionUSD}</span>
            </div>
            <div className="pool-stat">
              <span className="pool-stat-label">Base APY</span>
              <span className="pool-stat-value apy-highlight">{poolStats.apy}%</span>
            </div>
          </div>
        </div>

        {/* Mode Switch Buttons */}
        <div className="stake-mode-switch">
          <button
            className={`stake-mode-btn ${mode === "stake" ? "active" : ""}`}
            onClick={() => {
              setMode("stake");
              setAmount("");
            }}
          >
            Deposit
          </button>
          <button
            className={`stake-mode-btn ${mode === "unstake" ? "active" : ""}`}
            onClick={() => {
              setMode("unstake");
              setAmount("");
            }}
          >
            Withdraw
          </button>
        </div>

        {/* Strategy Selection (only in stake mode) */}
        {mode === "stake" && (
          <div className="strategy-selection">
            <h4 className="strategy-title">Select Strategy</h4>
            <div className="strategy-buttons">
              
              <button
                className={`strategy-btn ${strategy === "enhanced" ? "active" : ""}`}
                onClick={() => setStrategy("enhanced")}
                
              >
                <div className="strategy-header">
                  <span className="strategy-name">Enhanced</span>
                  <span className="strategy-apy">{ENHANCED_APY}% APY</span>
                </div>
                <p className="strategy-desc">Higher yields, managed risk</p>
              </button>

              <button
                className={`strategy-btn ${strategy === "conservative" ? "active" : ""}`}
                onClick={() => setStrategy("conservative")}
                disabled
              >
                <div className="strategy-header">
                  <span className="strategy-name">Conservative</span>
                  <span className="strategy-apy">{CONSERVATIVE_APY}% APY</span>
                </div>
                <p className="strategy-desc">Lower risk, stable returns</p>
              </button>

            </div>
          </div>
        )}

        {/* Input Box */}
        <div className="stake-token-box">
          <div className="stake-token-header">
            <span className="stake-balance-label">
              Avail. {mode === "stake"
                ? parseFloat(usdcBalance).toFixed(2)
                : parseFloat(lpTokenBalance).toFixed(6)}{" "}
              {mode === "stake" ? "rUSDY" : "LP"}
            </span>
            <button onClick={setMaxAmount} className="stake-max-button">
              MAX
            </button>
          </div>

          <div className="stake-input-row">
            <input
              type="text"
              inputMode="decimal"
              className="stake-amount-input"
              placeholder="0.0"
              value={amount}
              onChange={(e) => {
                const value = e.target.value;
                if (value === "" || /^\d*\.?\d*$/.test(value)) {
                  setAmount(value);
                }
              }}
            />
          </div>

          <div className="stake-usd-value">
            {amount && parseFloat(amount) > 0
              ? `≈ $${parseFloat(amount).toFixed(2)}`
              : "≈ $0.00"}
          </div>
        </div>

        {/* Yield Projection (stake mode) or Unstake Summary (unstake mode) */}
        {mode === "stake" && amount && parseFloat(amount) > 0 && (
          <div className="yield-projection">
            <h4 className="yield-title">Projected Earnings</h4>
            <div className="yield-grid">
              <div className="yield-item">
                <span className="yield-period">Daily</span>
                <span className="yield-amount">${yieldProjection.daily}</span>
              </div>
              <div className="yield-item">
                <span className="yield-period">Monthly</span>
                <span className="yield-amount">${yieldProjection.monthly}</span>
              </div>
              <div className="yield-item">
                <span className="yield-period">Yearly</span>
                <span className="yield-amount highlight">${yieldProjection.yearly}</span>
              </div>
            </div>
            <p className="yield-note">
              Based on {strategy === "conservative" ? CONSERVATIVE_APY : ENHANCED_APY}% APY • Rates may vary
            </p>
          </div>
        )}

        {mode === "unstake" && amount && parseFloat(amount) > 0 && (
          <div className="unstake-summary">
            <h4 className="unstake-title">Withdrawal Summary</h4>
            <div className="unstake-rows">
              <div className="unstake-row">
                <span className="unstake-label">LP Tokens to Remove</span>
                <span className="unstake-value">{amount}</span>
              </div>
              <div className="unstake-row">
                <span className="unstake-label">USDC to Receive (est.)</span>
                <span className="unstake-value">${unstakeSummary.usdc}</span>
              </div>
              <div className="unstake-row warning">
                <span className="unstake-label">Early Withdrawal Fee ({EARLY_WITHDRAWAL_FEE}%)</span>
                <span className="unstake-value">-${unstakeSummary.fee}</span>
              </div>
              <div className="unstake-row total">
                <span className="unstake-label">Net Amount</span>
                <span className="unstake-value">${unstakeSummary.net}</span>
              </div>
            </div>
          </div>
        )}

        {/* Action Button */}
        <button
          className="stake-action-button"
          onClick={handleActionClick}
          disabled={isLoading || !amount || parseFloat(amount) <= 0}
        >
          <div className="stake-step-indicator">1</div>
          <span className="stake-button-text">
            {isLoading
              ? "PROCESSING..."
              : mode === "stake"
              ? "DEPOSIT"
              : "WITHDRAW"}
          </span>
        </button>
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