import React, { createContext, useState, useEffect, useCallback } from 'react';

export const WalletContext = createContext();

export const WalletProvider = ({ children }) => {
  const [walletAddress, setWalletAddress] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isPhantomInstalled, setIsPhantomInstalled] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [network, setNetwork] = useState(null);

  // Check if Phantom is installed
  useEffect(() => {
    const checkPhantom = () => {
      if (window.solana && window.solana.isPhantom) {
        setIsPhantomInstalled(true);
        // Check if user was previously connected via localStorage
        const wasConnected = localStorage.getItem('walletConnected');
        
        if (wasConnected === 'true') {
          // Try silent connect only if explicitly stored
          window.solana.connect({ onlyIfTrusted: true })
            .then((response) => {
              setWalletAddress(response.publicKey.toString());
              setIsConnected(true);
            })
            .catch(() => {
              // Connection failed, clear stored state
              localStorage.removeItem('walletConnected');
            });
        }
      } else {
        setIsPhantomInstalled(false);
      }
    };

    // Wait for Phantom to inject
    if (window.solana) {
      checkPhantom();
    } else {
      window.addEventListener('load', checkPhantom);
      return () => window.removeEventListener('load', checkPhantom);
    }
  }, []);

  // Listen for account changes
  useEffect(() => {
    if (!window.solana) return;

    const handleAccountChange = (publicKey) => {
      if (publicKey) {
        setWalletAddress(publicKey.toString());
        setIsConnected(true);
      } else {
        setWalletAddress(null);
        setIsConnected(false);
      }
    };

    window.solana.on('accountChanged', handleAccountChange);
    window.solana.on('disconnect', () => {
      setWalletAddress(null);
      setIsConnected(false);
    });

    return () => {
      window.solana.removeListener('accountChanged', handleAccountChange);
      window.solana.removeListener('disconnect', () => {});
    };
  }, []);

  // Connect wallet
  const connectWallet = useCallback(async () => {
    if (!isPhantomInstalled) {
      return {
        success: false,
        error: 'WALLET_NOT_INSTALLED',
        message: 'Phantom wallet not detected. Please install Phantom. If the problem continues, contact loremipsum@x-quo.com.',
      };
    }

    setConnecting(true);
    try {
      const response = await window.solana.connect();
      setWalletAddress(response.publicKey.toString());
      setIsConnected(true);
      setConnecting(false);
      // Store connection state
      localStorage.setItem('walletConnected', 'true');
      return {
        success: true,
        address: response.publicKey.toString(),
      };
    } catch (error) {
      setConnecting(false);
      
      // Handle different error types
      if (error.code === 4001 || error.message.includes('User rejected')) {
        return {
          success: false,
          error: 'USER_REJECTED_SIGNATURE',
          message: 'Signature declined. You can retry anytime.',
        };
      }
      
      if (error.message.includes('network') || error.message.includes('RPC')) {
        return {
          success: false,
          error: 'RPC_UNAVAILABLE',
          message: 'Network temporarily unavailable. Please retry later.',
        };
      }

      return {
        success: false,
        error: 'CONNECTION_FAILED',
        message: 'Failed to connect wallet. Please try again.',
      };
    }
  }, [isPhantomInstalled]);

  // Disconnect wallet
  const disconnectWallet = useCallback(async () => {
    try {
      if (window.solana && window.solana.disconnect) {
        await window.solana.disconnect();
      }
      // Clear connection state from localStorage
      localStorage.removeItem('walletConnected');
      
      setWalletAddress(null);
      setIsConnected(false);
      return { success: true };
    } catch (error) {
      console.error('Disconnect error:', error);
      // Even if disconnect fails, clear local state
      localStorage.removeItem('walletConnected');
      setWalletAddress(null);
      setIsConnected(false);
      return {
        success: false,
        error: 'DISCONNECT_FAILED',
        message: 'Failed to disconnect wallet.',
      };
    }
  }, []);

  // Check network/chain support
  const checkNetwork = useCallback(async () => {
    if (!window.solana || !isConnected) {
      return {
        success: false,
        error: 'NOT_CONNECTED',
        message: 'Wallet not connected.',
      };
    }

    try {
      // Phantom doesn't expose network directly, but you can check via connection
      // This is a placeholder - adjust based on your needs
      const cluster = await window.solana.request({ method: 'cluster' });
      
      // Example: Check if on correct network (mainnet-beta, devnet, testnet)
      const supportedNetworks = ['mainnet-beta', 'devnet'];
      if (!supportedNetworks.includes(cluster)) {
        return {
          success: false,
          error: 'CHAIN_NOT_SUPPORTED',
          message: 'This pool is not available on the current network. Please switch network.',
        };
      }

      setNetwork(cluster);
      return { success: true, network: cluster };
    } catch (error) {
      return {
        success: false,
        error: 'NETWORK_CHECK_FAILED',
        message: 'Failed to check network.',
      };
    }
  }, [isConnected]);

  // Check balance
  const checkBalance = useCallback(async (requiredAmount) => {
    if (!window.solana || !isConnected) {
      return {
        success: false,
        error: 'NOT_CONNECTED',
        message: 'Wallet not connected.',
      };
    }

    try {
      const { Connection, PublicKey, LAMPORTS_PER_SOL } = await import('@solana/web3.js');
      const connection = new Connection('https://api.mainnet-beta.solana.com');
      const publicKey = new PublicKey(walletAddress);
      const balance = await connection.getBalance(publicKey);
      const balanceInSOL = balance / LAMPORTS_PER_SOL;

      if (balanceInSOL < requiredAmount) {
        return {
          success: false,
          error: 'INSUFFICIENT_FUNDS',
          message: 'Insufficient balance for amount and/or gas. Adjust the amount or top up your wallet.',
        };
      }

      return { success: true, balance: balanceInSOL };
    } catch (error) {
      return {
        success: false,
        error: 'BALANCE_CHECK_FAILED',
        message: 'Failed to check balance.',
      };
    }
  }, [isConnected, walletAddress]);

  // Simulate transaction approval
  const approveTransaction = useCallback(async () => {
    if (!isConnected) {
      return {
        success: false,
        error: 'NOT_CONNECTED',
        message: 'Wallet not connected.',
      };
    }

    try {
      // Simulate approval logic here
      // This is a placeholder
      const approved = true; // Replace with actual approval logic

      if (!approved) {
        return {
          success: false,
          error: 'APPROVAL_FAILED',
          message: 'Approval failed. Retry. If this continues, contact loremipsum@x-quo.com.',
        };
      }

      return { success: true };
    } catch (error) {
      if (error.message.includes('User rejected')) {
        return {
          success: false,
          error: 'USER_REJECTED_SIGNATURE',
          message: 'Signature declined. You can retry anytime.',
        };
      }

      return {
        success: false,
        error: 'APPROVAL_FAILED',
        message: 'Approval failed. Retry. If this continues, contact loremipsum@x-quo.com.',
      };
    }
  }, [isConnected]);

  // Simulate stake transaction
  const stakeTransaction = useCallback(async () => {
    if (!isConnected) {
      return {
        success: false,
        error: 'NOT_CONNECTED',
        message: 'Wallet not connected.',
      };
    }

    try {
      // Simulate stake logic here
      // This is a placeholder
      const staked = true; // Replace with actual stake logic

      if (!staked) {
        return {
          success: false,
          error: 'STAKE_FAILED',
          message: 'Transaction not confirmed. Retry. If this continues, contact loremipsum@x-quo.com.',
        };
      }

      return { success: true };
    } catch (error) {
      if (error.message.includes('rate limit') || error.message.includes('429')) {
        return {
          success: false,
          error: 'RATE_LIMIT',
          message: 'Network temporarily unavailable. Please retry later.',
        };
      }

      return {
        success: false,
        error: 'STAKE_FAILED',
        message: 'Transaction not confirmed. Retry. If this continues, contact loremipsum@x-quo.com.',
      };
    }
  }, [isConnected]);

  // Simulate unstake transaction
  const unstakeTransaction = useCallback(async () => {
    if (!isConnected) {
      return {
        success: false,
        error: 'NOT_CONNECTED',
        message: 'Wallet not connected.',
      };
    }

    try {
      // Simulate unstake logic here
      // This is a placeholder
      const unstaked = true; // Replace with actual unstake logic

      if (!unstaked) {
        return {
          success: false,
          error: 'UNSTAKE_FAILED',
          message: 'Transaction not confirmed. Retry. If this continues, contact loremipsum@x-quo.com.',
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: 'UNSTAKE_FAILED',
        message: 'Transaction not confirmed. Retry. If this continues, contact loremipsum@x-quo.com.',
      };
    }
  }, [isConnected]);

  // Check quote expiration
  const checkQuoteExpiration = useCallback((quoteTimestamp, expirationMinutes = 5) => {
    const now = Date.now();
    const expirationTime = quoteTimestamp + (expirationMinutes * 60 * 1000);

    if (now > expirationTime) {
      return {
        success: false,
        error: 'QUOTE_EXPIRED',
        message: 'Quote expired. Refresh and retry.',
      };
    }

    return { success: true };
  }, []);

  const value = {
    walletAddress,
    isConnected,
    isPhantomInstalled,
    connecting,
    network,
    connectWallet,
    disconnectWallet,
    checkNetwork,
    checkBalance,
    approveTransaction,
    stakeTransaction,
    unstakeTransaction,
    checkQuoteExpiration,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};