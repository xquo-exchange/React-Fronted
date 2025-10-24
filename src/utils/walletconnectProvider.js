import { EthereumProvider } from "@walletconnect/ethereum-provider";

export async function initWalletConnect() {
  try {
    console.log('🔗 WalletConnect: Initializing provider...');
    const provider = await EthereumProvider.init({
      projectId: "88686807816516c396fdf733fd957d95",
      chains: [1],
      showQrModal: true,
      qrModalOptions: {
        themeMode: "dark",
        themeVariables: {
          "--wcm-z-index": "9999"
        },
        enableExplorer: true,
        explorerRecommendedWalletIds: [
          "c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96", // MetaMask
          "4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0", // Trust Wallet
          "1ae92b26df02f0abca6304df07debccd18262fdf5fe82daa81593582dac9a369", // Rainbow
        ],
      },
      metadata: {
        name: "X-QUO",
        description: "DeFi Trading and Staking Platform",
        url: typeof window !== 'undefined' ? window.location.origin : "https://xquodev.vercel.app",
        icons: [
          typeof window !== 'undefined' 
            ? `${window.location.origin}/x-quo_icon.png`
            : "https://xquodev.vercel.app/x-quo_icon.png"
        ]
      },
      rpcMap: {
        1: "https://mainnet.infura.io/v3/2dd1a437f34141deb299352ba4bbd0e2"
      }
    });
    
    console.log('🔗 WalletConnect: Provider created, enabling connection...');
    await provider.enable();
    console.log('✅ WalletConnect: Provider enabled successfully');
    return provider;
  } catch (error) {
    console.error('❌ WalletConnect: Initialization failed -', error.message || error);
    throw error;
  }
}