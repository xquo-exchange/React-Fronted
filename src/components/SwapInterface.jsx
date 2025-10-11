import React, { useState, useEffect } from "react";
import { useWallet } from "../hooks/useWallet";
import { ethers } from "ethers";
import curve from "@curvefi/api";
import "./SwapInterface.css";

// Curve Router address on Ethereum mainnet
const CURVE_ROUTER_ADDRESS = "0xF0d4c12A5768D806021F80a262B4d39d26C58b8D";

// Pool identifiers for rUSDY swap route
const ETH_USDC_POOL_ID = "factory-tricrypto-3";
const USDC_RUSDY_POOL_ID = "factory-stable-ng-161";

// Extended Token Registry
const TOKEN_REGISTRY = {
  ETH: {
    address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
    decimals: 18,
    symbol: "ETH",
    name: "Ethereum",
    logo: "",
    availableOnCurve: true
  },
  WETH: {
    address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    decimals: 18,
    symbol: "WETH",
    name: "Wrapped Ether",
    logo: "",
    availableOnCurve: true
  },
  USDC: {
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    decimals: 6,
    symbol: "USDC",
    name: "USD Coin",
    logo: "",
    availableOnCurve: true
  },
  USDT: {
    address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    decimals: 6,
    symbol: "USDT",
    name: "Tether USD",
    logo: "",
    availableOnCurve: true
  },
  DAI: {
    address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    decimals: 18,
    symbol: "DAI",
    name: "Dai Stablecoin",
    logo: "",
    availableOnCurve: true
  },
  rUSDY: {
    address: "0xaf37c1167910ebc994e266949387d2c7c326b879",
    decimals: 18,
    symbol: "rUSDY",
    name: "Rebasing Ondo USD Yield",
    logo: "",
    availableOnCurve: true
  },
  WBTC: {
    address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
    decimals: 8,
    symbol: "WBTC",
    name: "Wrapped Bitcoin",
    logo: "",
    availableOnCurve: true
  }
};

const SwapInterface = ({ onShowToast, onSwapSuccess }) => {
  const { walletAddress: account } = useWallet();
  const [fromToken, setFromToken] = useState("ETH");
  const [toToken, setToToken] = useState("USDC");
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [status, setStatus] = useState("");
  const [swapRoute, setSwapRoute] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [availableBalance, setAvailableBalance] = useState("0");
  const [toAvailableBalance, setToAvailableBalance] = useState("0");
  const [showConfirm, setShowConfirm] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [lastEditedField, setLastEditedField] = useState('from');
  const [tokenBalances, setTokenBalances] = useState({});
  const [slippage, setSlippage] = useState(0.5); // Default 0.5%
  const [customSlippage, setCustomSlippage] = useState("");
  const [showSlippageEditor, setShowSlippageEditor] = useState(false);

  const rpcProvider = new ethers.providers.JsonRpcProvider("https://mainnet.infura.io/v3/2dd1a437f34141deb299352ba4bbd0e2");

  // Fetch balances for all tokens
  useEffect(() => {
    const fetchAllBalances = async () => {
      if (!account) {
        setTokenBalances({});
        return;
      }

      const balances = {};

      try {
        for (const key of Object.keys(TOKEN_REGISTRY)) {
          const tokenKey = key;

          if (tokenKey === "ETH") {
            const balance = await rpcProvider.getBalance(account);
            balances[tokenKey] = ethers.utils.formatEther(balance);
          } else {
            const tokenAddress = TOKEN_REGISTRY[tokenKey].address;
            const tokenContract = new ethers.Contract(
              tokenAddress,
              ["function balanceOf(address) view returns (uint256)"],
              rpcProvider
            );
            const balance = await tokenContract.balanceOf(account);
            const decimals = TOKEN_REGISTRY[tokenKey].decimals;
            balances[tokenKey] = ethers.utils.formatUnits(balance, decimals);
          }
        }
        setTokenBalances(balances);
      } catch (error) {
        console.error("Error fetching token balances:", error);
      }
    };

    fetchAllBalances();
  }, [account]);

  // Fetch balance for FROM token
  useEffect(() => {
    const fetchBalance = async () => {
      if (!account) {
        setAvailableBalance("0");
        return;
      }

      try {
        if (fromToken === "ETH") {
          const balance = await rpcProvider.getBalance(account);
          setAvailableBalance(parseFloat(ethers.utils.formatEther(balance)).toFixed(6));
        } else {
          const tokenAddress = TOKEN_REGISTRY[fromToken].address;
          const tokenContract = new ethers.Contract(
            tokenAddress,
            ["function balanceOf(address) view returns (uint256)"],
            rpcProvider
          );
          const balance = await tokenContract.balanceOf(account);
          const decimals = TOKEN_REGISTRY[fromToken].decimals;
          const formattedBalance = parseFloat(ethers.utils.formatUnits(balance, decimals)).toFixed(6);
          setAvailableBalance(formattedBalance);
        }
      } catch (error) {
        console.error("Error fetching FROM balance:", error);
        setAvailableBalance("0");
      }
    };

    fetchBalance();
  }, [account, fromToken]);

  // Fetch balance for TO token
  useEffect(() => {
    const fetchBalance = async () => {
      if (!account) {
        setToAvailableBalance("0");
        return;
      }

      try {
        if (toToken === "ETH") {
          const balance = await rpcProvider.getBalance(account);
          setToAvailableBalance(parseFloat(ethers.utils.formatEther(balance)).toFixed(6));
        } else {
          const tokenAddress = TOKEN_REGISTRY[toToken].address;
          const tokenContract = new ethers.Contract(
            tokenAddress,
            ["function balanceOf(address) view returns (uint256)"],
            rpcProvider
          );
          const balance = await tokenContract.balanceOf(account);
          const decimals = TOKEN_REGISTRY[toToken].decimals;
          const formattedBalance = parseFloat(ethers.utils.formatUnits(balance, decimals)).toFixed(6);
          setToAvailableBalance(formattedBalance);
        }
      } catch (error) {
        console.error("Error fetching TO balance:", error);
        setToAvailableBalance("0");
      }
    };

    fetchBalance();
  }, [account, toToken]);

  // Auto-calculate preview when amount changes
  useEffect(() => {
    const calculatePreview = async () => {
      const amount = lastEditedField === 'from' ? fromAmount : toAmount;
      if (!amount || parseFloat(amount) <= 0 || isCalculating) {
        return;
      }

      setIsCalculating(true);

      try {
        await curve.init("Web3", { externalProvider: window.ethereum, network: 'mainnet' }, { gasPrice: 0, chainId: 1 });
        await curve.factory.fetchPools();
        await curve.tricryptoFactory.fetchPools();
        await curve.stableNgFactory.fetchPools();

        const fromTokenAddr = TOKEN_REGISTRY[fromToken].address;
        const toTokenAddr = TOKEN_REGISTRY[toToken].address;

        // Special handling for rUSDY auto-preview
        if (toToken === "rUSDY" && lastEditedField === 'from') {
          const ethUsdcPool = curve.getPool(ETH_USDC_POOL_ID);
          const usdcUsdyPool = curve.getPool(USDC_RUSDY_POOL_ID);

          if (ethUsdcPool && usdcUsdyPool) {
            if (fromToken === "ETH") {
              const usdcAmount = await usdcUsdyPool.swapExpected(toTokenAddr, "USDC", fromAmount);
              if (usdcAmount) {
                const ethAmount = await ethUsdcPool.swapExpected("USDC", "ETH", usdcAmount);
                if (ethAmount) {
                  setToAmount(parseFloat(fromAmount).toFixed(6));
                  const rate = parseFloat(fromAmount) / parseFloat(ethAmount);
                  const routeInfo = {
                    route: `ETH → USDC → rUSDY`,
                    exchangeRate: rate.toFixed(6),
                    priceImpact: "< 0.01%",
                    estimatedGas: "~0.02 ETH"
                  };
                  setSwapRoute(routeInfo);
                }
              }
            } else if (fromToken === "USDC") {
              const expectedRUSDY = await usdcUsdyPool.swapExpected("USDC", toTokenAddr, fromAmount);
              if (expectedRUSDY) {
                setToAmount(parseFloat(expectedRUSDY).toFixed(6));
                const rate = parseFloat(expectedRUSDY) / parseFloat(fromAmount);
                const routeInfo = {
                  route: `USDC → rUSDY`,
                  exchangeRate: rate.toFixed(6),
                  priceImpact: "< 0.01%",
                  estimatedGas: "~0.01 ETH"
                };
                setSwapRoute(routeInfo);
              }
            }
          }
          setStatus("");
          setIsCalculating(false);
          return;
        }

        if (lastEditedField === 'from') {
          const expectedOutput = await curve.router.getBestRouteAndOutput(
            fromTokenAddr,
            toTokenAddr,
            fromAmount
          );

          if (expectedOutput && expectedOutput.output) {
            setToAmount(parseFloat(expectedOutput.output).toFixed(6));

            const rate = parseFloat(expectedOutput.output) / parseFloat(fromAmount);
            const routeInfo = {
              route: expectedOutput.route?.length > 0
                ? expectedOutput.route.map((r) => r.poolName || r.name).join(" → ")
                : `${fromToken} → ${toToken}`,
              exchangeRate: rate.toFixed(6),
              priceImpact: expectedOutput.priceImpact || "< 0.01%",
              estimatedGas: "~0.01 ETH"
            };
            setSwapRoute(routeInfo);
          }
        } else {
          const expectedInput = await curve.router.getBestRouteAndOutput(
            toTokenAddr,
            fromTokenAddr,
            toAmount
          );

          if (expectedInput && expectedInput.output) {
            setFromAmount(parseFloat(expectedInput.output).toFixed(6));

            const rate = parseFloat(toAmount) / parseFloat(expectedInput.output);
            const routeInfo = {
              route: expectedInput.route?.length > 0
                ? expectedInput.route.map((r) => r.poolName || r.name).join(" → ")
                : `${fromToken} → ${toToken}`,
              exchangeRate: rate.toFixed(6),
              priceImpact: expectedInput.priceImpact || "< 0.01%",
              estimatedGas: "~0.01 ETH"
            };
            setSwapRoute(routeInfo);
          }
        }
        setStatus("");
      } catch (error) {
        console.error("Auto-preview error:", error);
      } finally {
        setIsCalculating(false);
      }
    };

    const timeoutId = setTimeout(calculatePreview, 800);
    return () => clearTimeout(timeoutId);
  }, [fromAmount, toAmount, fromToken, toToken, lastEditedField, isCalculating]);

  // Preview swap and get route info
  const previewSwap = async () => {
    if (!fromAmount || parseFloat(fromAmount) <= 0) {
      setStatus("Please enter an amount");
      if (onShowToast) onShowToast("error", "Please enter an amount");
      return;
    }

    setIsLoading(true);
    setStatus("Calculating best route...");

    try {
      await curve.init("Web3", { externalProvider: window.ethereum, network: 'mainnet' }, { gasPrice: 0, chainId: 1 });
      await curve.factory.fetchPools();
      await curve.tricryptoFactory.fetchPools();
      await curve.stableNgFactory.fetchPools();

      const fromTokenAddr = TOKEN_REGISTRY[fromToken].address;
      const toTokenAddr = TOKEN_REGISTRY[toToken].address;

      if (toToken === "rUSDY") {
        const ethUsdcPool = curve.getPool(ETH_USDC_POOL_ID);
        const usdcUsdyPool = curve.getPool(USDC_RUSDY_POOL_ID);

        if (!ethUsdcPool) throw new Error("ETH/USDC pool not found");
        if (!usdcUsdyPool) throw new Error("USDC/rUSDY pool not found");

        if (fromToken === "ETH") {
          const usdcAmount = await usdcUsdyPool.swapExpected(toTokenAddr, "USDC", fromAmount);
          if (!usdcAmount) throw new Error("Cannot calculate USDC amount needed");

          const ethAmount = await ethUsdcPool.swapExpected("USDC", "ETH", usdcAmount);
          if (!ethAmount) throw new Error("Cannot calculate ETH amount needed");

          setToAmount(fromAmount);

          const rate = parseFloat(fromAmount) / parseFloat(ethAmount);
          const routeInfo = {
            route: `ETH → USDC → rUSDY`,
            exchangeRate: rate.toFixed(6),
            priceImpact: "< 0.01%",
            estimatedGas: "~0.02 ETH"
          };

          setSwapRoute(routeInfo);
        } else if (fromToken === "USDC") {
          const expectedRUSDY = await usdcUsdyPool.swapExpected("USDC", toTokenAddr, fromAmount);
          if (!expectedRUSDY) throw new Error("Cannot calculate rUSDY output");

          setToAmount(expectedRUSDY);

          const rate = parseFloat(expectedRUSDY) / parseFloat(fromAmount);
          const routeInfo = {
            route: `USDC → rUSDY`,
            exchangeRate: rate.toFixed(6),
            priceImpact: "< 0.01%",
            estimatedGas: "~0.01 ETH"
          };

          setSwapRoute(routeInfo);
        } else {
          throw new Error(`Unsupported swap route: ${fromToken} → rUSDY`);
        }

        setStatus("");
        setIsLoading(false);
        return;
      }

      const expectedOutput = await curve.router.getBestRouteAndOutput(
        fromTokenAddr,
        toTokenAddr,
        fromAmount
      );

      if (!expectedOutput || !expectedOutput.output) {
        throw new Error("No route found for this swap");
      }

      setToAmount(expectedOutput.output);

      const rate = parseFloat(expectedOutput.output) / parseFloat(fromAmount);
      const estimatedGas = "~0.01 ETH";

      const routeInfo = {
        route: expectedOutput.route?.length > 0
          ? expectedOutput.route.map((r) => r.poolName || r.name).join(" → ")
          : `${fromToken} → ${toToken}`,
        exchangeRate: rate.toFixed(6),
        priceImpact: expectedOutput.priceImpact || "< 0.01%",
        estimatedGas
      };

      setSwapRoute(routeInfo);
      setStatus("");
      setIsLoading(false);

    } catch (error) {
      console.error("Preview error:", error);
      const errorMsg = String(error);
      if (errorMsg.includes("not available")) {
        setStatus(`No liquidity route found for ${fromToken} → ${toToken}. This pair may not be available on Curve.`);
        if (onShowToast) onShowToast("error", `No liquidity route found for ${fromToken} → ${toToken}`);
      } else {
        setStatus("Error calculating swap: " + errorMsg);
        if (onShowToast) onShowToast("error", "Error calculating swap");
      }
      setIsLoading(false);
    }
  };

  // Execute the swap
  const executeSwap = async () => {
    if (!account || !window.ethereum) {
      setStatus("Please connect your wallet");
      if (onShowToast) onShowToast("error", "Please connect your wallet");
      return;
    }

    setIsLoading(true);
    setStatus("Preparing transaction...");

    try {
      await curve.init("Web3", { externalProvider: window.ethereum, network: 'mainnet' }, { gasPrice: 0, chainId: 1 });
      await curve.factory.fetchPools();
      await curve.tricryptoFactory.fetchPools();
      await curve.stableNgFactory.fetchPools();

      const fromTokenAddr = TOKEN_REGISTRY[fromToken].address;
      const toTokenAddr = TOKEN_REGISTRY[toToken].address;
      const provider = new ethers.providers.Web3Provider(window.ethereum);

      if (toToken === "rUSDY") {
        setStatus("Preparing rUSDY swap route...");

        const ethUsdcPool = curve.getPool(ETH_USDC_POOL_ID);
        const usdcUsdyPool = curve.getPool(USDC_RUSDY_POOL_ID);

        if (!ethUsdcPool) throw new Error("ETH/USDC pool not found");
        if (!usdcUsdyPool) throw new Error("USDC/rUSDY pool not found");

        const balance = await provider.getBalance(account);
        const minGasETH = ethers.utils.parseEther("0.001");

        if (fromToken === "ETH" && balance.gte(minGasETH)) {
          setStatus("Calculating required amounts...");

          const usdcAmount = await usdcUsdyPool.swapExpected(toTokenAddr, "USDC", fromAmount);
          if (!usdcAmount) throw new Error("Cannot calculate USDC amount needed");

          const ethAmount = await ethUsdcPool.swapExpected("USDC", "ETH", usdcAmount);
          if (!ethAmount) throw new Error("Cannot calculate ETH amount needed");

          setStatus("Executing ETH → USDC swap...");
          const tx1 = await ethUsdcPool.swap("ETH", "USDC", ethAmount, slippage / 100);
          await rpcProvider.waitForTransaction(tx1);

          setStatus("Executing USDC → rUSDY swap...");
          const tx2 = await usdcUsdyPool.swap("USDC", toTokenAddr, fromAmount, slippage / 100);
          const receipt = await rpcProvider.waitForTransaction(tx2);

          if (!receipt) throw new Error("Transaction not found");
          setStatus("Swap completed successfully! 🎉");
          if (onShowToast) onShowToast("success", "Swap completed successfully!", tx2);
          // No USDC output for rUSDY swaps

        } else if (fromToken === "USDC" || (fromToken === "ETH" && balance.lt(minGasETH))) {
          setStatus("Executing direct USDC → rUSDY swap...");

          const usdcContract = new ethers.Contract(
            TOKEN_REGISTRY.USDC.address,
            [
              "function allowance(address owner, address spender) view returns (uint256)",
              "function approve(address spender, uint256 amount) returns (bool)"
            ],
            provider.getSigner()
          );

          const requiredUSDC = await usdcUsdyPool.swapExpected(toTokenAddr, "USDC", fromAmount);
          const requiredAmount = ethers.utils.parseUnits(requiredUSDC, TOKEN_REGISTRY.USDC.decimals);

          const currentAllowance = await usdcContract.allowance(account, CURVE_ROUTER_ADDRESS);

          if (currentAllowance.lt(requiredAmount)) {
            setStatus("Requesting USDC approval...");
            const approveTx = await usdcContract.approve(CURVE_ROUTER_ADDRESS, requiredAmount);
            setStatus("Waiting for approval confirmation...");
            await approveTx.wait();
            setStatus("USDC approved successfully!");
          }

          const tx = await usdcUsdyPool.swap("USDC", toTokenAddr, requiredUSDC, slippage / 100);
          const receipt = await rpcProvider.waitForTransaction(tx);

          if (!receipt) throw new Error("Transaction not found");
          setStatus("Swap completed successfully! 🎉");
          if (onShowToast) onShowToast("success", "Swap completed successfully!", tx);
          // No USDC output for rUSDY swaps

        } else {
          throw new Error(`Unsupported swap route: ${fromToken} → rUSDY`);
        }

      } else {
        setStatus("Finding best route...");
        const routeInfo = await curve.router.getBestRouteAndOutput(
          fromTokenAddr,
          toTokenAddr,
          fromAmount
        );

        if (!routeInfo || !routeInfo.output) {
          throw new Error(`No route found for ${fromToken} → ${toToken}`);
        }

        if (fromToken !== "ETH") {
          setStatus("Checking token approval...");

          const signer = provider.getSigner();

          const tokenContract = new ethers.Contract(
            fromTokenAddr,
            [
              "function allowance(address owner, address spender) view returns (uint256)",
              "function approve(address spender, uint256 amount) returns (bool)"
            ],
            signer
          );

          const routerAddress = CURVE_ROUTER_ADDRESS;

          const currentAllowance = await tokenContract.allowance(account, routerAddress);
          const requiredAmount = ethers.utils.parseUnits(fromAmount, TOKEN_REGISTRY[fromToken].decimals);

          if (currentAllowance.lt(requiredAmount)) {
            setStatus("Requesting token approval...");
            const approveTx = await tokenContract.approve(routerAddress, requiredAmount);
            setStatus("Waiting for approval confirmation...");
            await approveTx.wait();
            setStatus("Token approved successfully!");
          }
        }

        if (fromToken !== "ETH") {
          const tokenContract = new ethers.Contract(
            fromTokenAddr,
            ["function balanceOf(address) view returns (uint256)"],
            provider
          );
          const balance = await tokenContract.balanceOf(account);
          const requiredAmount = ethers.utils.parseUnits(fromAmount, TOKEN_REGISTRY[fromToken].decimals);

          if (balance.lt(requiredAmount)) {
            throw new Error(`Insufficient ${fromToken} balance. You have ${ethers.utils.formatUnits(balance, TOKEN_REGISTRY[fromToken].decimals)} but need ${fromAmount}`);
          }
        } else {
          const balance = await provider.getBalance(account);
          const requiredAmount = ethers.utils.parseEther(fromAmount);

          if (balance.lt(requiredAmount)) {
            throw new Error(`Insufficient ETH balance. You have ${ethers.utils.formatEther(balance)} but need ${fromAmount}`);
          }
        }

        setStatus("Executing swap...");

        const tx = await curve.router.swap(
          fromTokenAddr,
          toTokenAddr,
          fromAmount,
          slippage / 100
        );

        setStatus("Waiting for confirmation...");
        const txHash = typeof tx === 'string' ? tx : tx.hash;
        const receipt = await rpcProvider.waitForTransaction(txHash);

        if (!receipt) throw new Error("Transaction not found");

        setStatus("Swap completed successfully! 🎉");
        if (onShowToast) onShowToast("success", "Swap completed successfully!", txHash);
        
        // If output was USDC, pass amount to stake page for pre-fill
        if (toToken === "USDC" && toAmount && onSwapSuccess) {
          onSwapSuccess(toAmount);
        }
      }

      setFromAmount("");
      setToAmount("");
      setSwapRoute(null);
      setShowConfirm(false);

      setTimeout(() => setStatus(""), 5000);

    } catch (err) {
      console.error("Swap error:", err);
      const errorMsg = String(err);
      if (errorMsg.includes("not available")) {
        setStatus(`Swap failed: No liquidity route found for ${fromToken} → ${toToken}. This pair may not be available on Curve.`);
        if (onShowToast) onShowToast("error", "Swap failed: No liquidity route found");
      } else if (errorMsg.includes("user rejected")) {
        setStatus("Transaction cancelled by user");
        if (onShowToast) onShowToast("error", "Transaction cancelled by user");
      } else {
        setStatus("Swap error: " + errorMsg);
        if (onShowToast) onShowToast("error", "Swap error");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwapTokens = () => {
    const tempToken = fromToken;
    setFromToken(toToken);
    setToToken(tempToken);
    setFromAmount(toAmount);
    setToAmount("");
    setSwapRoute(null);
  };

  const setMaxAmount = () => {
    setFromAmount(availableBalance);
    setLastEditedField('from');
  };

  return (
    <div className="swap-interface-container">
      <h1 className="swap-interface-title">Swap</h1>

      {/* From Token */}
      <div className="swap-token-box">
        <div className="swap-token-header">
          <span className="swap-balance-label">Avail. {availableBalance} {fromToken}</span>
          <button onClick={setMaxAmount} className="swap-max-button">
            MAX
          </button>
        </div>
        <div className="swap-token-input-row">
          <input
            type="text"
            inputMode="decimal"
            placeholder="0.0"
            value={fromAmount}
            onChange={(e) => {
              const value = e.target.value;
              if (value === '' || /^\d*\.?\d*$/.test(value)) {
                setFromAmount(value);
                setLastEditedField('from');
                if (value === '') {
                  setToAmount("");
                  setSwapRoute(null);
                }
              }
            }}
            className="swap-amount-input"
          />
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
              .filter((key) => {
                const balance = tokenBalances[key];
                return balance && parseFloat(balance) > 0;
              })
              .map((key) => {
                const token = TOKEN_REGISTRY[key];
                return (
                  <option key={key} value={key}>
                    {token.logo} {token.symbol}
                  </option>
                );
              })}
          </select>
        </div>
        <div className="swap-usd-value">
          {fromAmount && parseFloat(fromAmount) > 0 ? `≈ $${(parseFloat(fromAmount) * (fromToken === "ETH" || fromToken === "WETH" ? 4681 : 1)).toFixed(2)}` : '≈ $0.00'}
        </div>
      </div>

      {/* Swap Direction Button */}
      <div className="swap-direction-container">
        <button onClick={handleSwapTokens} className="swap-direction-button">
          <svg className="swap-direction-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
        </button>
      </div>

      {/* To Token */}
      <div className="swap-token-box">
        <div className="swap-token-header">
          <span className="swap-balance-label">Avail. {toAvailableBalance} {toToken}</span>
        </div>
        <div className="swap-token-input-row">
          <input
            type="text"
            inputMode="decimal"
            placeholder="0.0"
            value={toAmount}
            onChange={(e) => {
              const value = e.target.value;
              if (value === '' || /^\d*\.?\d*$/.test(value)) {
                setToAmount(value);
                setLastEditedField('to');
                if (value === '') {
                  setFromAmount("");
                  setSwapRoute(null);
                }
              }
            }}
            className="swap-amount-input"
          />
          <select
            value={toToken}
            onChange={(e) => {
              const newToken = e.target.value;
              setToToken(newToken);
              setToAmount("");
              setFromAmount("");
              setSwapRoute(null);
            }}
            className="swap-token-select"
          >
            {Object.keys(TOKEN_REGISTRY)
              .filter((key) => {
                const token = TOKEN_REGISTRY[key];
                return token.availableOnCurve;
              })
              .map((key) => {
                const token = TOKEN_REGISTRY[key];
                return (
                  <option key={key} value={key}>
                    {token.logo} {token.symbol}
                  </option>
                );
              })}
          </select>
        </div>
        <div className="swap-usd-value">
          {toAmount && parseFloat(toAmount) > 0 ? `≈ $${(parseFloat(toAmount) * (toToken === "ETH" || toToken === "WETH" ? 4681 : 1)).toFixed(2)}` : '≈ $0.00'}
        </div>
      </div>

      {/* Swap Route Info */}
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
                <button 
                  className={`slippage-preset-btn ${slippage === 0.1 ? 'active' : ''}`}
                  onClick={() => { setSlippage(0.1); setCustomSlippage(""); }}
                >
                  0.1%
                </button>
                <button 
                  className={`slippage-preset-btn ${slippage === 0.5 ? 'active' : ''}`}
                  onClick={() => { setSlippage(0.5); setCustomSlippage(""); }}
                >
                  0.5%
                </button>
                <button 
                  className={`slippage-preset-btn ${slippage === 1.0 ? 'active' : ''}`}
                  onClick={() => { setSlippage(1.0); setCustomSlippage(""); }}
                >
                  1.0%
                </button>
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
                    if (val && !isNaN(val)) {
                      setSlippage(parseFloat(val));
                    }
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

      {/* Swap Button */}
      <div className="swap-button-container">
        <button
          onClick={() => {
            const fromTokenAvailable = TOKEN_REGISTRY[fromToken]?.availableOnCurve;
            const toTokenAvailable = TOKEN_REGISTRY[toToken]?.availableOnCurve;

            if (!fromTokenAvailable || !toTokenAvailable) {
              setStatus(`Error: ${!fromTokenAvailable ? fromToken : toToken} is not available on Curve`);
              if (onShowToast) onShowToast("error", `${!fromTokenAvailable ? fromToken : toToken} is not available on Curve`);
              return;
            }

            if (!swapRoute) {
              previewSwap();
            } else {
              setShowConfirm(true);
            }
          }}
          disabled={isLoading || !fromAmount || parseFloat(fromAmount) <= 0 || !account}
          className="swap-execute-button"
        >
          <div className="swap-step-indicator">1</div>
          <span className="swap-button-text">
            {isLoading ? "LOADING..." : swapRoute ? "SWAP" : "CALCULATE"}
          </span>
        </button>
      </div>

      {/* Status message */}
      {status && (
        <div className={`swap-status-message ${
          status.includes("Error") || status.includes("error")
            ? "swap-status-error"
            : status.includes("success") || status.includes("completed")
            ? "swap-status-success"
            : "swap-status-info"
        }`}>
          {status}
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirm && swapRoute && (
        <div className="swap-modal-overlay">
          <div className="swap-modal-content">
            <h3 className="swap-modal-title">Confirm Swap</h3>
            <div className="swap-modal-details">
              <div className="swap-modal-row">
                <span className="swap-modal-label">From:</span>
                <span className="swap-modal-value">{fromAmount} {fromToken}</span>
              </div>
              <div className="swap-modal-row">
                <span className="swap-modal-label">To (estimated):</span>
                <span className="swap-modal-value">{toAmount} {toToken}</span>
              </div>
              <div className="swap-modal-row">
                <span className="swap-modal-label">Rate:</span>
                <span className="swap-modal-value">{swapRoute.exchangeRate}</span>
              </div>
              <div className="swap-modal-row">
                <span className="swap-modal-label">Price Impact:</span>
                <span className="swap-modal-value">{swapRoute.priceImpact}</span>
              </div>
              <div className="swap-modal-row">
                <span className="swap-modal-label">Gas (est):</span>
                <span className="swap-modal-value">{swapRoute.estimatedGas}</span>
              </div>
            </div>

            <div className="swap-modal-actions">
              <button
                onClick={() => {
                  setShowConfirm(false);
                  executeSwap();
                }}
                disabled={isLoading}
                className="swap-modal-button swap-modal-confirm"
              >
                Confirm Swap
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                disabled={isLoading}
                className="swap-modal-button swap-modal-cancel"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SwapInterface;