// src/contexts/PoolContext.jsx
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getPoolDetails } from '../curve/utility/PoolInfo.js';
import { getWalletDetails } from '../curve/utility/WalletInfo.js';



// Lazy load per la lib Curve
let curveLib = null;

const PoolContext = createContext(null);

export function PoolProvider({ children, poolId = 'crvusd-usdc-factory-431' }) {
  const [curve, setCurve] = useState(null);
  const [pool, setPool] = useState(null);
  const [poolData, setPoolData] = useState(null);
  const [walletData, setWalletData] = useState(null);
  const [status, setStatus] = useState({
    loading: true,
    error: null,
    isMock: true,
    lastUpdated: null,
  });

  useEffect(() => {
  let mounted = true;

  async function init() {
    try {
      setStatus({ loading: true, error: null, isMock: true, lastUpdated: null });

      // 1) Scegliamo la modalità di init: Web3 (wallet) o JsonRpc (readonly)
      if (!curveLib) {
        const mod = await import('@curvefi/api');
        curveLib = mod;
      }
      const { curve } = curveLib;

      const rpcUrl = import.meta.env.VITE_MAINNET_RPC_URL; // opzionale, per readonly
      let mode = null;

      if (typeof window !== 'undefined' && window.ethereum) {
        // chiedi account e controlla rete
        try {
          await window.ethereum.request?.({ method: 'eth_requestAccounts' });
        } catch {}
        const chainIdHex = await window.ethereum.request?.({ method: 'eth_chainId' }).catch(() => null);
        const onMainnet = chainIdHex === '0x1' || chainIdHex === 1 || chainIdHex === '1';

        if (!onMainnet) {
          throw new Error('Wallet non su Ethereum Mainnet. Cambia rete e ricarica.');
        }

        console.time?.('[curve] init(Web3)');
        await curve.init('Web3', { externalProvider: window.ethereum, chainId: 1 }, { gasPrice: 0 });
        console.timeEnd?.('[curve] init(Web3)');
        mode = 'web3';
      } else if (rpcUrl) {
        // Read-only senza wallet
        console.time?.('[curve] init(JsonRpc)');
        await curve.init('JsonRpc', { url: rpcUrl, chainId: 1 }, { gasPrice: 0 });
        console.timeEnd?.('[curve] init(JsonRpc)');
        mode = 'rpc';
      } else {
        throw new Error('Nessun wallet e nessun RPC: definisci VITE_MAINNET_RPC_URL o connetti un wallet.');
      }

      if (!mounted) return;
      setCurve(curve);

      // 2) Recupero pool
      console.time?.('[curve] getPool');
      const poolInstance = await curve.getPool(poolId);
      console.timeEnd?.('[curve] getPool');
      if (!mounted) return;

      setPool(poolInstance);

      // 3) Letture pool+wallet in parallelo
      console.time?.('[details] pool + wallet');
      const [pd, wd] = await Promise.all([
        getPoolDetails(poolInstance).catch((e) => {
          console.error('PoolDetails error:', e);
          return null;
        }),
        // in modalità rpc non abbiamo signer, passiamo null e lasciamo i campi utente a —
        getWalletDetails(poolInstance, mode === 'web3' ? window.ethereum : null).catch((e) => {
          console.error('WalletDetails error:', e);
          return null;
        }),
      ]);
      console.timeEnd?.('[details] pool + wallet');

      if (!mounted) return;

      const finalPD = pd || mockPoolDetails();
      const finalWD = wd || mockWalletDetails();

      setPoolData(finalPD);
      setWalletData(finalWD);

      const isMock = Boolean(finalPD.__mock || finalWD.__mock);
      const lastUpdated = Date.now();
      setStatus({
        loading: false,
        error: !pd || (mode === 'web3' && !wd) ? 'Dati parziali: verifica poolId, rete, permessi wallet.' : null,
        isMock,
        lastUpdated,
      });

      window.__POOL_DEBUG__ = {
        mode,
        pd: finalPD,
        wd: finalWD,
        status: { loading: false, isMock, lastUpdated },
      };
    } catch (err) {
      console.error('[PoolProvider] error:', err);
      if (!mounted) return;

      const mpd = mockPoolDetails();
      const mwd = mockWalletDetails();
      setPoolData(mpd);
      setWalletData(mwd);

      const lastUpdated = Date.now();
      setStatus({
        loading: false,
        error: err.message || 'Errore sconosciuto in init',
        isMock: true,
        lastUpdated,
      });

      window.__POOL_DEBUG__ = { pd: mpd, wd: mwd, status: { loading: false, isMock: true, lastUpdated } };
    }
  }

  init();
  return () => { mounted = false; };
}, [poolId]);


  const value = useMemo(
    () => ({ curve, pool, poolData, walletData, status }),
    [curve, pool, poolData, walletData, status]
  );

  return <PoolContext.Provider value={value}>{children}</PoolContext.Provider>;
}

export function usePool() {
  const ctx = useContext(PoolContext);
  if (!ctx) throw new Error('usePool deve essere usato dentro <PoolProvider>.');
  return ctx;
}

// --------- MOCK DI FALLBACK ----------
function mockPoolDetails() {
  return {
    __mock: true,
    name: 'Curve USD <> USDC',
    stats: {
      usdTotal: 12450000,
      dailyUSDVolume: 985000,
      totalLPTokensStaked: 4200000,
      stakedPercent: 62.4,
      liquidityUtilization: 41.7,
    },
    fees: { fee: 0.04, daoFee: 0.01, virtualPrice: 1.0042 },
    vapy: { daily: 0.07, weekly: 0.51 },
    contracts: { poolAddress: '0xPoolAddress...', gaugeAddress: '0xGaugeAddress...' },
    tokens: [
      { symbol: 'crvUSD', price: 1.0, amount: 6200000, percentage: 49.8 },
      { symbol: 'USDC', price: 1.0, amount: 6250000, percentage: 50.2 },
    ],
  };
}

function mockWalletDetails() {
  return {
    __mock: true,
    address: '0xYourWallet...',
    tokenBalances: [{ symbol: 'LP-CRVUSD/USDC', amount: 1234.56, usd: 1240.1 }],
    stakedAmount: 950.12,
    unstakedAmount: 284.44,
    usdBalance: 1860.2,
    depositShare: 0.0031,
    contracts: {
      lpTokenAddress: null,
      poolAddress: null,
      gaugeAddress: null,
      allowanceToPool: null,
      allowanceToGauge: null,
      needsPoolApproval: null,
      needsGaugeApproval: null,
    },
  };
}
