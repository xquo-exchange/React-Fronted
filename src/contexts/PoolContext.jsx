// src/contexts/PoolContext.jsx
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getPoolDetails } from '../curve/utility/PoolInfo.js';
import { getWalletDetails } from '../curve/utility/WalletInfo.js';
import { useWallet } from '../hooks/useWallet';

const PoolContext = createContext(null);

export function PoolProvider({ children, poolId = 'factory-stable-ng-161' }) {
  const [curve, setCurve] = useState(null);
  const [pool, setPool] = useState(null);
  const [poolData, setPoolData] = useState(null);
  const [walletData, setWalletData] = useState(null);
  const [status, setStatus] = useState({
    loading: true,
    error: null,
    lastUpdated: null,
  });

  const { getWalletConnectProvider, isConnected } = useWallet();

  useEffect(() => {
    let mounted = true;
    let timeoutId = null;

    async function init() {
      try {
        setStatus({ loading: true, error: null, lastUpdated: null });

        // Add timeout to prevent indefinite loading
        const timeoutPromise = new Promise((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('Pool initialization timed out')), 30000);
        });

        const initPromise = (async () => {
          const curveModule = await import('@curvefi/api');
          const curveInstance = curveModule.default;

          if (!curveInstance) {
            throw new Error('Failed to load Curve API');
          }

          let mode = null;
          let externalProvider = null;

          if (isConnected) {
            externalProvider = getWalletConnectProvider();
            
            if (externalProvider) {
              try {
                const chainIdHex = await Promise.race([
                  externalProvider.request?.({ method: 'eth_chainId' }),
                  new Promise((_, reject) => setTimeout(() => reject(new Error('Chain ID request timeout')), 5000))
                ]).catch(() => null);
                
                const onMainnet = chainIdHex === '0x1' || chainIdHex === 1 || chainIdHex === '1';

                if (!onMainnet) {
                  console.warn('Not on mainnet, falling back to RPC');
                  mode = null;
                } else {
                  await curveInstance.init('Web3', { externalProvider, chainId: 1 }, { gasPrice: 0 });
                  mode = 'web3';
                }
              } catch (err) {
                console.warn('Web3 initialization failed, falling back to RPC:', err.message);
                mode = null;
              }
            }
          }
          
          // Fallback to RPC mode if wallet not connected or Web3 init failed
          if (!mode) {
            const rpcUrl = import.meta.env.VITE_MAINNET_RPC_URL || 'https://mainnet.infura.io/v3/2dd1a437f34141deb299352ba4bbd0e2';
            await curveInstance.init('JsonRpc', { url: rpcUrl, chainId: 1 }, { gasPrice: 0 });
            mode = 'rpc';
          }

          if (!mounted) return;
          setCurve(curveInstance);

          await Promise.all([
            curveInstance.factory.fetchPools().catch(() => {}),
            curveInstance.tricryptoFactory.fetchPools().catch(() => {}),
            curveInstance.stableNgFactory.fetchPools().catch(() => {}),
          ]);

          const poolInstance = curveInstance.getPool(poolId);
          
          if (!poolInstance) {
            throw new Error(`Pool ${poolId} not found`);
          }

          if (!mounted) return;
          setPool(poolInstance);

          const [pd, wd] = await Promise.all([
            getPoolDetails(poolInstance),
            getWalletDetails(poolInstance, mode === 'web3' ? externalProvider : null),
          ]);

          if (!mounted) return;

          if (!pd) {
            throw new Error('Failed to fetch pool details');
          }

          setPoolData(pd);
          setWalletData(wd);

          return { success: true };
        })();

        await Promise.race([initPromise, timeoutPromise]);

        if (timeoutId) clearTimeout(timeoutId);

        if (!mounted) return;

        setStatus({
          loading: false,
          error: null,
          lastUpdated: Date.now(),
        });

        console.log('✅ Curve pool initialized successfully');

      } catch (err) {
        console.error('❌ Pool initialization failed:', err.message);
        if (timeoutId) clearTimeout(timeoutId);
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
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [poolId, isConnected, getWalletConnectProvider]);

  const value = useMemo(
    () => ({ curve, pool, poolData, walletData, status }),
    [curve, pool, poolData, walletData, status]
  );

  return <PoolContext.Provider value={value}>{children}</PoolContext.Provider>;
}

export function usePool() {
  const ctx = useContext(PoolContext);
  if (!ctx) throw new Error('usePool must be used inside <PoolProvider>');
  return ctx;
}
