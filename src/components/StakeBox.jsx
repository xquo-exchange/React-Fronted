import React, { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import { ethers } from "ethers";
import { useWallet } from "../hooks/useWallet";
import { useCurve } from "../contexts/CurveContext";
import { usePool } from "../contexts/PoolContext";
import { useRpcProvider } from "../contexts/RpcContext";
import "./StakeBox.css";

const RUSDY_ADDRESS = "0xaf37c1167910ebc994e266949387d2c7c326b879";

const StakeBox = ({ onShowToast, prefillAmount, onPrefillUsed }) => {
  const { walletAddress: account, isConnected, connectWallet } = useWallet();
  const { curve, curveReady, pools } = useCurve();
  const { poolData } = usePool();
  const rpcProvider = useRpcProvider();
  
  const [showWarning, setShowWarning] = useState(false);
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState("");
  const [showStatus, setShowStatus] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const autoHideTimer = useRef(null);

  const [mode, setMode] = useState("stake");
  const [strategy, setStrategy] = useState("enhanced");
  
  const [rusdyBalance, setRusdyBalance] = useState("0");
  const [lpTokenBalance, setLpTokenBalance] = useState("0");
  
  const BASE_APY = 4;
  const CONSERVATIVE_APY = 5;
  const EARLY_WITHDRAWAL_FEE = 0.5;

  const getEnhancedAPY = () => {
    const weeklyVapy = parseFloat(poolData?.vapy?.weekly || "0");
    if (weeklyVapy <= 0) return BASE_APY;
    return BASE_APY + weeklyVapy;
  };

  const poolStats = {
    totalLiquidity: poolData?.stats?.usdTotal || "0",
    baseApy: BASE_APY,
    weeklyVapy: parseFloat(poolData?.vapy?.weekly || "0"),
    enhancedApy: getEnhancedAPY(),
    userPositionUSD: "0"
  };

  useEffect(() => {
    if (poolData?.vapy) {
      console.log("📊 APY Data:", {
        base: BASE_APY,
        weeklyVapy: poolData.vapy.weekly,
        enhanced: getEnhancedAPY()
      });
    }
  }, [poolData]);

  useEffect(() => {
    let mounted = true;
    
    const fetchBalances = async () => {
      if (!account || !rpcProvider || !curveReady) {
        setRusdyBalance("0");
        setLpTokenBalance("0");
        return;
      }

      try {
        console.log("🔄 Fetching StakeBox balances...");
        
        const rusdyContract = new ethers.Contract(
          RUSDY_ADDRESS,
          ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"],
          rpcProvider
        );
        
        const [rusdyBal, rusdyDecimals] = await Promise.all([
          rusdyContract.balanceOf(account),
          rusdyContract.decimals()
        ]);
        
        if (!mounted) return;
        const formattedRusdy = ethers.utils.formatUnits(rusdyBal, rusdyDecimals);
        setRusdyBalance(formattedRusdy);
        
        const rusdyPool = pools.usdcRusdy;
        if (!rusdyPool) return;

        const lpTokenAddress = rusdyPool.lpToken || rusdyPool.address;
        const lpContract = new ethers.Contract(
          lpTokenAddress,
          ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"],
          rpcProvider
        );

        const [lpBal, lpDecimals] = await Promise.all([
          lpContract.balanceOf(account),
          lpContract.decimals()
        ]);
        
        if (!mounted) return;
        setLpTokenBalance(ethers.utils.formatUnits(lpBal, lpDecimals));
        
        console.log("✅ StakeBox balances - rUSDY:", formattedRusdy, "LP:", ethers.utils.formatUnits(lpBal, lpDecimals));
      } catch (error) {
        console.error("StakeBox balance fetch error:", error);
        if (!mounted) return;
        setRusdyBalance("0");
        setLpTokenBalance("0");
      }
    };

    fetchBalances();
    
    return () => { mounted = false; };
  }, [account, rpcProvider, curveReady, pools.usdcRusdy]);

  useEffect(() => {
    if (isConnected && showWarning) setShowWarning(false);
  }, [isConnected, showWarning]);

  useEffect(() => {
    if (prefillAmount && prefillAmount !== '') {
      setAmount(prefillAmount);
      setMode('stake');
      if (onPrefillUsed) onPrefillUsed();
    }
  }, [prefillAmount, onPrefillUsed]);

  const closeWarning = () => {
    if (autoHideTimer.current) clearTimeout(autoHideTimer.current);
    setShowWarning(false);
  };
  
  const calculateYield = () => {
    if (!amount || parseFloat(amount) <= 0) return { daily: 0, monthly: 0, yearly: 0 };
    
    const principal = parseFloat(amount);
    const apy = strategy === "conservative" ? CONSERVATIVE_APY : poolStats.enhancedApy;
    
    const yearly = principal * (apy / 100);
    const monthly = yearly / 12;
    const daily = yearly / 365;
    
    return {
      daily: daily.toFixed(2),
      monthly: monthly.toFixed(2),
      yearly: yearly.toFixed(2)
    };
  };
  
  const calculateUnstakeSummary = () => {
    if (!amount || parseFloat(amount) <= 0) return { usdc: 0, fee: 0, net: 0 };
    
    const lpAmount = parseFloat(amount);
    const lpPrice = 1;
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
    const bal = mode === "stake" ? rusdyBalance : lpTokenBalance;
    
    if (!bal || parseFloat(bal) <= 0) {
      onShowToast?.("error", `No ${mode === "stake" ? "rUSDY" : "LP"} balance`);
      return;
    }
    
    setAmount(bal);
  };

  // Execute Deposit (rUSDY → LP tokens) - DIRECT CONTRACT CALL
  const executeDeposit = async () => {
    if (!account || !window.ethereum || !curveReady) {
      onShowToast?.("error", "System not ready");
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      onShowToast?.("error", "Enter amount");
      return;
    }

    setIsLoading(true);
    setStatus("Preparing deposit...");

    try {
      const rusdyPool = pools.usdcRusdy;
      if (!rusdyPool) throw new Error("Pool not loaded");

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();

      // Get rUSDY contract
      const rusdyContract = new ethers.Contract(
        RUSDY_ADDRESS,
        [
          "function balanceOf(address) view returns (uint256)",
          "function allowance(address owner, address spender) view returns (uint256)",
          "function approve(address spender, uint256 amount) returns (bool)",
          "function decimals() view returns (uint8)"
        ],
        signer
      );

      const decimals = await rusdyContract.decimals();
      const balance = await rusdyContract.balanceOf(account);
      const requiredAmount = ethers.utils.parseUnits(amount, decimals);

      if (balance.lt(requiredAmount)) {
        const actualBalance = ethers.utils.formatUnits(balance, decimals);
        onShowToast?.("error", `Need ${amount} rUSDY. You have: ${actualBalance} rUSDY. Swap USDC for rUSDY first!`);
        setIsLoading(false);
        return;
      }

      setStatus("Checking approval...");
      const poolAddress = rusdyPool.address;
      const allowance = await rusdyContract.allowance(account, poolAddress);

      if (allowance.lt(requiredAmount)) {
        setStatus("Approving rUSDY...");
        const approveTx = await rusdyContract.approve(poolAddress, ethers.constants.MaxUint256);
        await approveTx.wait();
      }

      setStatus("Depositing rUSDY...");
      
      // ✅ DIRECT CONTRACT INTERACTION - Bypass Curve.js validation
      const poolContract = new ethers.Contract(
        poolAddress,
        [
          "function add_liquidity(uint256[2] amounts, uint256 min_mint_amount) returns (uint256)"
        ],
        signer
      );

      // Call add_liquidity directly with [0, rUSDY_amount]
      const tx = await poolContract.add_liquidity(
        [0, requiredAmount],  // [USDC amount, rUSDY amount] in wei
        0,                    // min LP tokens (0 for simplicity, adjust for slippage)
        { gasLimit: 500000 }
      );
      
      console.log("✅ Deposit tx submitted:", tx.hash);
      setStatus("Waiting for confirmation...");
      
      const receipt = await tx.wait();
      
      if (receipt.status !== 1) throw new Error("Transaction failed");

      console.log("✅ Deposit confirmed!");
      onShowToast?.("success", "Deposit successful!", tx.hash);
      setAmount("");
      
      // Refresh balances
      const newBal = await rusdyContract.balanceOf(account);
      setRusdyBalance(ethers.utils.formatUnits(newBal, decimals));
      
      const lpTokenAddress = rusdyPool.lpToken || rusdyPool.address;
      const lpContract = new ethers.Contract(
        lpTokenAddress,
        ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"],
        rpcProvider
      );
      const [lpBal, lpDecimals] = await Promise.all([
        lpContract.balanceOf(account),
        lpContract.decimals()
      ]);
      setLpTokenBalance(ethers.utils.formatUnits(lpBal, lpDecimals));

    } catch (error) {
      console.error("❌ Deposit error:", error);
      const msg = error.message || String(error);
      
      if (msg.includes("user rejected") || msg.includes("denied")) {
        onShowToast?.("error", "Transaction cancelled");
      } else if (msg.includes("insufficient funds")) {
        onShowToast?.("error", "Insufficient ETH for gas");
      } else {
        onShowToast?.("error", `Deposit failed: ${msg.slice(0, 60)}...`);
      }
    } finally {
      setIsLoading(false);
      setShowStatus(false);
    }
  };

  // Execute Withdrawal (LP tokens → rUSDY)
  const executeWithdrawal = async () => {
    if (!account || !window.ethereum || !curveReady) {
      onShowToast?.("error", "System not ready");
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      onShowToast?.("error", "Enter amount");
      return;
    }

    setIsLoading(true);
    setStatus("Preparing withdrawal...");

    try {
      const rusdyPool = pools.usdcRusdy;
      if (!rusdyPool) throw new Error("Pool not loaded");

      setStatus("Withdrawing...");
      
      // Withdraw to rUSDY (index 1 in the pool)
      const txHash = await rusdyPool.withdraw(
        amount,  // LP token amount
        1,       // coin index (1 = rUSDY)
        2.0      // 2% slippage
      );
      
      console.log("✅ Withdrawal tx:", txHash);
      
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const receipt = await provider.waitForTransaction(
        typeof txHash === 'string' ? txHash : txHash.hash
      );
      
      if (receipt.status !== 1) throw new Error("Transaction failed");

      onShowToast?.("success", "Withdrawal successful!", typeof txHash === 'string' ? txHash : txHash.hash);
      setAmount("");
      
      // Refresh rUSDY balance
      const rusdyContract = new ethers.Contract(
        RUSDY_ADDRESS,
        ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"],
        rpcProvider
      );
      const [newBal, decimals] = await Promise.all([
        rusdyContract.balanceOf(account),
        rusdyContract.decimals()
      ]);
      setRusdyBalance(ethers.utils.formatUnits(newBal, decimals));
      
      // Refresh LP balance
      const lpTokenAddress = rusdyPool.lpToken || rusdyPool.address;
      const lpContract = new ethers.Contract(
        lpTokenAddress,
        ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"],
        rpcProvider
      );
      const [lpBal, lpDecimals] = await Promise.all([
        lpContract.balanceOf(account),
        lpContract.decimals()
      ]);
      setLpTokenBalance(ethers.utils.formatUnits(lpBal, lpDecimals));

    } catch (error) {
      console.error("❌ Withdrawal error:", error);
      const msg = error.message || String(error);
      
      if (msg.includes("user rejected") || msg.includes("denied")) {
        onShowToast?.("error", "Transaction cancelled");
      } else if (msg.includes("fewer coins")) {
        onShowToast?.("error", "Pool imbalanced. Try smaller amount");
      } else if (msg.includes("slippage")) {
        onShowToast?.("error", "Price moved too much");
      } else if (msg.includes("insufficient")) {
        onShowToast?.("error", "Insufficient LP tokens");
      } else {
        onShowToast?.("error", "Withdrawal failed. Check console");
      }
    } finally {
      setIsLoading(false);
      setShowStatus(false);
    }
  };

  const handleActionClick = () => {
    if (!isConnected) {
      setShowWarning(true);
      return;
    }

    if (!curveReady) {
      onShowToast?.("error", "Loading pools...");
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
        <div className="pool-detail-card">
          <h3 className="pool-title">rUSDY/USDC Liquidity Pool</h3>
          
          {!curveReady ? (
            <div className="pool-loading-state">
              <div className="status-spinner">
                <div className="spinner"></div>
              </div>
              <p className="pool-loading-text">Loading pool data...</p>
            </div>
          ) : (
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
                <span className="pool-stat-value apy-highlight">{poolStats.baseApy.toFixed(2)}%</span>
              </div>
            </div>
          )}
        </div>

        <div className="stake-mode-switch">
          <button
            className={`stake-mode-btn ${mode === "stake" ? "active" : ""}`}
            onClick={() => { setMode("stake"); setAmount(""); }}
          >
            Deposit
          </button>
          <button
            className={`stake-mode-btn ${mode === "unstake" ? "active" : ""}`}
            onClick={() => { setMode("unstake"); setAmount(""); }}
          >
            Withdraw
          </button>
        </div>

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
                  <span className="strategy-apy">+{(poolStats.enhancedApy - poolStats.baseApy).toFixed(2)}% APY</span>
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
                  <span className="strategy-apy">+{(CONSERVATIVE_APY - BASE_APY).toFixed(2)}% APY</span>
                </div>
                <p className="strategy-desc">Lower risk, stable returns</p>
              </button>
            </div>
          </div>
        )}

        <div className="stake-token-box">
          <div className="stake-token-header">
            <span className="stake-balance-label">
              Avail. {mode === "stake"
                ? parseFloat(rusdyBalance).toFixed(2)
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
              Based on {strategy === "conservative" ? CONSERVATIVE_APY : poolStats.enhancedApy.toFixed(2)}% APY
            </p>
          </div>
        )}

        {mode === "unstake" && amount && parseFloat(amount) > 0 && (
          <div className="unstake-summary">
            <h4 className="unstake-title">Withdrawal Summary</h4>
            <div className="unstake-rows">
              <div className="unstake-row">
                <span className="unstake-label">LP Tokens</span>
                <span className="unstake-value">{amount}</span>
              </div>
              <div className="unstake-row">
                <span className="unstake-label">rUSDY (est.)</span>
                <span className="unstake-value">${unstakeSummary.usdc}</span>
              </div>
              <div className="unstake-row warning">
                <span className="unstake-label">Fee ({EARLY_WITHDRAWAL_FEE}%)</span>
                <span className="unstake-value">-${unstakeSummary.fee}</span>
              </div>
              <div className="unstake-row total">
                <span className="unstake-label">Net Amount</span>
                <span className="unstake-value">${unstakeSummary.net}</span>
              </div>
            </div>
          </div>
        )}

        <button
          className="stake-action-button"
          onClick={handleActionClick}
          disabled={isLoading || !amount || parseFloat(amount) <= 0 || !curveReady}
        >
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
            <div className="swap-warning__content" onClick={(e) => e.stopPropagation()}>
              <h3 className="swap-warning__title">Wallet not connected</h3>
              <p className="swap-warning__text">Connect MetaMask to continue.</p>
              <div className="swap-warning__actions">
                <button className="btn-secondary" onClick={closeWarning}>Close</button>
                <button className="btn-primary" onClick={() => { closeWarning(); connectWallet(); }}>
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
                {status || "Waiting..."}
              </p>
              {!isLoading && (
                <div className="swap-warning__actions">
                  <button className="btn-primary" onClick={() => setShowStatus(false)}>Close</button>
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