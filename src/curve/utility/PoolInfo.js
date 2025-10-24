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
    // Check if pool is ready
    if (!pool) {
      throw new Error('Pool instance is not available');
    }

    // Basic info
    const name = safe(() => pool.name, 'Curve Pool');
    const poolAddress = safe(() => pool.address, null);
    const gaugeAddress = safe(() => pool.gauge?.address, null);

    let tvl = null;
    let volume24h = null;
    let apyDaily = null;
    let apyWeekly = null;
    let tokens = [];

    // Get TVL - Check if pool.stats exists and has the method
    if (pool.stats && typeof pool.stats.totalLiquidity === 'function') {
      try {
        tvl = num(await pool.stats.totalLiquidity());
      } catch (e) {
        console.warn('⚠️ Could not fetch TVL:', e.message);
      }
    }

    // Get Volume - Handle missing pool.stats
    if (pool.stats && typeof pool.stats.volume === 'function') {
      try {
        const result = await pool.stats.volume();
        if (result && typeof result === 'object') {
          volume24h = num(result.day || result.daily || result['24h']);
        } else {
          volume24h = num(result);
        }
      } catch (e) {
        console.warn('⚠️ Could not fetch volume:', e.message);
      }
    }

    // Get APY - Handle missing pool.stats
    if (pool.stats && typeof pool.stats.baseApy === 'function') {
      try {
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
      } catch (e) {
        console.warn('⚠️ Could not fetch APY:', e.message);
      }
    }

    // Get tokens
    if (pool.underlyingCoins && Array.isArray(pool.underlyingCoins)) {
      let balances = [];
      let prices = [];

      // Try to get balances if stats available
      if (pool.stats && typeof pool.stats.underlyingBalances === 'function') {
        try {
          balances = (await pool.stats.underlyingBalances()).map(b => num(b));
        } catch (e) {
          console.warn('⚠️ Could not fetch balances:', e.message);
        }
      }

      // Try to get prices
      try {
        if (pool.underlyingCoinPrices && Array.isArray(pool.underlyingCoinPrices)) {
          prices = pool.underlyingCoinPrices.map(p => num(p));
        } else if (typeof pool.underlyingCoinPrices === 'function') {
          prices = (await pool.underlyingCoinPrices()).map(p => num(p));
        }
      } catch (e) {
        console.warn('⚠️ Could not fetch prices:', e.message);
      }

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

    // Try parameters method first (if pool.stats available)
    if (pool.stats && typeof pool.stats.parameters === 'function') {
      try {
        const params = await pool.stats.parameters();
        if (params) {
          fee = num(params.fee);
          adminFee = num(params.admin_fee || params.adminFee);
          virtualPrice = num(params.virtual_price || params.virtualPrice);
        }
      } catch (e) {
        console.warn('⚠️ Could not fetch parameters from stats:', e.message);
      }
    }

    // Fallback fee methods (if stats method didn't work)
    if (fee === null || adminFee === null) {
      if (typeof pool.fee === 'function') {
        try {
          fee = num(await pool.fee()) / 10000000000;
        } catch (e) {
          console.warn('⚠️ Could not fetch fee:', e.message);
        }
      }
      if (typeof pool.adminFee === 'function') {
        try {
          adminFee = num(await pool.adminFee()) / 10000000000;
        } catch (e) {
          console.warn('⚠️ Could not fetch admin fee:', e.message);
        }
      }
    }

    // Fallback virtual price
    if (virtualPrice === null) {
      if (typeof pool.get_virtual_price === 'function') {
        try {
          virtualPrice = num(await pool.get_virtual_price()) / 1e18;
        } catch (e) {
          console.warn('⚠️ Could not fetch virtual price via get_virtual_price:', e.message);
        }
      } else if (typeof pool.virtualPrice === 'function') {
        try {
          virtualPrice = num(await pool.virtualPrice()) / 1e18;
        } catch (e) {
          console.warn('⚠️ Could not fetch virtual price via virtualPrice:', e.message);
        }
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
