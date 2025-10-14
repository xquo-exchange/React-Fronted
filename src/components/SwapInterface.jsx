import React, { useState, useEffect, useRef } from "react";
import { ethers } from "ethers";
import { useWallet } from "../hooks/useWallet";
import { useCurve } from "../contexts/CurveContext";
import { useRpcProvider } from "../contexts/RpcContext";
import "./SwapInterface.css";

const TOKEN_REGISTRY = {
  ETH: { address: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", decimals: 18, symbol: "ETH" },
  USDC: { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6, symbol: "USDC" },
  USDT: { address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6, symbol: "USDT" },
  DAI: { address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", decimals: 18, symbol: "DAI" },
  rUSDY: { address: "0xaf37c1167910ebc994e266949387d2c7c326b879", decimals: 18, symbol: "rUSDY" },
  WBTC: { address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", decimals: 8, symbol: "WBTC" }
};

const CURVE_ROUTER_ADDRESS = "0xF0d4c12A5768D806021F80a262B4d39d26C58b8D";

const SwapInterface = ({ onShowToast, onSwapSuccess }) => {
  const { walletAddress: account } = useWallet();
  const { curve, curveReady, pools } = useCurve();
  const provider = useRpcProvider();
  
  const [fromToken, setFromToken] = useState("ETH");
  const [toToken, setToToken] = useState("USDC");
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [isCalculating, setIsCalculating] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [balances, setBalances] = useState({});
  const [swapRoute, setSwapRoute] = useState(null);
  const [slippage, setSlippage] = useState(1.0);
  const [customSlippage, setCustomSlippage] = useState("");
  const [ethPrice, setEthPrice] = useState(4136);
  const [hasCalculated, setHasCalculated] = useState(false);
  
  // ✅ NEW: Status tracking
  const [status, setStatus] = useState("");
  const [currentStep, setCurrentStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const [txHash, setTxHash] = useState("");
  
  const balanceFetchRef = useRef(false);

  const calculateUsdValue = (amount, token) => {
    if (!amount || parseFloat(amount) <= 0) return "0.00";
    const num = parseFloat(amount);
    if (token === "ETH") return (num * ethPrice).toFixed(2);
    if (token === "USDC" || token === "USDT" || token === "DAI" || token === "rUSDY") return num.toFixed(2);
    if (token === "WBTC") return (num * 95000).toFixed(2);
    return "0.00";
  };

  // ✅ Fetch balances ONCE - prevent double calls
  useEffect(() => {
    if (balanceFetchRef.current || !account || !provider) return;
    balanceFetchRef.current = true;
    
    const fetchBalances = async () => {
      try {
        console.log("🔄 Fetching balances for", account.slice(0, 6));
        const bals = {};
        
        // Fetch ETH balance
        const ethBal = await provider.getBalance(account);
        bals.ETH = ethers.utils.formatEther(ethBal);
        
        // Fetch token balances in parallel
        const tokenPromises = Object.entries(TOKEN_REGISTRY)
          .filter(([key]) => key !== "ETH")
          .map(async ([key, token]) => {
            try {
              const contract = new ethers.Contract(
                token.address,
                ["function balanceOf(address) view returns (uint256)"],
                provider
              );
              const bal = await contract.balanceOf(account);
              bals[key] = ethers.utils.formatUnits(bal, token.decimals);
            } catch (err) {
              console.warn(`Failed to fetch ${key} balance:`, err.message);
              bals[key] = "0";
            }
          });

        await Promise.all(tokenPromises);
        setBalances(bals);
        console.log("✅ Balances loaded:", Object.keys(bals).length, "tokens");
      } catch (error) {
        console.error("Balance fetch error:", error);
        setBalances({});
      }
    };

    fetchBalances();
  }, [account, provider]);

  const handleCalculate = async () => {
    if (!fromAmount || !curveReady || parseFloat(fromAmount) <= 0) {
      onShowToast?.("error", "Enter amount");
      return;
    }

    setIsCalculating(true);
    setSwapRoute(null);
    setToAmount("");
    setHasCalculated(false);
    setStatus("🔍 Finding best route...");

    try {
      let output = "0";
      let route = "";

      if (toToken === "rUSDY") {
        const usdcPool = pools.ethUsdc;
        const rusdyPool = pools.usdcRusdy;

        if (fromToken === "ETH") {
          setStatus("📊 Calculating ETH → USDC...");
          const usdcOut = await usdcPool.swapExpected("ETH", "USDC", fromAmount);
          
          setStatus("📊 Calculating USDC → rUSDY...");
          const rusdyOut = await rusdyPool.swapExpected("USDC", TOKEN_REGISTRY.rUSDY.address, usdcOut);
          output = rusdyOut;
          route = "ETH → USDC → rUSDY";
        } else if (fromToken === "USDC") {
          setStatus("📊 Calculating USDC → rUSDY...");
          output = await rusdyPool.swapExpected("USDC", TOKEN_REGISTRY.rUSDY.address, fromAmount);
          route = "USDC → rUSDY";
        }
      } else if (fromToken === "rUSDY") {
        const rusdyPool = pools.usdcRusdy;
        if (toToken === "USDC") {
          setStatus("📊 Calculating rUSDY → USDC...");
          output = await rusdyPool.swapExpected(TOKEN_REGISTRY.rUSDY.address, "USDC", fromAmount);
          route = "rUSDY → USDC";
        } else if (toToken === "ETH") {
          setStatus("📊 Calculating rUSDY → USDC...");
          const usdcOut = await rusdyPool.swapExpected(TOKEN_REGISTRY.rUSDY.address, "USDC", fromAmount);
          
          setStatus("📊 Calculating USDC → ETH...");
          const ethOut = await pools.ethUsdc.swapExpected("USDC", "ETH", usdcOut);
          output = ethOut;
          route = "rUSDY → USDC → ETH";
        }
      } else {
        setStatus("🔍 Searching Curve pools...");
        const result = await curve.router.getBestRouteAndOutput(
          TOKEN_REGISTRY[fromToken].address,
          TOKEN_REGISTRY[toToken].address,
          fromAmount
        );
        output = result.output || "0";
        route = result.route?.map(r => r.poolName || r.name).join(' → ') || `${fromToken} → ${toToken}`;
      }

      setToAmount(parseFloat(output).toFixed(6));
      
      const rate = parseFloat(output) / parseFloat(fromAmount);
      setSwapRoute({ 
        route, 
        exchangeRate: rate.toFixed(6),
        priceImpact: "< 0.01%",
        estimatedGas: "~0.002 ETH"
      });

      if (fromToken === "ETH" && (toToken === "USDC" || toToken === "USDT")) {
        setEthPrice(rate);
      }

      setHasCalculated(true);
      setStatus("✅ Route calculated!");
      onShowToast?.("success", "Route calculated!");
      
      setTimeout(() => setStatus(""), 2000);
    } catch (error) {
      console.error("❌ Calculation error:", error);
      setStatus("❌ Route calculation failed");
      onShowToast?.("error", "Route calculation failed");
      setTimeout(() => setStatus(""), 3000);
    } finally {
      setIsCalculating(false);
    }
  };

  const executeSwap = async () => {
    if (!account || !window.ethereum || !hasCalculated) {
      onShowToast?.("error", "Calculate route first");
      return;
    }

    setIsSwapping(true);
    setTxHash("");

    try {
      const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = web3Provider.getSigner();

      // Determine total steps
      let steps = 1; // Base swap
      if (fromToken !== "ETH") steps++; // Approval
      if ((toToken === "rUSDY" && fromToken === "ETH") || (fromToken === "rUSDY" && toToken === "ETH")) {
        steps++; // Multi-hop swap
      }
      setTotalSteps(steps);
      setCurrentStep(0);

      // ✅ APPROVAL PHASE
      if (fromToken !== "ETH") {
        setCurrentStep(1);
        setStatus(`🔐 Step 1/${steps}: Checking ${fromToken} approval...`);
        
        const tokenContract = new ethers.Contract(
          TOKEN_REGISTRY[fromToken].address,
          [
            "function allowance(address,address) view returns (uint256)",
            "function approve(address,uint256) returns (bool)"
          ],
          signer
        );

        let spender;
        if (toToken === "rUSDY" && fromToken === "USDC") {
          spender = pools.usdcRusdy.address;
        } else if (fromToken === "rUSDY") {
          spender = pools.usdcRusdy.address;
        } else {
          spender = CURVE_ROUTER_ADDRESS;
        }

        const required = ethers.utils.parseUnits(fromAmount, TOKEN_REGISTRY[fromToken].decimals);
        const allowance = await tokenContract.allowance(account, spender);

        if (allowance.lt(required)) {
          setStatus(`📝 Requesting approval for ${fromAmount} ${fromToken}...`);
          console.log(`📝 Approving ${fromAmount} ${fromToken}...`);
          
          if (fromToken === "USDT" && allowance.gt(0)) {
            setStatus("🔄 Resetting USDT allowance...");
            const resetTx = await tokenContract.approve(spender, 0);
            setStatus("⏳ Waiting for reset confirmation...");
            await resetTx.wait();
          }
          
          setStatus("📝 Approve in Wallet...");
          const approveTx = await tokenContract.approve(spender, required);
          
          setStatus("⏳ Waiting for approval confirmation...");
          const approvalReceipt = await approveTx.wait();
          
          setStatus(`✅ ${fromToken} approved! (Tx: ${approvalReceipt.transactionHash.slice(0, 10)}...)`);
          console.log("✅ Approval confirmed:", approvalReceipt.transactionHash);
        } else {
          setStatus(`✅ ${fromToken} already approved`);
          console.log("✅ Already approved");
        }
      }

      let txHash;
      let receipt;

      // ✅ FIXED: Get fresh quote right before swap
      setStatus("🔄 Getting fresh price quote...");
      let freshOutput = "0";
      
      if (toToken === "rUSDY") {
        const usdcPool = pools.ethUsdc;
        const rusdyPool = pools.usdcRusdy;

        if (fromToken === "ETH") {
          const usdcOut = await usdcPool.swapExpected("ETH", "USDC", fromAmount);
          freshOutput = await rusdyPool.swapExpected("USDC", TOKEN_REGISTRY.rUSDY.address, usdcOut);
        } else if (fromToken === "USDC") {
          freshOutput = await rusdyPool.swapExpected("USDC", TOKEN_REGISTRY.rUSDY.address, fromAmount);
        }
      } else if (fromToken === "rUSDY") {
        const rusdyPool = pools.usdcRusdy;
        if (toToken === "USDC") {
          freshOutput = await rusdyPool.swapExpected(TOKEN_REGISTRY.rUSDY.address, "USDC", fromAmount);
        } else if (toToken === "ETH") {
          const usdcOut = await rusdyPool.swapExpected(TOKEN_REGISTRY.rUSDY.address, "USDC", fromAmount);
          freshOutput = await pools.ethUsdc.swapExpected("USDC", "ETH", usdcOut);
        }
      } else {
        const result = await curve.router.getBestRouteAndOutput(
          TOKEN_REGISTRY[fromToken].address,
          TOKEN_REGISTRY[toToken].address,
          fromAmount
        );
        freshOutput = result.output || "0";
      }

      const minOutput = parseFloat(freshOutput) * (1 - slippage / 100);
      console.log(`💱 Fresh quote: ${freshOutput} ${toToken} (min: ${minOutput.toFixed(6)}, slippage: ${slippage}%)`);

      // ✅ SWAP PHASE - FIXED: Pass slippage as percentage
      if (toToken === "rUSDY") {
        const usdcPool = pools.ethUsdc;
        const rusdyPool = pools.usdcRusdy;

        if (fromToken === "ETH") {
          setCurrentStep(2);
          setStatus(`💱 Step 2/${steps}: ETH → USDC swap...`);
          setStatus("📝 Confirm swap in Wallet...");
          
          // ✅ FIXED: Pass slippage as percentage (1.0 = 1%)
          const tx1Hash = await usdcPool.swap("ETH", "USDC", fromAmount, slippage);
          const hash1 = typeof tx1Hash === 'string' ? tx1Hash : tx1Hash.hash;
          setTxHash(hash1);
          
          setStatus(`⏳ Waiting for ETH → USDC tx... (${hash1.slice(0, 10)}...)`);
          const receipt1 = await web3Provider.waitForTransaction(hash1);

          if (receipt1.status !== 1) throw new Error("First swap failed");
          setStatus(`✅ ETH → USDC complete!`);

          const usdcContract = new ethers.Contract(
            TOKEN_REGISTRY.USDC.address,
            ["function balanceOf(address) view returns (uint256)"],
            web3Provider
          );
          const usdcBal = await usdcContract.balanceOf(account);
          const usdcAmount = ethers.utils.formatUnits(usdcBal, 6);

          setCurrentStep(3);
          setStatus(`💱 Step 3/${steps}: USDC → rUSDY swap...`);
          setStatus("📝 Confirm second swap in Wallet...");
          
          // ✅ FIXED: Pass slippage as percentage
          txHash = await rusdyPool.swap("USDC", TOKEN_REGISTRY.rUSDY.address, usdcAmount, slippage);
          const hash2 = typeof txHash === 'string' ? txHash : txHash.hash;
          setTxHash(hash2);
          
          setStatus(`⏳ Waiting for USDC → rUSDY tx... (${hash2.slice(0, 10)}...)`);
          receipt = await web3Provider.waitForTransaction(hash2);
          
        } else if (fromToken === "USDC") {
          setCurrentStep(2);
          setStatus(`💱 Step 2/${steps}: USDC → rUSDY swap...`);
          setStatus("📝 Confirm swap in Wallet...");
          
          // ✅ FIXED: Pass slippage as percentage
          txHash = await rusdyPool.swap("USDC", TOKEN_REGISTRY.rUSDY.address, fromAmount, slippage);
          const hash = typeof txHash === 'string' ? txHash : txHash.hash;
          setTxHash(hash);
          
          setStatus(`⏳ Waiting for confirmation... (${hash.slice(0, 10)}...)`);
          receipt = await web3Provider.waitForTransaction(hash);
        }
      } else if (fromToken === "rUSDY") {
        const rusdyPool = pools.usdcRusdy;
        
        if (toToken === "USDC") {
          setCurrentStep(2);
          setStatus(`💱 Step 2/${steps}: rUSDY → USDC swap...`);
          setStatus("📝 Confirm swap in Wallet...");
          
          // ✅ FIXED: Pass slippage as percentage
          txHash = await rusdyPool.swap(TOKEN_REGISTRY.rUSDY.address, "USDC", fromAmount, slippage);
          const hash = typeof txHash === 'string' ? txHash : txHash.hash;
          setTxHash(hash);
          
          setStatus(`⏳ Waiting for confirmation... (${hash.slice(0, 10)}...)`);
          receipt = await web3Provider.waitForTransaction(hash);
          
        } else if (toToken === "ETH") {
          setCurrentStep(2);
          setStatus(`💱 Step 2/${steps}: rUSDY → USDC swap...`);
          setStatus("📝 Confirm first swap in Wallet...");
          
          // ✅ FIXED: Pass slippage as percentage
          const tx1Hash = await rusdyPool.swap(TOKEN_REGISTRY.rUSDY.address, "USDC", fromAmount, slippage);
          const hash1 = typeof tx1Hash === 'string' ? tx1Hash : tx1Hash.hash;
          setTxHash(hash1);
          
          setStatus(`⏳ Waiting for rUSDY → USDC tx... (${hash1.slice(0, 10)}...)`);
          const receipt1 = await web3Provider.waitForTransaction(hash1);

          if (receipt1.status !== 1) throw new Error("First swap failed");
          setStatus(`✅ rUSDY → USDC complete!`);

          const usdcContract = new ethers.Contract(
            TOKEN_REGISTRY.USDC.address,
            ["function balanceOf(address) view returns (uint256)"],
            web3Provider
          );
          const usdcBal = await usdcContract.balanceOf(account);
          const usdcAmount = ethers.utils.formatUnits(usdcBal, 6);

          setCurrentStep(3);
          setStatus(`💱 Step 3/${steps}: USDC → ETH swap...`);
          setStatus("📝 Confirm second swap in Wallet...");
          
          // ✅ FIXED: Pass slippage as percentage
          txHash = await pools.ethUsdc.swap("USDC", "ETH", usdcAmount, slippage);
          const hash2 = typeof txHash === 'string' ? txHash : txHash.hash;
          setTxHash(hash2);
          
          setStatus(`⏳ Waiting for USDC → ETH tx... (${hash2.slice(0, 10)}...)`);
          receipt = await web3Provider.waitForTransaction(hash2);
        }
      } else {
        setCurrentStep(fromToken === "ETH" ? 1 : 2);
        setStatus(`💱 Step ${currentStep}/${steps}: ${fromToken} → ${toToken} swap...`);
        setStatus("📝 Confirm swap in Wallet...");
        
        // ✅ FIXED: Pass slippage as percentage (not divided by 100)
        txHash = await curve.router.swap(
          TOKEN_REGISTRY[fromToken].address,
          TOKEN_REGISTRY[toToken].address,
          fromAmount,
          slippage  // ✅ Pass 1.0 for 1%, not 0.01
        );
        const hash = typeof txHash === 'string' ? txHash : txHash.hash;
        setTxHash(hash);
        
        setStatus(`⏳ Waiting for confirmation... (${hash.slice(0, 10)}...)`);
        receipt = await web3Provider.waitForTransaction(hash);
      }

      if (receipt && receipt.status === 1) {
        const cleanHash = typeof txHash === 'string' ? txHash : txHash.hash || txHash;
        
        setStatus("🎉 Swap successful!");
        console.log("✅ Swap successful:", cleanHash);
        onShowToast?.("success", "Swap successful!", cleanHash);
        
        if (toToken === "rUSDY" && onSwapSuccess) onSwapSuccess(toAmount);
        
        setStatus("🔄 Refreshing balances...");
        balanceFetchRef.current = false;
        const ethBal = await web3Provider.getBalance(account);
        const newBalances = { ...balances, ETH: ethers.utils.formatEther(ethBal) };
        
        for (const [key, token] of Object.entries(TOKEN_REGISTRY)) {
          if (key === "ETH" || (key !== fromToken && key !== toToken)) continue;
          
          const contract = new ethers.Contract(
            token.address,
            ["function balanceOf(address) view returns (uint256)"],
            provider
          );
          const bal = await contract.balanceOf(account);
          newBalances[key] = ethers.utils.formatUnits(bal, token.decimals);
        }
        
        setBalances(newBalances);
        setStatus("✅ Balances updated!");
        
        setTimeout(() => {
          setStatus("");
          setTxHash("");
        }, 5000);
      } else {
        throw new Error("Transaction failed");
      }

      setFromAmount("");
      setToAmount("");
      setSwapRoute(null);
      setHasCalculated(false);
      setCurrentStep(0);
      setTotalSteps(0);

    } catch (error) {
      console.error("❌ Swap error:", error);
      const msg = error.message || String(error);

      if (msg.includes("user rejected") || msg.includes("denied")) {
        setStatus("❌ Transaction cancelled");
        onShowToast?.("error", "Transaction cancelled");
      } else if (msg.includes("Slippage") || msg.includes("slippage")) {
        setStatus(`❌ Price moved - try ${slippage + 0.5}% slippage or recalculate`);
        onShowToast?.("error", `Price moved. Try ${slippage + 0.5}% slippage or recalculate route`);
      } else if (msg.includes("insufficient")) {
        setStatus("❌ Insufficient balance");
        onShowToast?.("error", "Insufficient balance");
      } else if (msg.includes("UNPREDICTABLE_GAS_LIMIT")) {
        setStatus("❌ Transaction would fail");
        onShowToast?.("error", "Transaction will fail. Check balance");
      } else {
        setStatus("❌ Swap failed");
        onShowToast?.("error", "Swap failed. Check console");
      }
      
      setTimeout(() => setStatus(""), 5000);
    } finally {
      setIsSwapping(false);
    }
  };

  const setMax = () => {
    const bal = balances[fromToken];
    
    if (!bal || parseFloat(bal) <= 0) {
      onShowToast?.("error", `No ${fromToken} balance`);
      return;
    }
    
    setFromAmount((parseFloat(bal) * 0.99).toFixed(6));
    setHasCalculated(false);
    setToAmount("");
    setSwapRoute(null);
  };

  const switchTokens = () => {
    setFromToken(toToken);
    setToToken(fromToken);
    setFromAmount("");
    setToAmount("");
    setSwapRoute(null);
    setHasCalculated(false);
  };

  return (
    <div className="swap-interface-container">
      <h1 className="swap-interface-title">Trade</h1>

      <div className="swap-token-box">
        <div className="swap-token-header">
          <span className="swap-balance-label">
            Avail. {parseFloat(balances[fromToken] || "0").toFixed(6)} {fromToken}
          </span>
          <button onClick={setMax} className="swap-max-button">MAX</button>
        </div>
        <div className="swap-token-input-row">
          <input
            type="text"
            inputMode="decimal"
            placeholder="0.0"
            value={fromAmount}
            onChange={(e) => {
              const val = e.target.value;
              if (val === "" || /^\d*\.?\d*$/.test(val)) {
                setFromAmount(val);
                setHasCalculated(false);
                setToAmount("");
                setSwapRoute(null);
              }
            }}
            className="swap-amount-input"
          />
          <div className="swap-token-select-wrapper">
            <select
              value={fromToken}
              onChange={(e) => {
                setFromToken(e.target.value);
                setFromAmount("");
                setToAmount("");
                setSwapRoute(null);
                setHasCalculated(false);
              }}
              className="swap-token-select"
            >
              {Object.keys(TOKEN_REGISTRY).map(k => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="swap-usd-value">
          ≈ ${calculateUsdValue(fromAmount, fromToken)}
        </div>
      </div>

      <div className="swap-direction-container">
        <button onClick={switchTokens} className="swap-direction-button">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="swap-direction-icon">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
        </button>
      </div>

      <div className="swap-token-box">
        <div className="swap-token-header">
          <span className="swap-balance-label">
            Avail. {parseFloat(balances[toToken] || "0").toFixed(6)} {toToken}
          </span>
        </div>
        <div className="swap-token-input-row">
          <input
            type="text"
            inputMode="decimal"
            placeholder="0.0"
            value={toAmount}
            readOnly
            className="swap-amount-input"
          />
          <div className="swap-token-select-wrapper">
            <select
              value={toToken}
              onChange={(e) => {
                setToToken(e.target.value);
                setToAmount("");
                setSwapRoute(null);
                setHasCalculated(false);
              }}
              className="swap-token-select"
            >
              {Object.keys(TOKEN_REGISTRY).map(k => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="swap-usd-value">
          ≈ ${calculateUsdValue(toAmount, toToken)}
        </div>
      </div>

      {swapRoute && (
        <div className="swap-route-info">
          <div className="swap-route-row">
            <span className="swap-route-label">Exchange rate:</span>
            <span className="swap-route-bold">{swapRoute.exchangeRate}</span>
          </div>
          <div className="swap-route-row">
            <span className="swap-route-label">Price impact:</span>
            <span className="swap-route-bold">{swapRoute.priceImpact}</span>
          </div>
          <div className="swap-route-row">
            <span className="swap-route-label">Route:</span>
            <span className="swap-route-bold">{swapRoute.route}</span>
          </div>
          <div className="swap-route-row slippage-editor-row">
            <span className="swap-route-label">Slippage:</span>
            <div className="slippage-controls">
              <div className="slippage-preset-buttons">
                {[0.5, 1.0, 2.0].map(s => (
                  <button 
                    key={s}
                    className={`slippage-preset-btn ${slippage === s ? 'active' : ''}`}
                    onClick={() => { setSlippage(s); setCustomSlippage(""); }}
                  >
                    {s}%
                  </button>
                ))}
              </div>
              <div className="slippage-custom-input">
                <input
                  type="number"
                  min="0"
                  max="50"
                  step="0.1"
                  value={customSlippage}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCustomSlippage(val);
                    if (val && !isNaN(val)) setSlippage(parseFloat(val));
                  }}
                  placeholder={slippage.toFixed(1)}
                  className="slippage-input"
                />
                <span className="slippage-percent">%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ✅ STATUS DISPLAY */}
      {status && (
        <div className="swap-status-box">
          <div className="swap-status-content">
            {isSwapping && totalSteps > 0 && (
              <div className="swap-progress">
                <div className="swap-progress-bar">
                  <div 
                    className="swap-progress-fill" 
                    style={{ width: `${(currentStep / totalSteps) * 100}%` }}
                  />
                </div>
                <span className="swap-progress-text">
                  Step {currentStep}/{totalSteps}
                </span>
              </div>
            )}
            <p className="swap-status-message">{status}</p>
            {txHash && (
              <a 
                href={`https://etherscan.io/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="swap-status-link"
              >
                View on Etherscan →
              </a>
            )}
          </div>
        </div>
      )}

      <button
        onClick={handleCalculate}
        disabled={isCalculating || !fromAmount || !curveReady || parseFloat(fromAmount) <= 0}
        className="swap-calculate-button"
      >
        {isCalculating ? "CALCULATING..." : "CALCULATE ROUTE"}
      </button>

      <button
        onClick={executeSwap}
        disabled={isSwapping || !hasCalculated || !account}
        className="swap-execute-button"
      >
        {isSwapping ? "TRADING..." : "TRADE"}
      </button>
    </div>
  );
};

export default SwapInterface;