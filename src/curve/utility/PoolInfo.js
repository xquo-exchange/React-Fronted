// src/curve/PoolInfo.js

function safe(fn, fallback = null) { 
  try { return fn(); } catch { return fallback; } 
}

function num(x) {
  if (x == null) return null;
  if (typeof x === 'object' && x.toString) x = x.toString();
  if (typeof x === 'string') x = x.replace(/[%\s,]+/g, '');
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

export async function getPoolDetails(pool) {
  try {
    // Basic info
    const name = safe(() => pool.name, 'Curve Pool');
    const poolAddress = safe(() => pool.address, null);
    const gaugeAddress = safe(() => pool.gauge?.address, null);

    let tvl = null;
    let volume24h = null;
    let apyDaily = null;
    let apyWeekly = null;
    let tokens = [];

    // Get TVL
    if (pool.stats && typeof pool.stats.totalLiquidity === 'function') {
      tvl = num(await pool.stats.totalLiquidity());
    }

    // Get Volume
    if (pool.stats && typeof pool.stats.volume === 'function') {
      const result = await pool.stats.volume();
      if (result && typeof result === 'object') {
        volume24h = num(result.day || result.daily || result['24h']);
      } else {
        volume24h = num(result);
      }
    }

    // Get APY
    if (pool.stats && typeof pool.stats.baseApy === 'function') {
      const result = await pool.stats.baseApy();
      if (result && typeof result === 'object') {
        apyDaily = num(result.day);
        apyWeekly = num(result.week);
      } else {
        const apyValue = num(result);
        if (apyValue) {
          apyDaily = apyValue / 365;
          apyWeekly = (apyValue / 365) * 7;
        }
      }
    }

    // Get tokens
    if (pool.underlyingCoins && Array.isArray(pool.underlyingCoins)) {
      let balances = [];
      let prices = [];

      try {
        balances = (await pool.stats.underlyingBalances()).map(b => num(b));
      } catch {}

      try {
        if (pool.underlyingCoinPrices && Array.isArray(pool.underlyingCoinPrices)) {
          prices = pool.underlyingCoinPrices.map(p => num(p));
        } else if (typeof pool.underlyingCoinPrices === 'function') {
          prices = (await pool.underlyingCoinPrices()).map(p => num(p));
        }
      } catch {}

      const totalValue = balances.reduce((sum, bal, i) => {
        return sum + (bal || 0) * (prices[i] || 1);
      }, 0);

      tokens = pool.underlyingCoins.map((symbol, i) => ({
        symbol,
        price: prices[i] || 1,
        amount: balances[i] || (tvl ? tvl / pool.underlyingCoins.length : 0),
        percentage: totalValue > 0 
          ? +((balances[i] || 0) / totalValue * 100).toFixed(2)
          : +(100 / pool.underlyingCoins.length).toFixed(2)
      }));
    }

    // Get fees and parameters
    let fee = null;
    let adminFee = null;
    let virtualPrice = null;

    if (pool.stats && typeof pool.stats.parameters === 'function') {
      const params = await pool.stats.parameters();
      if (params) {
        fee = num(params.fee);
        adminFee = num(params.admin_fee || params.adminFee);
        virtualPrice = num(params.virtual_price || params.virtualPrice);
      }
    }

    // Fallback fee methods
    if (fee === null || adminFee === null) {
      if (typeof pool.fee === 'function') {
        fee = num(await pool.fee()) / 10000000000;
      }
      if (typeof pool.adminFee === 'function') {
        adminFee = num(await pool.adminFee()) / 10000000000;
      }
    }

    // Fallback virtual price
    if (virtualPrice === null) {
      if (typeof pool.get_virtual_price === 'function') {
        virtualPrice = num(await pool.get_virtual_price()) / 1e18;
      } else if (typeof pool.virtualPrice === 'function') {
        virtualPrice = num(await pool.virtualPrice()) / 1e18;
      }
    }

    return {
      name,
      stats: {
        usdTotal: tvl || 0,
        dailyUSDVolume: volume24h || 0,
        totalLPTokensStaked: 0,
        stakedPercent: 0,
        liquidityUtilization: volume24h && tvl ? +((volume24h / tvl) * 100).toFixed(2) : 0,
      },
      fees: { 
        fee: fee || 0, 
        daoFee: adminFee || 0, 
        virtualPrice: virtualPrice || 1.0
      },
      vapy: { 
        daily: apyDaily || 0, 
        weekly: apyWeekly || 0
      },
      contracts: { poolAddress, gaugeAddress },
      tokens: tokens.length > 0 ? tokens : [],
    };
  } catch (error) {
    console.error('❌ Pool details fetch failed:', error.message);
    throw error;
  }
}
