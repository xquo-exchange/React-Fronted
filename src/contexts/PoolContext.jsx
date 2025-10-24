// src/contexts/PoolContext.jsx
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getPoolDetails } from '../curve/utility/PoolInfo.js';
import { getWalletDetails } from '../curve/utility/WalletInfo.js';
import { useCurve } from './CurveContext';

const PoolContext = createContext(null);

export function PoolProvider({ children, poolId = 'factory-stable-ng-161' }) {
  const [pool, setPool] = useState(null);
  const [poolData, setPoolData] = useState(null);
  const [walletData, setWalletData] = useState(null);
  const [status, setStatus] = useState({
    loading: true,
    error: null,
    lastUpdated: null,
  });

  // Use curve from CurveContext instead of initializing our own
  const { curve, curveReady } = useCurve();

  useEffect(() => {
    // Wait for CurveContext to initialize
    if (!curveReady || !curve) {
      console.log('🔄 PoolContext: Waiting for CurveContext...');
      return;
    }

    let mounted = true;

    async function init() {
      try {
        console.log('✅ PoolContext: CurveContext ready, starting pool initialization...');
        setStatus({ loading: true, error: null, lastUpdated: null });

        // Get pool instance directly from the already-initialized curve
        console.log('🔄 PoolContext: Getting pool instance...');
        const poolInstance = curve.getPool(poolId);
        
        if (!poolInstance) {
          throw new Error(`Pool ${poolId} not found`);
        }

        if (!mounted) return;
        setPool(poolInstance);

        // Fetch pool and wallet details (with retry for timing issues)
        console.log('🔄 PoolContext: Fetching pool and wallet details...');
        
        let pd = null;
        let wd = null;
        let retries = 3;
        
        while (retries > 0) {
          try {
            [pd, wd] = await Promise.all([
              getPoolDetails(poolInstance),
              getWalletDetails(poolInstance, null),
            ]);
            break; // Success, exit retry loop
          } catch (err) {
            retries--;
            if (retries > 0) {
              console.warn(`⚠️ Pool details fetch failed, retrying (${retries} left):`, err.message);
              await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms before retry
            } else {
              console.warn('⚠️ Pool details fetch failed after retries:', err.message);
              // Continue anyway with null values
              pd = null;
              wd = null;
            }
          }
        }

        if (!mounted) return;

        setPoolData(pd);
        setWalletData(wd);
        setStatus({
          loading: false,
          error: null,
          lastUpdated: Date.now(),
        });

        console.log('✅ PoolContext: Pool initialized successfully');
        if (pd) {
          console.log('📊 Pool data loaded:', {
            usdTotal: pd.stats?.usdTotal,
            vapy: pd.vapy,
            tokens: pd.tokens?.length
          });
        }

      } catch (err) {
        console.error('❌ PoolContext: Initialization failed:', err);
        if (!mounted) return;

        setStatus({
          loading: false,
          error: err.message || 'Failed to initialize pool',
          lastUpdated: Date.now(),
        });
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, [curve, curveReady, poolId]);

  const value = useMemo(
    () => ({ curve, pool, poolData, walletData, status }),
    [curve, pool, poolData, walletData, status]
  );

  return <PoolContext.Provider value={value}>{children}</PoolContext.Provider>;
}

export function usePool() {
  const context = useContext(PoolContext);
  if (!context) throw new Error('usePool must be used within PoolProvider');
  return context;
}