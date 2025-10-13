import React, { useState, useEffect } from "react";
import { useWallet } from "../hooks/useWallet";
import { ethers } from "ethers";
import curve from "@curvefi/api";
import "./SwapInterface.css";

const ETH_USDC_POOL_ID = "factory-tricrypto-3";
const USDC_RUSDY_POOL_ID = "factory-stable-ng-161";

const TOKEN_REGISTRY = {
  ETH: { address: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", decimals: 18, symbol: "ETH" },
  WETH: { address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", decimals: 18, symbol: "WETH" },
  USDC: { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6, symbol: "USDC" },
  USDT: { address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6, symbol: "USDT" },
  DAI: { address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", decimals: 18, symbol: "DAI" },
  rUSDY: { address: "0xaf37c1167910ebc994e266949387d2c7c326b879", decimals: 18, symbol: "rUSDY" },
  WBTC: { address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", decimals: 8, symbol: "WBTC" }
};

const CURVE_ROUTER_ADDRESS = "0xF0d4c12A5768D806021F80a262B4d39d26C58b8D";

const SwapInterface = ({ onShowToast, onSwapSuccess }) => {
  const { walletAddress: account } = useWallet();
  const [fromToken, setFromToken] = useState("ETH");
  const [toToken, setToToken] = useState("USDC");
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [balances, setBalances] = useState({});
  const [swapRoute, setSwapRoute] = useState(null);
  const [slippage, setSlippage] = useState(1.0);
  const [customSlippage, setCustomSlippage] = useState("");
  const [curveReady, setCurveReady] = useState(false);
  const [ethPrice, setEthPrice] = useState(4136);

  const provider = new ethers.providers.JsonRpcProvider(
    "https://mainnet.infura.io/v3/2dd1a437f34141deb299352ba4bbd0e2"
  );

  // Helper to calculate USD value
  const calculateUsdValue = (amount, token) => {
    if (!amount || parseFloat(amount) <= 0) return "0.00";
    const num = parseFloat(amount);
    if (token === "ETH" || token === "WETH") return (num * ethPrice).toFixed(2);
    if (token === "USDC" || token === "USDT" || token === "DAI" || token === "rUSDY") return num.toFixed(2);
    if (token === "WBTC") return (num * 95000).toFixed(2);
    return "0.00";
  };

  // Initialize Curve
  useEffect(() => {
    const init = async () => {
      if (!curveReady && window.ethereum) {
        try {
          console.log("🔄 Initializing Curve...");
          await curve.init("Web3", { externalProvider: window.ethereum }, { gasPrice: 0 });
          await Promise.all([
            curve.factory.fetchPools(),
            curve.tricryptoFactory.fetchPools(),
            curve.stableNgFactory.fetchPools()
          ]);
          setCurveReady(true);
          console.log("✅ Curve ready");
        } catch (e) {
          console.error("Curve init error:", e);
        }
      }
    };
    init();
  }, [curveReady]);

  // Fetch all balances
  useEffect(() => {
    const fetchBalances = async () => {
      if (!account) return;
      const bals = {};
      try {
        console.log("🔄 Fetching balances for:", account);
        for (const [key, token] of Object.entries(TOKEN_REGISTRY)) {
          if (key === "ETH") {
            const bal = await provider.getBalance(account);
            bals[key] = ethers.utils.formatEther(bal);
          } else {
            const contract = new ethers.Contract(
              token.address,
              ["function balanceOf(address) view returns (uint256)"],
              provider
            );
            const bal = await contract.balanceOf(account);
            bals[key] = ethers.utils.formatUnits(bal, token.decimals);
          }
          console.log(`✅ ${key} balance:`, bals[key]);
        }
        setBalances(bals);
      } catch (e) {
        console.error("Balance fetch error:", e);
      }
    };
    fetchBalances();
  }, [account]);

  // Auto-calculate output
  useEffect(() => {
    const calc = async () => {
      if (!fromAmount || !curveReady || parseFloat(fromAmount) <= 0) {
        setToAmount("");
        setSwapRoute(null);
        return;
      }

      try {
        let output = "0";
        let route = "";

        if (toToken === "rUSDY") {
          const usdcPool = curve.getPool(ETH_USDC_POOL_ID);
          const rusdyPool = curve.getPool(USDC_RUSDY_POOL_ID);

          if (fromToken === "ETH") {
            const usdcOut = await usdcPool.swapExpected("ETH", "USDC", fromAmount);
            const rusdyOut = await rusdyPool.swapExpected("USDC", TOKEN_REGISTRY.rUSDY.address, usdcOut);
            output = rusdyOut;
            route = "ETH → USDC → rUSDY";
          } else if (fromToken === "USDC") {
            output = await rusdyPool.swapExpected("USDC", TOKEN_REGISTRY.rUSDY.address, fromAmount);
            route = "USDC → rUSDY";
          }
        } else {
          const result = await curve.router.getBestRouteAndOutput(
            TOKEN_REGISTRY[fromToken].address,
            TOKEN_REGISTRY[toToken].address,
            fromAmount
          );
          output = result.output || "0";
          route = `${fromToken} → ${toToken}`;
        }

        setToAmount(parseFloat(output).toFixed(6));
        
        const rate = parseFloat(output) / parseFloat(fromAmount);
        setSwapRoute({ 
          route, 
          exchangeRate: rate.toFixed(6),
          priceImpact: "< 0.01%",
          estimatedGas: "~0.01 ETH" 
        });

        // Update ETH price
        if (fromToken === "ETH" && (toToken === "USDC" || toToken === "USDT")) {
          setEthPrice(rate);
        }
      } catch (e) {
        console.error("Calc error:", e);
      }
    };

    const timer = setTimeout(calc, 500);
    return () => clearTimeout(timer);
  }, [fromAmount, fromToken, toToken, curveReady]);

  // Execute swap
  const executeSwap = async () => {
    if (!account || !window.ethereum || !fromAmount || !toAmount) {
      onShowToast?.("error", "Invalid swap parameters");
      return;
    }

    setIsLoading(true);

    try {
      const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = web3Provider.getSigner();

      const GAS_RESERVE = ethers.utils.parseEther("0.0001");
      
      if (fromToken === "ETH") {
        const balance = await web3Provider.getBalance(account);
        const maxSwap = balance.sub(GAS_RESERVE);
        const required = ethers.utils.parseEther(fromAmount);

        if (required.gt(maxSwap)) {
          const adjusted = ethers.utils.formatEther(maxSwap);
          setFromAmount(adjusted);
          onShowToast?.("warning", `Adjusted to ${adjusted} ETH (gas reserve: 0.0001 ETH)`);
          setIsLoading(false);
          return;
        }
      }

      // Handle token approval
      if (fromToken !== "ETH") {
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
          spender = curve.getPool(USDC_RUSDY_POOL_ID).address;
        } else {
          spender = CURVE_ROUTER_ADDRESS;
        }

        const required = ethers.utils.parseUnits(fromAmount, TOKEN_REGISTRY[fromToken].decimals);
        const allowance = await tokenContract.allowance(account, spender);

        if (allowance.lt(required)) {
          console.log("🔐 Approving...");
          const approveTx = await tokenContract.approve(spender, required);
          await approveTx.wait();
          console.log("✅ Approved");
        }
      }

      let txHash;

      // Execute swap
      if (toToken === "rUSDY") {
        const usdcPool = curve.getPool(ETH_USDC_POOL_ID);
        const rusdyPool = curve.getPool(USDC_RUSDY_POOL_ID);

        if (fromToken === "ETH") {
          const usdcOut = await usdcPool.swapExpected("ETH", "USDC", fromAmount);
          const tx1 = await usdcPool.swap("ETH", "USDC", fromAmount, slippage / 100);
          await provider.waitForTransaction(tx1);

          const tx2 = await rusdyPool.swap("USDC", TOKEN_REGISTRY.rUSDY.address, usdcOut, slippage / 100);
          txHash = tx2;
        } else if (fromToken === "USDC") {
          txHash = await rusdyPool.swap("USDC", TOKEN_REGISTRY.rUSDY.address, fromAmount, slippage / 100);
        }
      } else {
        txHash = await curve.router.swap(
          TOKEN_REGISTRY[fromToken].address,
          TOKEN_REGISTRY[toToken].address,
          fromAmount,
          slippage / 100
        );
      }

      await provider.waitForTransaction(txHash);
      
      onShowToast?.("success", "Swap successful!", txHash);
      if (toToken === "USDC" && onSwapSuccess) onSwapSuccess(toAmount);

      // Refresh balances
      const newBalances = { ...balances };
      if (fromToken === "ETH") {
        const bal = await web3Provider.getBalance(account);
        newBalances.ETH = ethers.utils.formatEther(bal);
      } else {
        const contract = new ethers.Contract(
          TOKEN_REGISTRY[fromToken].address,
          ["function balanceOf(address) view returns (uint256)"],
          provider
        );
        const bal = await contract.balanceOf(account);
        newBalances[fromToken] = ethers.utils.formatUnits(bal, TOKEN_REGISTRY[fromToken].decimals);
      }

      if (toToken !== "ETH") {
        const contract = new ethers.Contract(
          TOKEN_REGISTRY[toToken].address,
          ["function balanceOf(address) view returns (uint256)"],
          provider
        );
        const bal = await contract.balanceOf(account);
        newBalances[toToken] = ethers.utils.formatUnits(bal, TOKEN_REGISTRY[toToken].decimals);
      }

      setBalances(newBalances);
      setFromAmount("");
      setToAmount("");
      setSwapRoute(null);

    } catch (error) {
      console.error("Swap error:", error);
      const msg = error.message || String(error);

      if (msg.includes("user rejected") || msg.includes("denied")) {
        onShowToast?.("error", "Transaction cancelled");
      } else if (msg.includes("slippage") || msg.includes("Slippage")) {
        onShowToast?.("error", `Slippage exceeded. Try ${slippage + 0.5}%`);
      } else if (msg.includes("insufficient")) {
        onShowToast?.("error", "Insufficient balance");
      } else {
        onShowToast?.("error", "Swap failed. Check console.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const setMax = () => {
    const bal = balances[fromToken] || "0";
    if (fromToken === "ETH") {
      const max = Math.max(0, parseFloat(bal) - 0.0001);
      setFromAmount(max.toFixed(6));
    } else {
      setFromAmount((parseFloat(bal) * 0.9999).toFixed(6));
    }
  };

  const switchTokens = () => {
    setFromToken(toToken);
    setToToken(fromToken);
    setFromAmount("");
    setToAmount("");
    setSwapRoute(null);
  };

  return (
    <div className="swap-interface-container">
      <h1 className="swap-interface-title">Swap</h1>

      {/* From Token */}
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
              if (val === "" || /^\d*\.?\d*$/.test(val)) setFromAmount(val);
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
              }}
              className="swap-token-select"
            >
              {Object.keys(TOKEN_REGISTRY)
                .filter(k => k !== "WETH" && balances[k] && parseFloat(balances[k]) > 0)
                .map(k => (
                  <option key={k} value={k}>{k}</option>
                ))}
            </select>
          </div>
        </div>
        <div className="swap-usd-value">
          ≈ ${calculateUsdValue(fromAmount, fromToken)}
        </div>
      </div>

      {/* Swap Direction Button */}
      <div className="swap-direction-container">
        <button onClick={switchTokens} className="swap-direction-button">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="swap-direction-icon">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
        </button>
      </div>

      {/* To Token */}
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
              }}
              className="swap-token-select"
            >
              {Object.keys(TOKEN_REGISTRY)
                .filter(k => k !== "WETH")
                .map(k => (
                  <option key={k} value={k}>{k}</option>
                ))}
            </select>
          </div>
        </div>
        <div className="swap-usd-value">
          ≈ ${calculateUsdValue(toAmount, toToken)}
        </div>
      </div>

      {/* Route Info */}
      {swapRoute && (
        <div className="swap-route-info">
          <div className="swap-route-row">
            <span className="swap-route-label">Exchange rate (incl. fees):</span>
            <div className="swap-route-value-right">
              <div>{fromToken}/{toToken} <span className="swap-route-bold">{swapRoute.exchangeRate}</span></div>
              <div>{toToken}/{fromToken} <span className="swap-route-bold">{(1 / parseFloat(swapRoute.exchangeRate)).toFixed(6)}</span></div>
            </div>
          </div>
          <div className="swap-route-row">
            <span className="swap-route-label">Price impact:</span>
            <span className="swap-route-bold">{swapRoute.priceImpact}</span>
          </div>
          <div className="swap-route-row">
            <span className="swap-route-label">Trade routed through:</span>
            <span className="swap-route-bold">{swapRoute.route}</span>
          </div>
          <div className="swap-route-row">
            <span className="swap-route-label">Estimated TX cost:</span>
            <span className="swap-route-bold">{swapRoute.estimatedGas}</span>
          </div>
          <div className="swap-route-row slippage-editor-row">
            <span className="swap-route-label">Slippage tolerance:</span>
            <div className="slippage-controls">
              <div className="slippage-preset-buttons">
                {[0.1, 0.5, 1.0].map(s => (
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

      {/* Execute Button */}
      <button
        onClick={executeSwap}
        disabled={isLoading || !fromAmount || !toAmount || !account}
        className="swap-execute-button"
      >
        <span className="swap-button-text">
          {isLoading ? "SWAPPING..." : "SWAP"}
        </span>
      </button>
    </div>
  );
};

export default SwapInterface;