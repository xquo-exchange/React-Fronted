import React, { createContext, useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';

export const WalletContext = createContext();

export const WalletProvider = ({ children }) => {
  const [walletAddress, setWalletAddress] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isMetaMaskInstalled, setIsMetaMaskInstalled] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [provider, setProvider] = useState(null);
  const [chainId, setChainId] = useState(null);

  // Check if MetaMask is installed
  useEffect(() => {
    const checkMetaMask = () => {
      if (typeof window.ethereum !== 'undefined') {
        setIsMetaMaskInstalled(true);
        const ethProvider = new ethers.providers.Web3Provider(window.ethereum);
        setProvider(ethProvider);

        // Only auto-connect if previously connected
        const wasConnected = localStorage.getItem('walletConnected');
        if (wasConnected === 'true') {
          ethProvider.listAccounts().then((accounts) => {
            if (accounts.length > 0) {
              setWalletAddress(accounts[0]);
              setIsConnected(true);
              ethProvider.getNetwork().then((network) => {
                setChainId(network.chainId);
              });
            } else {
              // User disconnected from MetaMask directly
              localStorage.removeItem('walletConnected');
            }
          });
        }
      } else {
        setIsMetaMaskInstalled(false);
      }
    };

    checkMetaMask();

    // Listen for account changes
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length > 0) {
          setWalletAddress(accounts[0]);
          setIsConnected(true);
          // Only set localStorage if user is intentionally connected
          const wasConnected = localStorage.getItem('walletConnected');
          if (wasConnected === 'true') {
            localStorage.setItem('walletConnected', 'true');
          }
        } else {
          // User disconnected from MetaMask extension
          setWalletAddress(null);
          setIsConnected(false);
          localStorage.removeItem('walletConnected');
        }
      });

      window.ethereum.on('chainChanged', (chainIdHex) => {
        const newChainId = parseInt(chainIdHex, 16);
        setChainId(newChainId);
        window.location.reload(); // Recommended by MetaMask
      });
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeAllListeners('accountsChanged');
        window.ethereum.removeAllListeners('chainChanged');
      }
    };
  }, []);

  // Connect wallet
  const connectWallet = useCallback(async () => {
    if (!isMetaMaskInstalled) {
      return {
        success: false,
        error: 'WALLET_NOT_INSTALLED',
        message: 'MetaMask not detected. Please install MetaMask. If the problem continues, contact loremipsum@x-quo.com.',
      };
    }

    setConnecting(true);
    try {
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });

      if (accounts.length > 0) {
        setWalletAddress(accounts[0]);
        setIsConnected(true);

        const ethProvider = new ethers.providers.Web3Provider(window.ethereum);
        setProvider(ethProvider);
        const network = await ethProvider.getNetwork();
        setChainId(network.chainId);

        localStorage.setItem('walletConnected', 'true');
        setConnecting(false);

        return {
          success: true,
          address: accounts[0],
          chainId: network.chainId,
        };
      }
    } catch (error) {
      setConnecting(false);

      if (error.code === 4001) {
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
  }, [isMetaMaskInstalled]);

  // Disconnect wallet
  const disconnectWallet = useCallback(async () => {
    // Clear local state
    setWalletAddress(null);
    setIsConnected(false);
    setChainId(null);
    
    // Clear localStorage flag
    localStorage.removeItem('walletConnected');
    
    // Optionally, you can ask the user to disconnect from MetaMask manually
    // since MetaMask doesn't have a programmatic disconnect
    
    return { 
      success: true,
      message: 'Wallet disconnected. To fully disconnect, please disconnect from MetaMask extension.'
    };
  }, []);

  // Switch to Ethereum mainnet
  const switchToMainnet = useCallback(async () => {
    if (!window.ethereum) {
      return {
        success: false,
        error: 'WALLET_NOT_INSTALLED',
        message: 'MetaMask not installed.',
      };
    }

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x1' }], // Ethereum mainnet
      });
      return { success: true };
    } catch (error) {
      if (error.code === 4001) {
        return {
          success: false,
          error: 'USER_REJECTED_SIGNATURE',
          message: 'Network switch declined.',
        };
      }
      
      return {
        success: false,
        error: 'CHAIN_NOT_SUPPORTED',
        message: 'This pool is not available on the current network. Please switch network.',
      };
    }
  }, []);

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
  }, [provider, isConnected]);

  const value = {
    walletAddress,
    isConnected,
    isMetaMaskInstalled,
    connecting,
    provider,
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