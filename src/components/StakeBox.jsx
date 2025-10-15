import React, { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import { ethers } from "ethers";
import { useWallet } from "../hooks/useWallet";
import { useCurve } from "../contexts/CurveContext";
import { usePool } from "../contexts/PoolContext";
import { useRpcProvider } from "../contexts/RpcContext";
import "./StakeBox.css";
import { safePushToDataLayer } from "..curve/utility/gtm";

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

  // Execute Deposit (rUSDY → LP tokens) - USING CURVE.JS
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

      // Get rUSDY contract to check balance
      const rusdyContract = new ethers.Contract(
        RUSDY_ADDRESS,
        [
          "function balanceOf(address) view returns (uint256)",
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

      setStatus("Depositing rUSDY...");
      
      // ✅ USE CURVE.JS deposit() METHOD - Pass string "0" for USDC, amount string for rUSDY
      // deposit([usdc_amount, rusdy_amount], slippage)
      const depositTx = await rusdyPool.deposit([amount, 0], 0.1); // "0" rUSDY, USDC amount as string
      
      console.log("✅ Deposit tx submitted:", depositTx);
      setStatus("Waiting for confirmation...");
      
      const receipt = await provider.waitForTransaction(
        typeof depositTx === 'string' ? depositTx : depositTx.hash
      );
      
      if (!receipt || receipt.status !== 1) throw new Error("Transaction failed");

      console.log("✅ Deposit confirmed!");
      onShowToast?.("success", "Deposit successful!", typeof depositTx === 'string' ? depositTx : depositTx.hash);
      setAmount("");

      safePushToDataLayer({
        event: "stake_deposit",
        amount_usd: Number(amount),
        apy_percent:
          strategy === "conservative"
            ? CONSERVATIVE_APY
            : Number(poolStats.enhancedApy).toFixed(2),
        strategy,
        tx_hash:
          typeof depositTx === "string" ? depositTx : depositTx.hash,
      });

      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: 'stake_deposit',
        amount_usd: Number.parseFloat(amount), // your UI treats amount as USD-ish here
        apy_percent: strategy === 'conservative' ? CONSERVATIVE_APY : Number(poolStats.enhancedApy).toFixed(2),
        strategy,
        tx_hash: typeof depositTx === 'string' ? depositTx : depositTx.hash
      });

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

  // Execute Withdrawal (LP tokens → rUSDY) - USING CURVE.JS
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
      
      // ✅ USE CURVE.JS withdraw() METHOD
      // withdraw(lpTokenAmount, slippage) - automatically withdraws to all coins proportionally
      const RUSDY_INDEX = 0; // usually 0 = rUSDY, 1 = USDC — confirm via pool.coins
      const withdrawTx = await rusdyPool.withdrawOneCoin(amount, RUSDY_INDEX, 0.1);

            
      console.log("✅ Withdrawal tx:", withdrawTx);
      setStatus("Waiting for confirmation...");
      
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const receipt = await provider.waitForTransaction(
        typeof withdrawTx === 'string' ? withdrawTx : withdrawTx.hash
      );
      
      if (!receipt || receipt.status !== 1) throw new Error("Transaction failed");

      onShowToast?.("success", "Withdrawal successful!", typeof withdrawTx === 'string' ? withdrawTx : withdrawTx.hash);
      setAmount("");

      safePushToDataLayer({
        event: "stake_withdraw",
        amount_usd: Number(amount),
        apy_percent:
          strategy === "conservative"
            ? CONSERVATIVE_APY
            : Number(poolStats.enhancedApy).toFixed(2),
        strategy,
        tx_hash:
          typeof withdrawTx === "string" ? withdrawTx : withdrawTx.hash,
      });

      
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
    // ✅ PUSH TO DATALAYER ON CLICK (before any validation)
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: mode === "stake" ? "stake_deposit_click" : "stake_withdraw_click",
      amount_usd: parseFloat(amount) || 0,
      strategy: mode === "stake" ? strategy : "n/a",
      mode,
      apy_percent: mode === "stake" 
        ? (strategy === "conservative" ? CONSERVATIVE_APY : Number(poolStats.enhancedApy).toFixed(2))
        : "n/a"
    });

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
          <div className="status-overlay">
            <div className="status-modal-positioned">
              <h3 className="status-modal-title">Operation Status</h3>
              {isLoading && (
                <div className="status-spinner">
                  <div className="spinner"></div>
                </div>
              )}
              <p className="status-modal-text">
                {status || "Waiting..."}
              </p>
              {!isLoading && (
                <button className="status-close-btn" onClick={() => setShowStatus(false)}>
                  Close
                </button>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

export default StakeBox;