// Utility lato pool. Tenta di usare le API Curve; se non disponibili, solleva e farà fallback il provider.
export async function getPoolDetails(pool) {
  // Nota: le API esatte possono variare; qui uso chiamate conservative e try/catch.
  try {
    // Alcuni pool espongono proprietà note attraverso curve pool instance.
    // Se non disponibili, lancia per attivare il fallback mock del provider.
    const name = pool?.name || 'Curve Pool';

    // Alcuni metodi comuni (potrebbero non esistere in tutte le versioni):
    // virtual price
    let virtualPrice = null;
    try {
      virtualPrice = await pool.stats.virtualPrice();
      if (typeof virtualPrice === 'object' && virtualPrice?.toString) {
        virtualPrice = Number(virtualPrice.toString());
      } else {
        virtualPrice = Number(virtualPrice);
      }
    } catch {}

    // TVL e volume
    let tvl = null;
    let volume24h = null;
    try {
      if (pool.stats?.tvl) {
        tvl = await pool.stats.tvl();
      }
      if (pool.stats?.volume) {
        const vol = await pool.stats.volume(); // spesso ritorna { day, week } o simile
        volume24h = Number(vol?.day ?? vol?.daily ?? vol ?? 0);
      }
    } catch {}

    // Fee
    let fee = null;
    let daoFee = null;
    try {
      if (pool.stats?.fees) {
        const f = await pool.stats.fees();
        fee = Number(f?.swapFee ?? f?.fee ?? null);
        daoFee = Number(f?.adminFee ?? f?.daoFee ?? null);
      }
    } catch {}

    // VAPY stimata
    let vapyDaily = null;
    let vapyWeekly = null;
    try {
      if (pool.stats?.apy) {
        const apy = await pool.stats.apy(); // spesso { day, week } o array
        vapyDaily = Number(apy?.day ?? apy?.daily ?? null);
        vapyWeekly = Number(apy?.week ?? apy?.weekly ?? null);
      }
    } catch {}

    // Token breakdown
    let tokens = [];
    try {
      if (pool.coins) {
        const symbols = await pool.coins.symbols();
        const balances = await pool.coins.balances();
        const prices = await pool.coins.prices();
        const totalUsd =
          balances?.reduce((acc, b, i) => acc + Number(b) * Number(prices?.[i] ?? 1), 0) || 0;

        tokens = symbols.map((sym, i) => {
          const amount = Number(balances?.[i] ?? 0);
          const price = Number(prices?.[i] ?? 1);
          const usd = amount * price;
          const percentage = totalUsd > 0 ? (usd / totalUsd) * 100 : 0;
          return { symbol: sym, price, amount, percentage: Number(percentage.toFixed(2)) };
        });
      }
    } catch {}

    // Stake info generica
    let totalLPTokensStaked = null;
    let stakedPercent = null;
    let liquidityUtilization = null;

    // In molte integrazioni servono chiamate al gauge. Qui lasciamo null se non disponibili.
    // L'UI regge valori null, oppure verrà sostituita da mock dal Provider.

    return {
      name,
      stats: {
        usdTotal: tvl != null ? Number(tvl) : null,
        dailyUSDVolume: volume24h != null ? Number(volume24h) : null,
        totalLPTokensStaked:
          totalLPTokensStaked != null ? Number(totalLPTokensStaked) : null,
        stakedPercent: stakedPercent != null ? Number(stakedPercent) : null,
        liquidityUtilization:
          liquidityUtilization != null ? Number(liquidityUtilization) : null,
      },
      fees: {
        fee: fee != null ? Number(fee) : null,
        daoFee: daoFee != null ? Number(daoFee) : null,
        virtualPrice: virtualPrice != null ? Number(virtualPrice) : null,
      },
      vapy: {
        daily: vapyDaily != null ? Number(vapyDaily) : null,
        weekly: vapyWeekly != null ? Number(vapyWeekly) : null,
      },
      contracts: {
        poolAddress: pool?.address || null,
        gaugeAddress: pool?.gauge?.address || null,
      },
      tokens,
    };
  } catch (e) {
    // Permette al provider di usare i mock
    throw e;
  }
}
