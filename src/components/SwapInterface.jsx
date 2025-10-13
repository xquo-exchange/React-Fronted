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
    address: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
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
  const [slippage, setSlippage] = useState(0.5);
  const [customSlippage, setCustomSlippage] = useState("");
  const [showSlippageEditor, setShowSlippageEditor] = useState(false);
  const [curveInitialized, setCurveInitialized] = useState(false);
  const [ethPrice, setEthPrice] = useState(4136); // Track actual ETH price from Curve

  const rpcProvider = new ethers.providers.JsonRpcProvider("https://mainnet.infura.io/v3/2dd1a437f34141deb299352ba4bbd0e2");

  // Helper function to floor a number to N decimals
  const floorToDecimals = (value, decimals = 6) => {
    const multiplier = Math.pow(10, decimals);
    return Math.floor(value * multiplier) / multiplier;
  };

  // Helper function to calculate USD value
  const calculateUsdValue = (amount, token) => {
    if (!amount || parseFloat(amount) <= 0) return "0.00";
    
    const numAmount = parseFloat(amount);
    
    if (token === "ETH" || token === "WETH") {
      return (numAmount * ethPrice).toFixed(2);
    } else if (token === "USDC" || token === "USDT" || token === "DAI") {
      return numAmount.toFixed(2);
    } else if (token === "rUSDY") {
      return numAmount.toFixed(2); // rUSDY is 1:1 with USD
    } else if (token === "WBTC") {
      // Rough BTC estimate at ~$95k
      return (numAmount * 95000).toFixed(2);
    }
    
    return "0.00";
  };

  // Update ETH price when route changes
  useEffect(() => {
    if (swapRoute && swapRoute.exchangeRate) {
      const rate = parseFloat(swapRoute.exchangeRate);
      
      // Update ETH price based on ETH/USDC rate
      if (fromToken === "ETH" && (toToken === "USDC" || toToken === "USDT" || toToken === "DAI")) {
        setEthPrice(rate);
        console.log(`📈 ETH price updated: $${rate.toFixed(2)}`);
      } else if ((fromToken === "USDC" || fromToken === "USDT" || fromToken === "DAI") && toToken === "ETH") {
        setEthPrice(1 / rate);
        console.log(`📈 ETH price updated: $${(1/rate).toFixed(2)}`);
      }
    }
  }, [swapRoute, fromToken, toToken]);

  // Fetch balances for all tokens
  useEffect(() => {
    const fetchAllBalances = async () => {
      if (!account) {
        setTokenBalances({});
        return;
      }

      const balances = {};
      console.log("🔄 Fetching all token balances for:", account);

      try {
        for (const key of Object.keys(TOKEN_REGISTRY)) {
          const tokenKey = key;

          if (tokenKey === "ETH") {
            const balance = await rpcProvider.getBalance(account);
            balances[tokenKey] = ethers.utils.formatEther(balance);
            console.log(`✅ ETH balance:`, balances[tokenKey]);
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
            console.log(`✅ ${tokenKey} balance:`, balances[tokenKey]);
          }
        }
        setTokenBalances(balances);
      } catch (error) {
        console.error("❌ Error fetching token balances:", error);
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
          const formatted = parseFloat(ethers.utils.formatEther(balance));
          setAvailableBalance(floorToDecimals(formatted, 6).toString());
          console.log(`💰 FROM balance (${fromToken}):`, floorToDecimals(formatted, 6));
        } else {
          const tokenAddress = TOKEN_REGISTRY[fromToken].address;
          const tokenContract = new ethers.Contract(
            tokenAddress,
            ["function balanceOf(address) view returns (uint256)"],
            rpcProvider
          );
          const balance = await tokenContract.balanceOf(account);
          const decimals = TOKEN_REGISTRY[fromToken].decimals;
          const formatted = parseFloat(ethers.utils.formatUnits(balance, decimals));
          setAvailableBalance(floorToDecimals(formatted, 6).toString());
          console.log(`💰 FROM balance (${fromToken}):`, floorToDecimals(formatted, 6));
        }
      } catch (error) {
        console.error("❌ Error fetching FROM balance:", error);
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
          const formatted = parseFloat(ethers.utils.formatEther(balance));
          setToAvailableBalance(floorToDecimals(formatted, 6).toString());
          console.log(`💰 TO balance (${toToken}):`, floorToDecimals(formatted, 6));
        } else {
          const tokenAddress = TOKEN_REGISTRY[toToken].address;
          const tokenContract = new ethers.Contract(
            tokenAddress,
            ["function balanceOf(address) view returns (uint256)"],
            rpcProvider
          );
          const balance = await tokenContract.balanceOf(account);
          const decimals = TOKEN_REGISTRY[toToken].decimals;
          const formatted = parseFloat(ethers.utils.formatUnits(balance, decimals));
          setToAvailableBalance(floorToDecimals(formatted, 6).toString());
          console.log(`💰 TO balance (${toToken}):`, floorToDecimals(formatted, 6));
        }
      } catch (error) {
        console.error("❌ Error fetching TO balance:", error);
        setToAvailableBalance("0");
      }
    };

    fetchBalance();
  }, [account, toToken]);

  // Initialize Curve once on mount
  useEffect(() => {
    const initCurve = async () => {
      if (!curveInitialized && window.ethereum) {
        try {
          console.log("🔄 Initializing Curve...");
          await curve.init("Web3", { externalProvider: window.ethereum, network: 'mainnet' }, { gasPrice: 0, chainId: 1 });
          await curve.factory.fetchPools();
          await curve.tricryptoFactory.fetchPools();
          await curve.stableNgFactory.fetchPools();
          setCurveInitialized(true);
          console.log("✅ Curve initialized successfully");
        } catch (error) {
          console.error("❌ Error initializing Curve:", error);
        }
      }
    };
    initCurve();
  }, [curveInitialized]);

  // Auto-calculate preview when amount changes
  useEffect(() => {
    const calculatePreview = async () => {
      const amount = lastEditedField === 'from' ? fromAmount : toAmount;
      if (!amount || parseFloat(amount) <= 0 || isCalculating || !curveInitialized) {
        return;
      }

      setIsCalculating(true);
      console.log(`🧮 Auto-calculating preview: ${lastEditedField === 'from' ? fromToken : toToken} ${amount}`);

      try {
        const fromTokenAddr = TOKEN_REGISTRY[fromToken].address;
        const toTokenAddr = TOKEN_REGISTRY[toToken].address;

        // Special handling for rUSDY auto-preview
        if (toToken === "rUSDY" && lastEditedField === 'from') {
          console.log("🔄 Special rUSDY route calculation...");
          const ethUsdcPool = curve.getPool(ETH_USDC_POOL_ID);
          const usdcUsdyPool = curve.getPool(USDC_RUSDY_POOL_ID);

          if (ethUsdcPool && usdcUsdyPool) {
            if (fromToken === "ETH") {
              const usdcAmount = await usdcUsdyPool.swapExpected(toTokenAddr, "USDC", fromAmount);
              if (usdcAmount) {
                const ethAmount = await ethUsdcPool.swapExpected("USDC", "ETH", usdcAmount);
                if (ethAmount) {
                  const output = floorToDecimals(parseFloat(fromAmount), 6);
                  setToAmount(output.toString());
                  const rate = parseFloat(fromAmount) / parseFloat(ethAmount);
                  const routeInfo = {
                    route: `ETH → USDC → rUSDY`,
                    exchangeRate: floorToDecimals(rate, 6).toString(),
                    priceImpact: "< 0.01%",
                    estimatedGas: "~0.02 ETH"
                  };
                  setSwapRoute(routeInfo);
                  console.log("✅ rUSDY route calculated:", routeInfo);
                }
              }
            } else if (fromToken === "USDC") {
              const expectedRUSDY = await usdcUsdyPool.swapExpected("USDC", toTokenAddr, fromAmount);
              if (expectedRUSDY) {
                const output = floorToDecimals(parseFloat(expectedRUSDY), 6);
                setToAmount(output.toString());
                const rate = parseFloat(expectedRUSDY) / parseFloat(fromAmount);
                const routeInfo = {
                  route: `USDC → rUSDY`,
                  exchangeRate: floorToDecimals(rate, 6).toString(),
                  priceImpact: "< 0.01%",
                  estimatedGas: "~0.01 ETH"
                };
                setSwapRoute(routeInfo);
                console.log("✅ USDC→rUSDY route calculated:", routeInfo);
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
            const output = floorToDecimals(parseFloat(expectedOutput.output), 6);
            setToAmount(output.toString());

            const rate = parseFloat(expectedOutput.output) / parseFloat(fromAmount);
            const routeInfo = {
              route: expectedOutput.route?.length > 0
                ? expectedOutput.route.map((r) => r.poolName || r.name).join(" → ")
                : `${fromToken} → ${toToken}`,
              exchangeRate: floorToDecimals(rate, 6).toString(),
              priceImpact: expectedOutput.priceImpact || "< 0.01%",
              estimatedGas: "~0.01 ETH"
            };
            setSwapRoute(routeInfo);
            console.log("✅ Route calculated:", routeInfo);
          }
        } else {
          const expectedInput = await curve.router.getBestRouteAndOutput(
            toTokenAddr,
            fromTokenAddr,
            toAmount
          );

          if (expectedInput && expectedInput.output) {
            const input = floorToDecimals(parseFloat(expectedInput.output), 6);
            setFromAmount(input.toString());

            const rate = parseFloat(toAmount) / parseFloat(expectedInput.output);
            const routeInfo = {
              route: expectedInput.route?.length > 0
                ? expectedInput.route.map((r) => r.poolName || r.name).join(" → ")
                : `${fromToken} → ${toToken}`,
              exchangeRate: floorToDecimals(rate, 6).toString(),
              priceImpact: expectedInput.priceImpact || "< 0.01%",
              estimatedGas: "~0.01 ETH"
            };
            setSwapRoute(routeInfo);
            console.log("✅ Reverse route calculated:", routeInfo);
          }
        }
        setStatus("");
      } catch (error) {
        console.error("❌ Auto-preview error:", error);
      } finally {
        setIsCalculating(false);
      }
    };

    const timeoutId = setTimeout(calculatePreview, 800);
    return () => clearTimeout(timeoutId);
  }, [fromAmount, toAmount, fromToken, toToken, lastEditedField, curveInitialized]);

  // Preview swap and get route info
  const previewSwap = async () => {
    if (!fromAmount || parseFloat(fromAmount) <= 0) {
      setStatus("❌ Please enter an amount");
      if (onShowToast) onShowToast("error", "Please enter an amount");
      return;
    }

    if (!curveInitialized) {
      setStatus("⏳ Initializing Curve...");
      return;
    }

    setIsLoading(true);
    setStatus("🔍 Calculating best route...");
    console.log(`🔍 Preview swap: ${fromAmount} ${fromToken} → ${toToken}`);

    try {
      const fromTokenAddr = TOKEN_REGISTRY[fromToken].address;
      const toTokenAddr = TOKEN_REGISTRY[toToken].address;

      if (toToken === "rUSDY") {
        console.log("🔄 rUSDY route preview...");
        const ethUsdcPool = curve.getPool(ETH_USDC_POOL_ID);
        const usdcUsdyPool = curve.getPool(USDC_RUSDY_POOL_ID);

        if (!ethUsdcPool) throw new Error("ETH/USDC pool not found");
        if (!usdcUsdyPool) throw new Error("USDC/rUSDY pool not found");

        if (fromToken === "ETH") {
          const usdcAmount = await usdcUsdyPool.swapExpected(toTokenAddr, "USDC", fromAmount);
          if (!usdcAmount) throw new Error("Cannot calculate USDC amount needed");

          const ethAmount = await ethUsdcPool.swapExpected("USDC", "ETH", usdcAmount);
          if (!ethAmount) throw new Error("Cannot calculate ETH amount needed");

          const output = floorToDecimals(parseFloat(fromAmount), 6);
          setToAmount(output.toString());

          const rate = parseFloat(fromAmount) / parseFloat(ethAmount);
          const routeInfo = {
            route: `ETH → USDC → rUSDY`,
            exchangeRate: floorToDecimals(rate, 6).toString(),
            priceImpact: "< 0.01%",
            estimatedGas: "~0.02 ETH"
          };

          setSwapRoute(routeInfo);
          console.log("✅ rUSDY route preview complete:", routeInfo);
        } else if (fromToken === "USDC") {
          const expectedRUSDY = await usdcUsdyPool.swapExpected("USDC", toTokenAddr, fromAmount);
          if (!expectedRUSDY) throw new Error("Cannot calculate rUSDY output");

          const output = floorToDecimals(parseFloat(expectedRUSDY), 6);
          setToAmount(output.toString());

          const rate = parseFloat(expectedRUSDY) / parseFloat(fromAmount);
          const routeInfo = {
            route: `USDC → rUSDY`,
            exchangeRate: floorToDecimals(rate, 6).toString(),
            priceImpact: "< 0.01%",
            estimatedGas: "~0.01 ETH"
          };

          setSwapRoute(routeInfo);
          console.log("✅ USDC→rUSDY route preview complete:", routeInfo);
        } else {
          throw new Error(`Unsupported swap route: ${fromToken} → rUSDY`);
        }

        setStatus("");
        setIsLoading(false);

      } else {
        const expectedOutput = await curve.router.getBestRouteAndOutput(
          fromTokenAddr,
          toTokenAddr,
          fromAmount
        );

        if (!expectedOutput || !expectedOutput.output) {
          throw new Error("No route found for this swap");
        }

        const output = floorToDecimals(parseFloat(expectedOutput.output), 6);
        setToAmount(output.toString());

        const rate = parseFloat(expectedOutput.output) / parseFloat(fromAmount);
        const estimatedGas = "~0.01 ETH";

        const routeInfo = {
          route: expectedOutput.route?.length > 0
            ? expectedOutput.route.map((r) => r.poolName || r.name).join(" → ")
            : `${fromToken} → ${toToken}`,
          exchangeRate: floorToDecimals(rate, 6).toString(),
          priceImpact: expectedOutput.priceImpact || "< 0.01%",
          estimatedGas
        };

        setSwapRoute(routeInfo);
        console.log("✅ Route preview complete:", routeInfo);
        setStatus("");
        setIsLoading(false);
      }

    } catch (error) {
      console.error("❌ Preview error:", error);
      const errorMsg = String(error);
      if (errorMsg.includes("not available")) {
        setStatus(`❌ No liquidity route found for ${fromToken} → ${toToken}. This pair may not be available on Curve.`);
        if (onShowToast) onShowToast("error", `No liquidity route found for ${fromToken} → ${toToken}`);
      } else {
        setStatus("❌ Error calculating swap: " + errorMsg);
        if (onShowToast) onShowToast("error", "Error calculating swap");
      }
      setIsLoading(false);
    }
  };

  // Execute the swap
  const executeSwap = async () => {
    console.log("🚀 Starting swap execution...");
    console.log(`📊 Swap details: ${fromAmount} ${fromToken} → ${toToken} (slippage: ${slippage}%)`);

    if (!account || !window.ethereum) {
      const msg = "❌ Please connect your wallet";
      setStatus(msg);
      console.error(msg);
      if (onShowToast) onShowToast("error", "Please connect your wallet");
      return;
    }

    if (!curveInitialized) {
      const msg = "⏳ Initializing Curve...";
      setStatus(msg);
      console.warn(msg);
      return;
    }

    if (!fromAmount || parseFloat(fromAmount) <= 0) {
      const msg = "❌ Invalid amount";
      setStatus(msg);
      console.error(msg);
      if (onShowToast) onShowToast("error", "Please enter a valid amount");
      return;
    }

    // Validate sufficient balance BEFORE executing
    try {
      console.log("🔍 Checking balances...");
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      
      if (fromToken === "ETH") {
        const balance = await provider.getBalance(account);
        const requiredAmount = ethers.utils.parseEther(fromAmount);
        const estimatedGas = ethers.utils.parseEther("0.001");
        const totalRequired = requiredAmount.add(estimatedGas);

        console.log(`💰 ETH Balance: ${ethers.utils.formatEther(balance)}`);
        console.log(`💸 Required (swap + gas): ${ethers.utils.formatEther(totalRequired)}`);

        if (balance.lt(totalRequired)) {
          const maxUsable = balance.sub(estimatedGas);
          if (maxUsable.gt(0)) {
            const adjustedAmount = floorToDecimals(parseFloat(ethers.utils.formatEther(maxUsable)), 6);
            setFromAmount(adjustedAmount.toString());
            const msg = `⚠️ Amount adjusted to ${adjustedAmount} ETH (reserved 0.001 ETH for gas)`;
            setStatus(msg);
            console.warn(msg);
            if (onShowToast) onShowToast("warning", "Amount adjusted for gas fees");
            return;
          } else {
            const shortfall = floorToDecimals(parseFloat(ethers.utils.formatEther(totalRequired.sub(balance))), 6);
            const msg = `❌ Insufficient ETH. You need ${shortfall} more ETH for gas fees.`;
            setStatus(msg);
            console.error(msg);
            if (onShowToast) onShowToast("error", `Need ${shortfall} more ETH for gas`);
            return;
          }
        }
      } else {
        const tokenAddress = TOKEN_REGISTRY[fromToken].address;
        const tokenContract = new ethers.Contract(
          tokenAddress,
          ["function balanceOf(address) view returns (uint256)"],
          provider
        );
        const balance = await tokenContract.balanceOf(account);
        const requiredAmount = ethers.utils.parseUnits(fromAmount, TOKEN_REGISTRY[fromToken].decimals);

        console.log(`💰 ${fromToken} Balance: ${ethers.utils.formatUnits(balance, TOKEN_REGISTRY[fromToken].decimals)}`);
        console.log(`💸 Required: ${fromAmount}`);

        if (balance.lt(requiredAmount)) {
          const decimals = TOKEN_REGISTRY[fromToken].decimals;
          const maxAvailable = floorToDecimals(parseFloat(ethers.utils.formatUnits(balance, decimals)), 6);
          setFromAmount(maxAvailable.toString());
          const msg = `⚠️ Amount adjusted to ${maxAvailable} ${fromToken} (your max balance)`;
          setStatus(msg);
          console.warn(msg);
          if (onShowToast) onShowToast("warning", "Amount adjusted to max balance");
          return;
        }

        const ethBalance = await provider.getBalance(account);
        const minGasETH = ethers.utils.parseEther("0.001");
        console.log(`⛽ ETH for gas: ${ethers.utils.formatEther(ethBalance)}`);
        
        if (ethBalance.lt(minGasETH)) {
          const msg = "❌ Insufficient ETH for gas. You need at least 0.001 ETH.";
          setStatus(msg);
          console.error(msg);
          if (onShowToast) onShowToast("error", "Need 0.001 ETH for gas fees");
          return;
        }
      }

      console.log("✅ Balance check passed");
    } catch (error) {
      console.error("❌ Balance check error:", error);
      setStatus(`❌ Balance check failed: ${error.message}`);
      if (onShowToast) onShowToast("error", "Failed to check balance");
      return;
    }

    setIsLoading(true);
    setStatus("🔄 Preparing transaction...");

    try {
      const fromTokenAddr = TOKEN_REGISTRY[fromToken].address;
      const toTokenAddr = TOKEN_REGISTRY[toToken].address;
      const provider = new ethers.providers.Web3Provider(window.ethereum);

      // Calculate minimum output with slippage
      const minOutput = floorToDecimals(parseFloat(toAmount) * (1 - slippage / 100), 6);
      console.log(`📉 Minimum output with ${slippage}% slippage: ${minOutput} ${toToken}`);

      if (toToken === "rUSDY") {
        console.log("🔄 Executing rUSDY swap route...");
        setStatus("🔄 Preparing rUSDY swap route...");

        const ethUsdcPool = curve.getPool(ETH_USDC_POOL_ID);
        const usdcUsdyPool = curve.getPool(USDC_RUSDY_POOL_ID);

        if (!ethUsdcPool) throw new Error("ETH/USDC pool not found");
        if (!usdcUsdyPool) throw new Error("USDC/rUSDY pool not found");

        const balance = await provider.getBalance(account);
        const minGasETH = ethers.utils.parseEther("0.001");

        if (fromToken === "ETH" && balance.gte(minGasETH)) {
          setStatus("🧮 Calculating required amounts...");
          console.log("🧮 Calculating ETH→USDC→rUSDY amounts...");

          const usdcAmount = await usdcUsdyPool.swapExpected(toTokenAddr, "USDC", fromAmount);
          if (!usdcAmount) throw new Error("Cannot calculate USDC amount needed");
          console.log(`💱 USDC intermediate: ${usdcAmount}`);

          const ethAmount = await ethUsdcPool.swapExpected("USDC", "ETH", usdcAmount);
          if (!ethAmount) throw new Error("Cannot calculate ETH amount needed");
          console.log(`💱 ETH needed: ${ethAmount}`);

          setStatus("📤 Executing ETH → USDC swap...");
          console.log("📤 Swap 1/2: ETH → USDC");
          const tx1 = await ethUsdcPool.swap("ETH", "USDC", ethAmount, slippage / 100);
          console.log("⏳ Waiting for ETH→USDC tx:", tx1);
          await rpcProvider.waitForTransaction(tx1);
          console.log("✅ ETH→USDC complete");

          setStatus("📤 Executing USDC → rUSDY swap...");
          console.log("📤 Swap 2/2: USDC → rUSDY");
          const tx2 = await usdcUsdyPool.swap("USDC", toTokenAddr, fromAmount, slippage / 100);
          console.log("⏳ Waiting for USDC→rUSDY tx:", tx2);
          const receipt = await rpcProvider.waitForTransaction(tx2);

          if (!receipt) throw new Error("Transaction not found");
          
          setStatus("✅ Swap completed successfully!");
          console.log("🎉 Swap completed successfully!");
          if (onShowToast) onShowToast("success", "Swap completed successfully!", tx2);

        } else if (fromToken === "USDC" || (fromToken === "ETH" && balance.lt(minGasETH))) {
          setStatus("📤 Executing direct USDC → rUSDY swap...");
          console.log("📤 Direct USDC → rUSDY swap");

          const usdcContract = new ethers.Contract(
            TOKEN_REGISTRY.USDC.address,
            [
              "function allowance(address owner, address spender) view returns (uint256)",
              "function approve(address spender, uint256 amount) returns (bool)"
            ],
            provider.getSigner()
          );

          const requiredUSDC = await usdcUsdyPool.swapExpected(toTokenAddr, "USDC", fromAmount);
          console.log(`💱 Required USDC: ${requiredUSDC}`);
          const requiredAmount = ethers.utils.parseUnits(requiredUSDC, TOKEN_REGISTRY.USDC.decimals);

          const currentAllowance = await usdcContract.allowance(account, CURVE_ROUTER_ADDRESS);
          console.log(`🔐 Current allowance: ${ethers.utils.formatUnits(currentAllowance, 6)}`);

          if (currentAllowance.lt(requiredAmount)) {
            setStatus("🔐 Requesting USDC approval...");
            console.log("🔐 Approving USDC...");
            const approveTx = await usdcContract.approve(CURVE_ROUTER_ADDRESS, requiredAmount);
            setStatus("⏳ Waiting for approval confirmation...");
            console.log("⏳ Waiting for approval tx:", approveTx.hash);
            await approveTx.wait();
            setStatus("✅ USDC approved successfully!");
            console.log("✅ USDC approved");
          }

          console.log("📤 Executing swap with slippage:", slippage / 100);
          const tx = await usdcUsdyPool.swap("USDC", toTokenAddr, requiredUSDC, slippage / 100);
          console.log("⏳ Waiting for swap tx:", tx);
          const receipt = await rpcProvider.waitForTransaction(tx);

          if (!receipt) throw new Error("Transaction not found");
          
          setStatus("✅ Swap completed successfully!");
          console.log("🎉 Swap completed successfully!");
          if (onShowToast) onShowToast("success", "Swap completed successfully!", tx);

        } else {
          throw new Error(`Unsupported swap route: ${fromToken} → rUSDY`);
        }

      } else {
        setStatus("🔍 Finding best route...");
        console.log("🔍 Getting best route from Curve router...");
        
        const routeInfo = await curve.router.getBestRouteAndOutput(
          fromTokenAddr,
          toTokenAddr,
          fromAmount
        );

        if (!routeInfo || !routeInfo.output) {
          throw new Error(`No route found for ${fromToken} → ${toToken}`);
        }
        console.log("✅ Route found:", routeInfo);

        if (fromToken !== "ETH") {
          setStatus("🔐 Checking token approval...");
          console.log("🔐 Checking token approval...");

          const signer = provider.getSigner();
          const tokenContract = new ethers.Contract(
            fromTokenAddr,
            [
              "function allowance(address owner, address spender) view returns (uint256)",
              "function approve(address spender, uint256 amount) returns (bool)",
              "function decimals() view returns (uint8)"
            ],
            signer
          );

          const routerAddress = CURVE_ROUTER_ADDRESS;
          const currentAllowance = await tokenContract.allowance(account, routerAddress);
          const tokenDecimals = TOKEN_REGISTRY[fromToken].decimals;
          const requiredAmount = ethers.utils.parseUnits(fromAmount, tokenDecimals);
          
          console.log(`🔐 Current allowance: ${ethers.utils.formatUnits(currentAllowance, tokenDecimals)} ${fromToken}`);
          console.log(`🔐 Required: ${fromAmount} ${fromToken}`);

          if (currentAllowance.lt(requiredAmount)) {
            setStatus("🔐 Requesting token approval...");
            console.log("🔐 Approving token...");
            
            try {
              const approveTx = await tokenContract.approve(routerAddress, requiredAmount);
              setStatus("⏳ Waiting for approval confirmation...");
              console.log("⏳ Waiting for approval tx:", approveTx.hash);
              const approvalReceipt = await approveTx.wait();
              console.log("✅ Approval receipt:", approvalReceipt);
              setStatus("✅ Token approved successfully!");
              console.log("✅ Token approved");
              
              // Wait 2 seconds for blockchain state to update
              await new Promise(resolve => setTimeout(resolve, 2000));
            } catch (approveError) {
              console.error("❌ Approval failed:", approveError);
              throw new Error(`Token approval failed: ${approveError.message}`);
            }
          } else {
            console.log("✅ Sufficient allowance already exists");
          }
        }

        setStatus("📤 Executing swap...");
        console.log(`📤 Executing swap with slippage: ${slippage}%`);
        console.log(`📤 From: ${fromAmount} ${fromToken} (${fromTokenAddr})`);
        console.log(`📤 To: ${toToken} (${toTokenAddr})`);
        console.log(`📤 Expected output: ${toAmount} ${toToken}`);
        console.log(`📤 Min output (with slippage): ${minOutput} ${toToken}`);

        let swapTx;
        try {
          console.log("🔄 Calling curve.router.swap()...");
          
          // Use timeout to prevent hanging
          const swapPromise = curve.router.swap(
            fromTokenAddr,
            toTokenAddr,
            fromAmount,
            slippage / 100
          );
          
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Swap transaction timeout after 60 seconds")), 60000)
          );
          
          swapTx = await Promise.race([swapPromise, timeoutPromise]);
          console.log("✅ curve.router.swap() returned:", swapTx);
          
        } catch (swapError) {
          console.error("❌ curve.router.swap() failed:", swapError);
          console.error("❌ Error details:", {
            message: swapError.message,
            code: swapError.code,
            data: swapError.data,
            stack: swapError.stack
          });
          throw swapError;
        }

        setStatus("⏳ Waiting for confirmation...");
        const txHash = typeof swapTx === 'string' ? swapTx : (swapTx?.hash || swapTx);
        console.log("⏳ Transaction hash:", txHash);
        
        if (!txHash) {
          throw new Error("No transaction hash returned from swap");
        }

        console.log("⏳ Waiting for transaction to be mined...");
        const receipt = await rpcProvider.waitForTransaction(txHash, 1, 120000); // 2 min timeout

        if (!receipt) {
          throw new Error("Transaction receipt not found");
        }
        
        if (receipt.status === 0) {
          throw new Error("Transaction failed on-chain");
        }

        setStatus("✅ Swap completed successfully!");
        console.log("🎉 Swap completed successfully!");
        console.log("📊 Receipt:", receipt);
        console.log(`📊 Block: ${receipt.blockNumber}`);
        console.log(`📊 Gas used: ${receipt.gasUsed.toString()}`);
        
        if (onShowToast) onShowToast("success", "Swap completed successfully!", txHash);
        
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
      console.error("❌ Swap error:", err);
      console.error("❌ Error type:", typeof err);
      console.error("❌ Error keys:", Object.keys(err));
      console.error("❌ Error stack:", err.stack);
      
      const errorMsg = err.message || String(err);
      let userMessage = "";
      
      // Parse specific error types
      if (errorMsg.includes("user rejected") || errorMsg.includes("ACTION_REJECTED") || err.code === "ACTION_REJECTED" || err.code === 4001) {
        userMessage = "❌ Transaction cancelled: You rejected the transaction in your wallet.";
        if (onShowToast) onShowToast("error", "Transaction cancelled");
      } else if (errorMsg.includes("timeout")) {
        userMessage = "❌ Transaction timeout: The swap took too long. Please try again.";
        if (onShowToast) onShowToast("error", "Transaction timeout");
      } else if (errorMsg.includes("Slippage") || err.reason === "Slippage") {
        userMessage = `❌ Slippage exceeded: Price moved too much. Current: ${slippage}%. Try increasing slippage tolerance or reducing amount.`;
        if (onShowToast) onShowToast("error", `Increase slippage above ${slippage}%`);
      } else if (errorMsg.includes("insufficient funds") || errorMsg.includes("exceeds balance")) {
        userMessage = "❌ Insufficient funds: You don't have enough balance (including gas fees).";
        if (onShowToast) onShowToast("error", "Insufficient funds");
      } else if (errorMsg.includes("not available") || errorMsg.includes("No route found")) {
        userMessage = `❌ No liquidity route found for ${fromToken} → ${toToken}. Try a different pair.`;
        if (onShowToast) onShowToast("error", "No liquidity route available");
      } else if (errorMsg.includes("gas required exceeds allowance") || errorMsg.includes("out of gas")) {
        userMessage = "❌ Gas limit exceeded: Try reducing the swap amount.";
        if (onShowToast) onShowToast("error", "Gas limit exceeded");
      } else if (errorMsg.includes("network") || errorMsg.includes("connection")) {
        userMessage = "❌ Network error: Connection issue. Check your internet.";
        if (onShowToast) onShowToast("error", "Network connection error");
      } else if (errorMsg.includes("nonce")) {
        userMessage = "❌ Transaction nonce error: Try refreshing the page.";
        if (onShowToast) onShowToast("error", "Nonce error - refresh page");
      } else if (errorMsg.includes("approval")) {
        userMessage = "❌ Token approval failed: Please try again.";
        if (onShowToast) onShowToast("error", "Approval failed");
      } else {
        // Generic error with first 200 chars
        const shortError = errorMsg.substring(0, 200);
        userMessage = `❌ Swap failed: ${shortError}${errorMsg.length > 200 ? '...' : ''}`;
        if (onShowToast) onShowToast("error", "Swap failed - check console");
      }
      
      setStatus(userMessage);
      console.error("❌ Final error message:", userMessage);
    } finally {
      setIsLoading(false);
      console.log("🏁 Swap execution finished");
    }
  };

  const handleSwapTokens = () => {
    console.log(`🔄 Swapping token direction: ${fromToken}↔${toToken}`);
    const tempToken = fromToken;
    setFromToken(toToken);
    setToToken(tempToken);
    setFromAmount(toAmount);
    setToAmount("");
    setSwapRoute(null);
  };

  const setMaxAmount = () => {
    console.log(`💯 Setting MAX amount for ${fromToken}`);
    
    if (fromToken === "ETH" || fromToken === "WETH") {
      // Reserve 0.00001 ETH for gas
      const gasReserve = 0.00001;
      const maxUsable = Math.max(0, parseFloat(availableBalance) - gasReserve);
      
      if (maxUsable > 0) {
        const floored = floorToDecimals(maxUsable, 6);
        setFromAmount(floored.toString());
        console.log(`✅ MAX set to: ${floored} ${fromToken} (reserved ${gasReserve} for gas)`);
      } else {
        setFromAmount("0");
        console.warn("⚠️ Insufficient balance for MAX (after gas reserve)");
      }
    } else {
      // For other tokens, use 99.99% of balance to avoid rounding issues
      const maxUsable = Math.max(0, parseFloat(availableBalance) * 0.9999);
      
      if (maxUsable > 0) {
        const floored = floorToDecimals(maxUsable, 6);
        setFromAmount(floored.toString());
        console.log(`✅ MAX set to: ${floored} ${fromToken} (99.99% of balance)`);
      } else {
        setFromAmount("0");
        console.warn("⚠️ Insufficient balance for MAX");
      }
    }
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
          <div className="swap-token-select-wrapper">
            <select
              value={fromToken}
              onChange={(e) => {
                const newToken = e.target.value;
                console.log(`🔄 Changing FROM token: ${fromToken} → ${newToken}`);
                setFromToken(newToken);
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
        </div>
        <div className="swap-usd-value">
          ≈ ${calculateUsdValue(fromAmount, fromToken)}
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
          <div className="swap-token-select-wrapper">
            <select
              value={toToken}
              onChange={(e) => {
                const newToken = e.target.value;
                console.log(`🔄 Changing TO token: ${toToken} → ${newToken}`);
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
        </div>
        <div className="swap-usd-value">
          ≈ ${calculateUsdValue(toAmount, toToken)}
        </div>
      </div>

      {/* Swap Route Info */}
      {swapRoute && (
        <div className="swap-route-info">
          <div className="swap-route-row">
            <span className="swap-route-label">Exchange rate (incl. fees):</span>
            <div className="swap-route-value-right">
              <div>{fromToken}/{toToken} <span className="swap-route-bold">{swapRoute.exchangeRate}</span></div>
              <div>{toToken}/{fromToken} <span className="swap-route-bold">{floorToDecimals(1 / parseFloat(swapRoute.exchangeRate), 6)}</span></div>
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
                  onClick={() => { 
                    setSlippage(0.1); 
                    setCustomSlippage(""); 
                    console.log("⚙️ Slippage set to: 0.1%");
                  }}
                >
                  0.1%
                </button>
                <button 
                  className={`slippage-preset-btn ${slippage === 0.5 ? 'active' : ''}`}
                  onClick={() => { 
                    setSlippage(0.5); 
                    setCustomSlippage(""); 
                    console.log("⚙️ Slippage set to: 0.5%");
                  }}
                >
                  0.5%
                </button>
                <button 
                  className={`slippage-preset-btn ${slippage === 1.0 ? 'active' : ''}`}
                  onClick={() => { 
                    setSlippage(1.0); 
                    setCustomSlippage(""); 
                    console.log("⚙️ Slippage set to: 1.0%");
                  }}
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
                      console.log(`⚙️ Custom slippage set to: ${val}%`);
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
              const unavailableToken = !fromTokenAvailable ? fromToken : toToken;
              const msg = `Error: ${unavailableToken} is not available on Curve`;
              setStatus(msg);
              console.error(msg);
              if (onShowToast) onShowToast("error", `${unavailableToken} is not available on Curve`);
              return;
            }

            if (!swapRoute) {
              console.log("🔍 No route yet, calculating preview...");
              previewSwap();
            } else {
              console.log("✅ Route exists, showing confirmation modal...");
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
          status.includes("❌") || status.includes("Error") || status.includes("error")
            ? "swap-status-error"
            : status.includes("✅") || status.includes("success") || status.includes("completed")
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
                <span className="swap-modal-label">Minimum received:</span>
                <span className="swap-modal-value">{floorToDecimals(parseFloat(toAmount) * (1 - slippage / 100), 6)} {toToken}</span>
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
                <span className="swap-modal-label">Slippage Tolerance:</span>
                <span className="swap-modal-value">{slippage}%</span>
              </div>
              <div className="swap-modal-row">
                <span className="swap-modal-label">Gas (est):</span>
                <span className="swap-modal-value">{swapRoute.estimatedGas}</span>
              </div>
            </div>

            <div className="swap-modal-actions">
              <button
                onClick={() => {
                  console.log("✅ User confirmed swap");
                  setShowConfirm(false);
                  executeSwap();
                }}
                disabled={isLoading}
                className="swap-modal-button swap-modal-confirm"
              >
                Confirm Swap
              </button>
              <button
                onClick={() => {
                  console.log("❌ User cancelled swap");
                  setShowConfirm(false);
                }}
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