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

    async function init() {
      try {
        console.log('🔄 PoolContext: Starting initialization...');
        setStatus({ loading: true, error: null, lastUpdated: null });

        // Load Curve API
        console.log('🔄 PoolContext: Loading Curve API...');
        const curveModule = await import('@curvefi/api');
        const curveInstance = curveModule.default;

        if (!curveInstance) {
          throw new Error('Failed to load Curve API');
        }

        // Initialize Curve
        console.log('🔄 PoolContext: Initializing Curve...');
        let mode = null;
        let externalProvider = null;

        // Try WalletConnect first if connected
        if (isConnected) {
          console.log('🔄 PoolContext: Wallet connected, trying WalletConnect mode...');
          externalProvider = getWalletConnectProvider();
          
          if (externalProvider) {
            try {
              // Check if we're on mainnet
              const chainIdHex = await externalProvider.request?.({ method: 'eth_chainId' }).catch(() => null);
              const onMainnet = chainIdHex === '0x1' || chainIdHex === 1 || chainIdHex === '1';

              if (!onMainnet) {
                throw new Error('Please switch to Ethereum Mainnet');
              }

              // Initialize with WalletConnect provider
              await curveInstance.init('Web3', { externalProvider, chainId: 1 }, { gasPrice: 0 });
              mode = 'web3';
              console.log('✅ PoolContext: WalletConnect mode initialized');
            } catch (err) {
              console.warn('⚠️ PoolContext: WalletConnect initialization failed, falling back to RPC:', err.message);
              mode = null;
            }
          }
        }

        // Fallback to RPC mode with multiple endpoints
        if (!mode) {
          console.log('🔄 PoolContext: Using RPC mode...');
          
          const rpcUrls = [
            'https://rpc.ankr.com/eth/8d154b0d09bc26ed179344de000e32fbad099ef3ea203b572ba8450d87b376dd',
            'https://mainnet.infura.io/v3/2dd1a437f34141deb299352ba4bbd0e2',
            'https://ethereum.publicnode.com',
            'https://eth.llamarpc.com'
          ];
          
          let rpcSuccess = false;
          for (const rpcUrl of rpcUrls) {
            try {
              console.log(`🔄 PoolContext: Trying RPC: ${rpcUrl.substring(0, 50)}...`);
              await curveInstance.init('JsonRpc', { url: rpcUrl, chainId: 1 }, { gasPrice: 0 });
              mode = 'rpc';
              rpcSuccess = true;
              console.log(`✅ PoolContext: RPC mode initialized with ${rpcUrl.substring(0, 50)}...`);
              break;
            } catch (err) {
              console.warn(`⚠️ PoolContext: RPC failed for ${rpcUrl.substring(0, 50)}...:`, err.message);
              continue;
            }
          }
          
          if (!rpcSuccess) {
            throw new Error('All RPC endpoints failed');
          }
        }

        if (!mounted) return;
        setCurve(curveInstance);

        // Fetch pools (don't fail if this doesn't work)
        console.log('🔄 PoolContext: Fetching pools...');
        try {
          await Promise.all([
            curveInstance.factory.fetchPools().catch(() => console.warn('Factory pools fetch failed')),
            curveInstance.tricryptoFactory.fetchPools().catch(() => console.warn('Tricrypto pools fetch failed')),
            curveInstance.stableNgFactory.fetchPools().catch(() => console.warn('StableNG pools fetch failed')),
          ]);
          console.log('✅ Pool fetching completed');
        } catch (err) {
          console.warn('⚠️ Pool fetching had issues, but continuing:', err.message);
        }

        // Get pool instance
        console.log('🔄 PoolContext: Getting pool instance...');
        const poolInstance = curveInstance.getPool(poolId);
        
        if (!poolInstance) {
          throw new Error(`Pool ${poolId} not found`);
        }

        if (!mounted) return;
        setPool(poolInstance);

        // Fetch pool and wallet details
        console.log('🔄 PoolContext: Fetching pool and wallet details...');
        
        const [pd, wd] = await Promise.all([
          getPoolDetails(poolInstance).catch(err => {
            console.warn('⚠️ Pool details fetch failed:', err.message);
            return null;
          }),
          getWalletDetails(poolInstance, mode === 'web3' ? externalProvider : null).catch(err => {
            console.warn('⚠️ Wallet details fetch failed:', err.message);
            return null;
          }),
        ]);

        if (!mounted) return;

        setPoolData(pd);
        setWalletData(wd);
        setStatus({
          loading: false,
          error: null,
          lastUpdated: Date.now(),
        });

        console.log('✅ PoolContext: Curve pool initialized successfully');
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
  }, [isConnected, getWalletConnectProvider, poolId]);

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