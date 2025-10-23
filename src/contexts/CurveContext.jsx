import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import curve from '@curvefi/api';

const CurveContext = createContext(null);

export function CurveProvider({ children }) {
  const [curveReady, setCurveReady] = useState(false);
  const [pools, setPools] = useState({});
  const [error, setError] = useState(null);
  const hasInitialized = useRef(false);

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