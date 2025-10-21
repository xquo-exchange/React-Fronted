import React, { createContext, useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { initWalletConnect, reconnectWalletConnect, clearCachedProvider } from '../utils/walletconnectProvider';

export const WalletContext = createContext();

export const WalletProvider = ({ children }) => {
  const [walletAddress, setWalletAddress] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [provider, setProvider] = useState(null);
  const [walletConnectProvider, setWalletConnectProvider] = useState(null);
  const [chainId, setChainId] = useState(null);

  // Auto-reconnect on mount if previously connected (SILENT - no QR modal)
  useEffect(() => {
    const wasConnected = localStorage.getItem('walletConnected');
    if (wasConnected === 'true') {
      // Try silent reconnect without showing QR modal
      reconnectWalletConnect().then(async (wcProvider) => {
        if (wcProvider) {
          try {
            console.log('🔄 Restoring WalletConnect session...');
            const ethersProvider = new ethers.providers.Web3Provider(wcProvider);
            const signer = ethersProvider.getSigner();
            const address = await signer.getAddress();
            const network = await ethersProvider.getNetwork();

            setWalletConnectProvider(wcProvider);
            setProvider(ethersProvider);
            setWalletAddress(address);
            setIsConnected(true);
            setChainId(network.chainId);
            
            // Expose provider to window for other contexts
            window.walletConnectProvider = wcProvider;
            
            console.log('✅ WalletConnect session restored:', address);
          } catch (error) {
            console.error('❌ Failed to restore session:', error);
            localStorage.removeItem('walletConnected');
          }
        } else {
          // No existing session, clear localStorage
          console.log('No WalletConnect session to restore');
          localStorage.removeItem('walletConnected');
        }
      }).catch((error) => {
        console.error('❌ Silent reconnect error:', error);
        localStorage.removeItem('walletConnected');
      });
    }
  }, []);

  // Setup event listeners for WalletConnect provider
  useEffect(() => {
    if (!walletConnectProvider) return;

    const handleAccountsChanged = (accounts) => {
      console.log('Accounts changed:', accounts);
      if (accounts.length > 0) {
        setWalletAddress(accounts[0]);
        setIsConnected(true);
        localStorage.setItem('walletConnected', 'true');
      } else {
        // User disconnected
        handleDisconnect();
      }
    };

    const handleChainChanged = (chainIdHex) => {
      const newChainId = parseInt(chainIdHex, 16);
      console.log('Chain changed:', newChainId);
      setChainId(newChainId);
      // Don't reload page automatically - just update state
      // This prevents the 3x refresh loop issue
    };

    const handleDisconnect = () => {
      console.log('Wallet disconnected');
      
      // Clear singleton cached provider
      clearCachedProvider();
      
      setWalletAddress(null);
      setIsConnected(false);
      setChainId(null);
      setProvider(null);
      setWalletConnectProvider(null);
      localStorage.removeItem('walletConnected');
      
      // Clean up window reference
      if (window.walletConnectProvider) {
        delete window.walletConnectProvider;
      }
    };

    // WalletConnect event listeners
    walletConnectProvider.on('accountsChanged', handleAccountsChanged);
    walletConnectProvider.on('chainChanged', handleChainChanged);
    walletConnectProvider.on('disconnect', handleDisconnect);
    walletConnectProvider.on('session_delete', handleDisconnect);

    return () => {
      if (walletConnectProvider) {
        walletConnectProvider.removeListener('accountsChanged', handleAccountsChanged);
        walletConnectProvider.removeListener('chainChanged', handleChainChanged);
        walletConnectProvider.removeListener('disconnect', handleDisconnect);
        walletConnectProvider.removeListener('session_delete', handleDisconnect);
      }
    };
  }, [walletConnectProvider]);

  // Connect wallet
  const connectWallet = useCallback(async () => {
    setConnecting(true);
    try {
      console.log('🔄 Initializing WalletConnect...');
      
      // Initialize WalletConnect provider
      const wcProvider = await initWalletConnect();
      
      // Create ethers provider
      const ethersProvider = new ethers.providers.Web3Provider(wcProvider);
      const signer = ethersProvider.getSigner();
      const address = await signer.getAddress();
      const network = await ethersProvider.getNetwork();

      console.log('✅ WalletConnect connected:', address);

      setWalletConnectProvider(wcProvider);
      setProvider(ethersProvider);
      setWalletAddress(address);
      setIsConnected(true);
      setChainId(network.chainId);
      localStorage.setItem('walletConnected', 'true');
      
      // Expose provider to window for other contexts
      window.walletConnectProvider = wcProvider;
      
      setConnecting(false);

      return {
        success: true,
        address: address,
        chainId: network.chainId,
      };
    } catch (error) {
      console.error('❌ WalletConnect connection failed:', error);
      setConnecting(false);

      if (error.message?.includes('User rejected') || error.message?.includes('User closed modal')) {
        return {
          success: false,
          error: 'USER_REJECTED',
          message: 'Connection cancelled. You can retry anytime.',
        };
      }

      return {
        success: false,
        error: 'CONNECTION_FAILED',
        message: 'Failed to connect wallet. Please try again.',
      };
    }
  }, []);

  // Disconnect wallet
  const disconnectWallet = useCallback(async () => {
    try {
      if (walletConnectProvider) {
        await walletConnectProvider.disconnect();
      }
      
      // Clear singleton cached provider
      clearCachedProvider();
      
      setWalletAddress(null);
      setIsConnected(false);
      setChainId(null);
      setProvider(null);
      setWalletConnectProvider(null);
      localStorage.removeItem('walletConnected');
      
      // Clean up window reference
      if (window.walletConnectProvider) {
        delete window.walletConnectProvider;
      }
      
      return { 
        success: true,
        message: 'Wallet disconnected successfully.'
      };
    } catch (error) {
      console.error('Disconnect error:', error);
      return {
        success: false,
        message: 'Failed to disconnect wallet.'
      };
    }
  }, [walletConnectProvider]);

  // Switch to Ethereum mainnet
  const switchToMainnet = useCallback(async () => {
    if (!walletConnectProvider) {
      return {
        success: false,
        error: 'WALLET_NOT_CONNECTED',
        message: 'Wallet not connected.',
      };
    }

    try {
      await walletConnectProvider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x1' }], // Ethereum mainnet
      });
      return { success: true };
    } catch (error) {
      if (error.code === 4001) {
        return {
          success: false,
          error: 'USER_REJECTED',
          message: 'Network switch cancelled.',
        };
      }
      
      return {
        success: false,
        error: 'CHAIN_NOT_SUPPORTED',
        message: 'This pool is not available on the current network. Please switch network.',
      };
    }
  }, [walletConnectProvider]);

  // Check balance
  const checkBalance = useCallback(async (tokenAddress, requiredAmount) => {
    if (!provider || !isConnected) {
      return {
        success: false,
        error: 'NOT_CONNECTED',
        message: 'Wallet not connected.',
      };
    }

    try {
      const signer = provider.getSigner();
      const tokenContract = new ethers.Contract(
        tokenAddress,
        ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'],
        signer
      );

      const balance = await tokenContract.balanceOf(walletAddress);
      const decimals = await tokenContract.decimals();
      const required = ethers.utils.parseUnits(requiredAmount.toString(), decimals);

      if (balance.lt(required)) {
        return {
          success: false,
          error: 'INSUFFICIENT_FUNDS',
          message: 'Insufficient balance for amount and/or gas. Adjust the amount or top up your wallet.',
        };
      }

      return {
        success: true,
        balance: ethers.utils.formatUnits(balance, decimals),
      };
    } catch (error) {
      console.error('Balance check failed:', error);
      return {
        success: false,
        error: 'BALANCE_CHECK_FAILED',
        message: 'Failed to check balance.',
      };
    }
  }, [provider, isConnected, walletAddress]);

  // Approve transaction
  const approveTransaction = useCallback(async (tokenAddress, spenderAddress, amount) => {
    if (!provider || !isConnected) {
      return {
        success: false,
        error: 'NOT_CONNECTED',
        message: 'Wallet not connected.',
      };
    }

    try {
      const signer = provider.getSigner();
      const tokenContract = new ethers.Contract(
        tokenAddress,
        ['function approve(address spender, uint256 amount) returns (bool)'],
        signer
      );

      const tx = await tokenContract.approve(spenderAddress, amount);
      await tx.wait();

      return { success: true };
    } catch (error) {
      if (error.code === 4001) {
        return {
          success: false,
          error: 'USER_REJECTED',
          message: 'Signature declined. You can retry anytime.',
        };
      }

      return {
        success: false,
        error: 'APPROVAL_FAILED',
        message: 'Approval failed. Retry. If this continues, contact loremipsum@x-quo.com.',
      };
    }
  }, [provider, isConnected]);

  const value = {
    walletAddress,
    isConnected,
    connecting,
    provider,
    walletConnectProvider,
    chainId,
    connectWallet,
    disconnectWallet,
    switchToMainnet,
    checkBalance,
    approveTransaction,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};
