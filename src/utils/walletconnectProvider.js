import { EthereumProvider } from "@walletconnect/ethereum-provider";

export async function initWalletConnect() {
  const provider = await EthereumProvider.init({
    projectId: "88686807816516c396fdf733fd957d95",
    chains: [1],
    showQrModal: true,
    metadata: {
      name: "X-QUO",
      description: "DeFi Trading and Staking Platform",
      url: window.location.origin,
      icons: [`${window.location.origin}/src/assets/x-quo_icon.png`]
    }
  });
  
  await provider.enable();
  return provider;
}