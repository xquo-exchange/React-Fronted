// src/curve/PoolInfo.js

// helper: non lancia mai
function safe(fn, fallback = null) { try { return fn(); } catch { return fallback; } }
function num(x) {
  if (x == null) return null;
  if (typeof x === 'object' && x.toString) x = x.toString();
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

export async function getPoolDetails(pool) {
  // base sempre presente
  const name = safe(() => pool.name, 'Curve Pool');
  const poolAddress = safe(() => pool.address, null);
  const gaugeAddress = safe(() => pool.gauge.address, null);

  // KPI: best-effort con mille fallback, mai throw
  let virtualPrice = null, tvl = null, volume24h = null, fee = null, daoFee = null;
  let vapyDaily = null, vapyWeekly = null;
  let tokens = [];

  // virtual price
  try {
    virtualPrice = await safe(() => pool.stats.virtualPrice(), null);
    virtualPrice = num(virtualPrice);
  } catch {}

  // tvl + volume (ogni lib ha api diverse, proviamo vari metodi)
  try {
    // TVL
    if (!tvl && safe(() => pool.stats.tvl)) tvl = num(await pool.stats.tvl());
    if (!tvl && safe(() => pool.stats.totalUsd)) tvl = num(await pool.stats.totalUsd());

    // Volume 24h
    if (safe(() => pool.stats.volume)) {
      const vol = await pool.stats.volume();
      volume24h = num(vol?.day ?? vol?.daily ?? vol?.['24h'] ?? vol);
    }
  } catch {}

  // fees
  try {
    if (safe(() => pool.stats.fees)) {
      const f = await pool.stats.fees();
      fee = num(f?.swapFee ?? f?.fee);
      daoFee = num(f?.adminFee ?? f?.daoFee);
    }
  } catch {}

  // APY/VAPY
  try {
    if (safe(() => pool.stats.apy)) {
      const apy = await pool.stats.apy();
      vapyDaily = num(apy?.day ?? apy?.daily);
      vapyWeekly = num(apy?.week ?? apy?.weekly);
    }
  } catch {}

  // breakdown token (tanti wrapper diversi: symbols/balances/prices)
  try {
    const symbols = (await safe(() => pool.coins.symbols(), null)) || (await safe(() => pool.coins.getSymbols(), null)) || [];
    const balances = (await safe(() => pool.coins.balances(), null)) || (await safe(() => pool.coins.getBalances(), null)) || [];
    const prices = (await safe(() => pool.coins.prices(), null)) || (await safe(() => pool.coins.getPrices(), null)) || [];

    const totalUsd = (balances || []).reduce((acc, b, i) => acc + (num(b) || 0) * (num(prices?.[i]) || 1), 0);
    tokens = symbols.map((sym, i) => {
      const amount = num(balances?.[i]) || 0;
      const price = num(prices?.[i]) ?? 1;
      const usd = amount * price;
      const percentage = totalUsd > 0 ? +(usd / totalUsd * 100).toFixed(2) : null;
      return { symbol: sym, price, amount, percentage };
    });
  } catch {}

  // restituisci SEMPRE qualcosa, senza __mock
  return {
    name,
    stats: {
      usdTotal: tvl,
      dailyUSDVolume: volume24h,
      totalLPTokensStaked: null,
      stakedPercent: null,
      liquidityUtilization: null,
    },
    fees: { fee, daoFee, virtualPrice },
    vapy: { daily: vapyDaily, weekly: vapyWeekly },
    contracts: { poolAddress, gaugeAddress },
    tokens,
  };
}
