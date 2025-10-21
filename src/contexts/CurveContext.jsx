import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import curve from '@curvefi/api';
import { WalletContext } from './WalletContext';

const CurveContext = createContext(null);

export function CurveProvider({ children }) {
  const [curveReady, setCurveReady] = useState(false);
  const [pools, setPools] = useState({});
  const [error, setError] = useState(null);
  const initPromise = useRef(null);
  const { walletConnectProvider } = useContext(WalletContext);

  useEffect(() => {
    if (initPromise.current) return;

    initPromise.current = (async () => {
      try {
        console.log('🔄 Initializing Curve (once)...');
        
        // Wait for wallet connection or use fallback
        const externalProvider = walletConnectProvider || null;
        
        if (!externalProvider) {
          console.warn('No wallet connected, Curve may have limited functionality');
        }

        await curve.init(
          externalProvider ? 'Web3' : 'JsonRpc',
          externalProvider 
            ? { externalProvider, chainId: 1 }
            : { url: 'https://mainnet.infura.io/v3/2dd1a437f34141deb299352ba4bbd0e2', chainId: 1 },
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
  }, [walletConnectProvider]);

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