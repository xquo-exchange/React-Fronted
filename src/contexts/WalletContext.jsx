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
        message: 'Phantom wallet not detected. Please install Phantom.',
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
      if (error.code === 4001 || error.message.includes('User rejected')) {
        return {
          success: false,
          error: 'USER_REJECTED_SIGNATURE',
          message: 'Signature declined. You can retry anytime.',
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

  const value = {
    walletAddress,
    isConnected,
    isPhantomInstalled,
    connecting,
    network,
    connectWallet,
    disconnectWallet,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};