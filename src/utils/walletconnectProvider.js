import { EthereumProvider } from "@walletconnect/ethereum-provider";

const PROJECT_ID = "88686807816516c396fdf733fd957d95";

// Singleton to prevent duplicate initialization
let cachedProvider = null;

// Silent reconnect - checks for existing session without showing QR modal
export async function reconnectWalletConnect() {
  if (cachedProvider) {
    console.log('🔄 Using cached WalletConnect provider');
    return cachedProvider;
  }

  try {
    console.log('🔄 Attempting silent WalletConnect reconnect...');
    const provider = await EthereumProvider.init({
      projectId: PROJECT_ID,
      chains: [1],
      showQrModal: false, // Don't show modal on reconnect
      methods: [
        "eth_sendTransaction",
        "eth_signTransaction",
        "eth_sign",
        "personal_sign",
        "eth_signTypedData",
      ],
      events: ["chainChanged", "accountsChanged"],
      metadata: {
        name: "X-QUO",
        description: "X-QUO DeFi Trading and Staking Platform",
        url: window.location.origin,
        icons: [`${window.location.origin}/src/assets/x-quo_icon.png`],
      },
    });

    // Check if there's an existing session
    if (provider.session) {
      console.log('✅ Found existing WalletConnect session');
      await provider.enable();
      cachedProvider = provider;
      return provider;
    }

    console.log('❌ No existing WalletConnect session found');
    return null;
  } catch (error) {
    console.error('❌ Silent reconnect failed:', error);
    return null;
  }
}

// User-initiated connect - shows QR modal
export async function initWalletConnect() {
  if (cachedProvider) {
    console.log('🔄 Using cached WalletConnect provider');
    return cachedProvider;
  }

  console.log('🔄 Initializing WalletConnect with QR modal...');
  const provider = await EthereumProvider.init({
    projectId: PROJECT_ID,
    chains: [1], // Ethereum mainnet
    showQrModal: true, // Show modal for new connection
    methods: [
      "eth_sendTransaction",
      "eth_signTransaction",
      "eth_sign",
      "personal_sign",
      "eth_signTypedData",
    ],
    events: ["chainChanged", "accountsChanged"],
    metadata: {
      name: "X-QUO",
      description: "X-QUO DeFi Trading and Staking Platform",
      url: window.location.origin,
      icons: [`${window.location.origin}/src/assets/x-quo_icon.png`],
    },
  });

  await provider.enable();
  cachedProvider = provider;
  return provider;
}

// Clear cached provider on disconnect
export function clearCachedProvider() {
  console.log('🧹 Clearing cached WalletConnect provider');
  cachedProvider = null;
}

