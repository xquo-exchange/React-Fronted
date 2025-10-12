import { ethers } from 'ethers';

// Raccoglie info base sul wallet rispetto al pool; in assenza di ABI specifici, ritorna dati minimi.
// Il provider farà fallback a mock se qualcosa fallisce.
export async function getWalletDetails(pool, externalProvider) {
  const provider = new ethers.BrowserProvider(externalProvider);
  const signer = await provider.getSigner();
  const address = await signer.getAddress();

  // Qui puoi arricchire con letture su LP balance e gauge se hai ABI specifiche.
  // Manteniamo conservative: chiediamo eventuale lpToken dal pool.
  let lpSymbol = 'LP';
  let lpBalance = 0;
  try {
    if (pool?.lpToken) {
      lpSymbol = (await pool.lpToken.symbol()) || lpSymbol;
      const raw = await pool.lpToken.balanceOf(address);
      lpBalance = Number(ethers.formatUnits(raw, await pool.lpToken.decimals?.() ?? 18));
    }
  } catch {}

  // Staked amount tramite gauge se disponibile
  let stakedAmount = 0;
  try {
    if (pool?.gauge) {
      const raw = await pool.gauge.balanceOf(address);
      stakedAmount = Number(ethers.formatUnits(raw, await pool.gauge.decimals?.() ?? 18));
    }
  } catch {}

  const unstakedAmount = Math.max(lpBalance - stakedAmount, 0);
  const usdBalance = null; // richiede pricing; lasciamo null, l’UI lo gestisce

  return {
    address,
    tokenBalances: [{ symbol: `${lpSymbol}`, amount: lpBalance, usd: null }],
    stakedAmount,
    unstakedAmount,
    usdBalance,
    depositShare: null,
  };
}
