import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import curve from '@curvefi/api';
import { useWallet } from '../hooks/useWallet';

const CurveContext = createContext(null);

export function CurveProvider({ children }) {
  const [curveReady, setCurveReady] = useState(false);
  const [pools, setPools] = useState({});
  const [error, setError] = useState(null);
  const initPromise = useRef(null);
  const { getWalletConnectProvider, isConnected } = useWallet();

  useEffect(() => {
    // Only initialize Curve after wallet is connected
    if (!isConnected) {
      setCurveReady(false);
      setPools({});
      setError(null);
      initPromise.current = null;
      return;
    }

    if (initPromise.current) return;

    initPromise.current = (async () => {
      try {
        console.log('🔄 Initializing Curve (once)...');
        
        const externalProvider = getWalletConnectProvider();
        if (!externalProvider) {
          throw new Error('WalletConnect provider not available');
        }

        await curve.init(
          'Web3',
          { externalProvider, chainId: 1 },
          { gasPrice: 0 }
        );

        // Fetch all pools once
        await Promise.all([
          curve.factory.fetchPools(),
          curve.tricryptoFactory.fetchPools(),
          curve.stableNgFactory.fetchPools()
        ]);

        // Cache important pools
        const ethUsdcPool = curve.getPool('factory-tricrypto-3');
        const usdcRusdyPool = curve.getPool('factory-stable-ng-161');

        setPools({
          ethUsdc: ethUsdcPool,
          usdcRusdy: usdcRusdyPool
        });

        setCurveReady(true);
        console.log('✅ Curve ready (shared)');
      } catch (err) {
        console.error('❌ Curve init failed:', err);
        setError(err.message);
      }
    })();
  }, [isConnected, getWalletConnectProvider]);

  const value = {
    curve,
    curveReady,
    pools,
    error
  };

  return <CurveContext.Provider value={value}>{children}</CurveContext.Provider>;
}

export function useCurve() {
  const context = useContext(CurveContext);
  if (!context) throw new Error('useCurve must be used within CurveProvider');
  return context;
}
