import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

// Lazy import per evitare errori in ambienti senza window
let curveLib = null;

const PoolContext = createContext(null);

export function PoolProvider({ children, poolId = 'crvusd-usdc-factory-431' }) {
  const [curve, setCurve] = useState(null);
  const [pool, setPool] = useState(null);
  const [poolData, setPoolData] = useState(null);
  const [walletData, setWalletData] = useState(null);
  const [status, setStatus] = useState({ loading: true, error: null });

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        setStatus({ loading: true, error: null });

        if (typeof window === 'undefined' || !window.ethereum) {
          throw new Error('Nessun provider Ethereum disponibile (window.ethereum assente).');
        }

        if (!curveLib) {
          const mod = await import('@curvefi/api');
          curveLib = mod;
        }

        const { curve } = curveLib;

        // Inizializza Curve
        await curve.init(
          'Web3',
          { externalProvider: window.ethereum, chainId: 1 },
          { gasPrice: 0 }
        );

        if (!mounted) return;

        setCurve(curve);

        // Carica pool
        const poolInstance = await curve.getPool(poolId);
        if (!mounted) return;
        setPool(poolInstance);

        // Carica dati pool + wallet
        const [{ getPoolDetails }, { getWalletDetails }] = await Promise.all([
          import('../curve/utility/PoolInfo.js'),
          import('../curve/utility/WalletInfo.js'),
        ]);

        const [pd, wd] = await Promise.all([
          getPoolDetails(poolInstance).catch(() => null),
          getWalletDetails(poolInstance, window.ethereum).catch(() => null),
        ]);

        if (!mounted) return;

        // Fallback mock se necessario
        setPoolData(pd || mockPoolDetails());
        setWalletData(wd || mockWalletDetails());

        setStatus({ loading: false, error: null });
      } catch (err) {
        console.error('[PoolProvider] error:', err);
        if (!mounted) return;
        setStatus({ loading: false, error: err.message || 'Errore sconosciuto' });
        // Mock per permettere il rendering dell’UI
        setPoolData(mockPoolDetails());
        setWalletData(mockWalletDetails());
      }
    }

    init();
    return () => {
      mounted = false;
    };
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
    name: 'Curve USD <> USDC',
    stats: {
      usdTotal: 12_450_000,
      dailyUSDVolume: 985_000,
      totalLPTokensStaked: 4_200_000,
      stakedPercent: 62.4,
      liquidityUtilization: 41.7,
    },
    fees: {
      fee: 0.04,
      daoFee: 0.01,
      virtualPrice: 1.0042,
    },
    vapy: {
      daily: 0.07,
      weekly: 0.51,
    },
    contracts: {
      poolAddress: '0xPoolAddress...',
      gaugeAddress: '0xGaugeAddress...',
    },
    tokens: [
      { symbol: 'crvUSD', price: 1.0, amount: 6_200_000, percentage: 49.8 },
      { symbol: 'USDC', price: 1.0, amount: 6_250_000, percentage: 50.2 },
    ],
  };
}

function mockWalletDetails() {
  return {
    address: '0xYourWallet...',
    tokenBalances: [
      { symbol: 'LP-CRVUSD/USDC', amount: 1234.56, usd: 1240.1 },
    ],
    stakedAmount: 950.12,
    unstakedAmount: 284.44,
    usdBalance: 1860.2,
    depositShare: 0.0031,
  };
}
