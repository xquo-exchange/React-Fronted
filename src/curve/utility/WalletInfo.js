// src/curve/WalletInfo.js

import { ethers } from 'ethers';

const hasV6 = !!ethers.BrowserProvider;
const formatUnits = hasV6 ? ethers.formatUnits : ethers.utils.formatUnits;

function makeProvider(externalProvider) {
  if (!externalProvider) return null;
  return hasV6
    ? new ethers.BrowserProvider(externalProvider)
    : new ethers.providers.Web3Provider(externalProvider);
}

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
];

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

export async function getWalletDetails(pool, externalProvider) {
  try {
    if (!externalProvider) {
      return {
        address: null,
        tokenBalances: [],
        stakedAmount: 0,
        unstakedAmount: 0,
        usdBalance: null,
        depositShare: null,
        contracts: {
          lpTokenAddress: safe(() => pool.lpToken || pool.address, null),
          lpDecimals: 18,
          allowanceToPool: 0,
          allowanceToGauge: 0,
        },
      };
    }

    const provider = makeProvider(externalProvider);
    if (!provider) return null;

    const signer = hasV6 ? await provider.getSigner() : provider.getSigner();
    const address = await signer.getAddress();

    const lpTokenAddress = safe(() => pool.lpToken || pool.address, null);
    const gaugeAddress = safe(() => pool.gauge?.address, null);

    let unstakedAmount = 0;
    let stakedAmount = 0;
    let lpDecimals = 18;

    // Get LP token balance
    if (lpTokenAddress) {
      const lpContract = new ethers.Contract(lpTokenAddress, ERC20_ABI, provider);
      const [balanceRaw, decimalsRaw] = await Promise.all([
        lpContract.balanceOf(address),
        lpContract.decimals().catch(() => 18),
      ]);
      lpDecimals = decimalsRaw;
      unstakedAmount = num(formatUnits(balanceRaw, lpDecimals));
    }

    // Get staked amount from gauge
    if (gaugeAddress) {
      const gaugeContract = new ethers.Contract(gaugeAddress, ERC20_ABI, provider);
      const stakedRaw = await gaugeContract.balanceOf(address);
      stakedAmount = num(formatUnits(stakedRaw, lpDecimals));
    }

    const totalLpTokens = (unstakedAmount || 0) + (stakedAmount || 0);

    // Get pool data
    //let virtualPrice = 1.0;
    //let poolTVL = 0;
    let totalLPSupply = 0;

    if (pool.stats && typeof pool.stats.parameters === 'function') {
      const params = await pool.stats.parameters();
      //virtualPrice = num(params.virtualPrice || params.virtual_price) || 1.0;
      totalLPSupply = num(params.lpTokenSupply) || 0;
    }
    
    if (pool.stats && typeof pool.stats.totalLiquidity === 'function') {
      //poolTVL = await pool.stats.totalLiquidity();
    }

    let usdBalance = 0//totalLpTokens * virtualPrice;
    const depositShare = totalLPSupply > 0 ? totalLpTokens / totalLPSupply : 0;

    // Calculate token breakdown
    let tokenBalances = [];
    if (pool.underlyingCoins && Array.isArray(pool.underlyingCoins)) {
      Object.entries(await pool.wallet.wrappedCoinBalances()).forEach(([address, value], index) => {
        usdBalance += num(value)
        tokenBalances.push({ symbol: pool.underlyingCoins[index], amount: num(value) })
      });
    }

    // Get allowances
    let allowanceToPool = 0;
    let allowanceToGauge = 0;

    if (lpTokenAddress) {
      const lpContract = new ethers.Contract(lpTokenAddress, ERC20_ABI, provider);
      
      if (pool.address) {
        const allowRaw = await lpContract.allowance(address, pool.address);
        allowanceToPool = num(formatUnits(allowRaw, lpDecimals));
      }
      
      if (gaugeAddress) {
        const allowRaw = await lpContract.allowance(address, gaugeAddress);
        allowanceToGauge = num(formatUnits(allowRaw, lpDecimals));
      }
    }

    return {
      address,
      tokenBalances: tokenBalances.length > 0 ? tokenBalances : [
        { symbol: 'rUSDY-USDC', amount: totalLpTokens }
      ],
      stakedAmount: stakedAmount || 0,
      unstakedAmount: unstakedAmount || 0,
      usdBalance: usdBalance || 0,
      depositShare: depositShare || 0,
      contracts: {
        lpTokenAddress,
        lpDecimals,
        allowanceToPool: allowanceToPool || 0,
        allowanceToGauge: allowanceToGauge || 0,
      },
    };
  } catch (error) {
    console.error('❌ Wallet details fetch failed:', error.message);
    throw error;
  }
}
