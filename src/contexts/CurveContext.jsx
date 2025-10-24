import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import curve from '@curvefi/api';

const CurveContext = createContext(null);

export function CurveProvider({ children }) {
  const [curveReady, setCurveReady] = useState(false);
  const [pools, setPools] = useState({});
  const [error, setError] = useState(null);
  const hasInitialized = useRef(false);
  
  // ✅ NEW: Web3 Curve instance for transactions
  const [curveWeb3, setCurveWeb3] = useState(null);
  const [curveWeb3Ready, setCurveWeb3Ready] = useState(false);
  const [web3Error, setWeb3Error] = useState(null);
  const web3Initialized = useRef(false);

  useEffect(() => {
    // Only initialize once
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    (async () => {
      try {
        console.log('🔄 CurveContext: Initializing Curve in RPC mode...');
        
        // Use RPC mode for pool fetching and route calculation
        const rpcUrls = [
          'https://rpc.ankr.com/eth/8d154b0d09bc26ed179344de000e32fbad099ef3ea203b572ba8450d87b376dd',
          'https://mainnet.infura.io/v3/2dd1a437f34141deb299352ba4bbd0e2',
          'https://ethereum.publicnode.com'
        ];

        let rpcSuccess = false;
        for (const rpcUrl of rpcUrls) {
          try {
            console.log(`🔄 CurveContext: Trying RPC: ${rpcUrl.substring(0, 50)}...`);
            await curve.init('JsonRpc', { url: rpcUrl, chainId: 1 }, { gasPrice: 0 });
            rpcSuccess = true;
            console.log(`✅ CurveContext: RPC initialized with ${rpcUrl.substring(0, 50)}...`);
            break;
          } catch (err) {
            console.warn(`⚠️ CurveContext: RPC failed for ${rpcUrl.substring(0, 50)}...:`, err.message);
            continue;
          }
        }

        if (!rpcSuccess) {
          throw new Error('All RPC endpoints failed');
        }

        // Fetch all pools once
        console.log('🔄 CurveContext: Fetching pools...');
        await Promise.all([
          curve.factory.fetchPools().catch(() => console.warn('Factory pools fetch failed')),
          curve.tricryptoFactory.fetchPools().catch(() => console.warn('Tricrypto pools fetch failed')),
          curve.stableNgFactory.fetchPools().catch(() => console.warn('StableNG pools fetch failed'))
        ]);

        // Cache important pools
        const ethUsdcPool = curve.getPool('factory-tricrypto-3');
        const usdcRusdyPool = curve.getPool('factory-stable-ng-161');

        setPools({
          ethUsdc: ethUsdcPool,
          usdcRusdy: usdcRusdyPool
        });

        setCurveReady(true);
        console.log('✅ CurveContext: Curve ready!');
      } catch (err) {
        console.error('❌ CurveContext: Initialization failed:', err);
        setError(err.message);
      }
    })();
  }, []);

  // ✅ NEW: Initialize Web3 Curve instance when wallet connects
  const initializeWeb3Curve = async (externalProvider) => {
    if (web3Initialized.current || !externalProvider) return;
    web3Initialized.current = true;
    
    try {
      console.log('🔄 CurveContext: Initializing Web3 transaction mode...');
      setWeb3Error(null);
      
      // Create a separate Web3 Curve instance for transactions
      const web3Instance = curve; // Use the same instance but reinitialize
      await web3Instance.init('Web3', { externalProvider, chainId: 1 }, { gasPrice: 0 });
      
      console.log('✅ CurveContext: Web3 Curve instance initialized');
      
      // Fetch pools for the Web3 instance
      await Promise.all([
        web3Instance.factory.fetchPools().catch(() => console.warn('Web3 Factory pools fetch failed')),
        web3Instance.tricryptoFactory.fetchPools().catch(() => console.warn('Web3 Tricrypto pools fetch failed')),
        web3Instance.stableNgFactory.fetchPools().catch(() => console.warn('Web3 StableNG pools fetch failed'))
      ]);
      
      setCurveWeb3(web3Instance);
      setCurveWeb3Ready(true);
      console.log('✅ CurveContext: Web3 transaction mode ready!');
      
    } catch (err) {
      console.error('❌ CurveContext: Web3 initialization failed:', err);
      setWeb3Error(err.message);
      web3Initialized.current = false; // Allow retry
    }
  };

  // ✅ NEW: Auto-initialize Web3 when wallet provider becomes available
  useEffect(() => {
    const checkForWalletProvider = () => {
      if (typeof window !== 'undefined' && window.ethereum) {
        console.log('🔄 CurveContext: Detected wallet provider, initializing Web3 mode...');
        initializeWeb3Curve(window.ethereum);
      }
    };

    // Check immediately
    checkForWalletProvider();

    // Also listen for wallet connection events
    const handleWalletConnect = (event) => {
      const { provider } = event.detail || {};
      if (provider) {
        console.log('🔄 CurveContext: Wallet connected, initializing Web3 mode...');
        setTimeout(() => initializeWeb3Curve(provider), 1000); // Delay to ensure provider is ready
      }
    };

    window.addEventListener('walletConnected', handleWalletConnect);
    
    return () => {
      window.removeEventListener('walletConnected', handleWalletConnect);
    };
  }, []);

  const value = {
    curve,
    curveReady,
    pools,
    error,
    // ✅ NEW: Web3 transaction instance
    curveWeb3,
    curveWeb3Ready,
    web3Error,
    initializeWeb3Curve
  };

  return <CurveContext.Provider value={value}>{children}</CurveContext.Provider>;
}

export function useCurve() {
  const context = useContext(CurveContext);
  if (!context) throw new Error('useCurve must be used within CurveProvider');
  return context;
}