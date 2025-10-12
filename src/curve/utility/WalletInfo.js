// src/curve/WalletInfo.js
import { ethers } from 'ethers';

/**
 * Compatibilità v5/v6 di ethers
 */
const hasV6 = !!ethers.BrowserProvider;
const formatUnits = hasV6 ? ethers.formatUnits : ethers.utils.formatUnits;

/**
 * Provider factory: BrowserProvider (v6) o Web3Provider (v5)
 */
function makeProvider(externalProvider) {
  if (!externalProvider) return null;
  return hasV6
    ? new ethers.BrowserProvider(externalProvider)
    : new ethers.providers.Web3Provider(externalProvider);
}

/**
 * ABI minima ERC20 per balance/allowance/decimals/symbol
 */
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
];

/**
 * Helper sicuri e conversione numerica
 */
function safe(fn) { try { return fn(); } catch { return null; } }
function num(x) {
  if (x == null) return null;
  if (typeof x === 'object' && x.toString) x = x.toString();
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

/**
 * Dettagli wallet + contracts user-specific
 * - Se externalProvider è nullo: ritorna solo dati statici, niente letture utente
 */
export async function getWalletDetails(pool, externalProvider) {
  // Indirizzi base dal pool (best-effort, dipende dalla lib @curvefi/api in uso)
  const poolAddress  = safe(() => pool.address) || null;
  const gaugeAddress = safe(() => pool.gauge.address) || null;
  const lpTokenAddress =
    safe(() => pool.lpToken.address) ||
    safe(() => pool.lpToken) || // alcuni wrapper espongono address direttamente
    null;

  // Se non abbiamo provider (modalità RPC read-only o nessun wallet), ritorniamo dati minimi
  const provider = makeProvider(externalProvider);
  if (!provider) {
    return {
      address: null,
      tokenBalances: [],
      stakedAmount: 0,
      unstakedAmount: 0,
      usdBalance: null,
      depositShare: null,
      contracts: {
        lpTokenAddress,
        poolAddress,
        gaugeAddress,
        lpDecimals: null,
        allowanceToPool: null,
        allowanceToGauge: null,
        needsPoolApproval: null,
        needsGaugeApproval: null,
      },
    };
  }

  // Signer + address utente
  const signer = hasV6 ? await provider.getSigner() : provider.getSigner();
  const address = await signer.getAddress();

  // Letture LP token
  let lpSymbol = 'LP';
  let lpDecimals = 18;
  let lpBalance = 0;

  if (lpTokenAddress) {
    const lp = new (hasV6 ? ethers.Contract : ethers.Contract)(lpTokenAddress, ERC20_ABI, provider);
    try { lpSymbol = await lp.symbol(); } catch {}
    try { lpDecimals = await lp.decimals(); } catch {}
    try {
      const raw = await lp.balanceOf(address);
      lpBalance = Number(formatUnits(raw, lpDecimals));
    } catch {}
  }

  // Lettura staked sulla gauge (molte gauge espongono balanceOf stile ERC20)
  let stakedAmount = 0;
  if (gaugeAddress) {
    const gaugeLike = new (hasV6 ? ethers.Contract : ethers.Contract)(gaugeAddress, ERC20_ABI, provider);
    try {
      const raw = await gaugeLike.balanceOf(address);
      stakedAmount = Number(formatUnits(raw, lpDecimals));
    } catch {}
  }

  const unstakedAmount = Math.max(lpBalance - stakedAmount, 0);

  // Allowance LP -> Pool e LP -> Gauge
  let allowanceToPool = null;
  let allowanceToGauge = null;

  if (lpTokenAddress) {
    const lp = new (hasV6 ? ethers.Contract : ethers.Contract)(lpTokenAddress, ERC20_ABI, provider);
    try {
      if (poolAddress) {
        const raw = await lp.allowance(address, poolAddress);
        allowanceToPool = Number(formatUnits(raw, lpDecimals));
      }
    } catch {}
    try {
      if (gaugeAddress) {
        const raw = await lp.allowance(address, gaugeAddress);
        allowanceToGauge = Number(formatUnits(raw, lpDecimals));
      }
    } catch {}
  }

  // Soglia minimale per dire "serve approval"
  const needsPoolApproval  = allowanceToPool  != null ? allowanceToPool  < 0.000001 : null;
  const needsGaugeApproval = allowanceToGauge != null ? allowanceToGauge < 0.000001 : null;

  return {
    address,
    tokenBalances: [{ symbol: lpSymbol, amount: lpBalance, usd: null }],
    stakedAmount,
    unstakedAmount,
    usdBalance: null,
    depositShare: null,
    contracts: {
      lpTokenAddress,
      poolAddress,
      gaugeAddress,
      lpDecimals,
      allowanceToPool,
      allowanceToGauge,
      needsPoolApproval,
      needsGaugeApproval,
    },
  };
}
