import React, { useState } from "react";
import "./Navbar.css";
import { useWallet } from "../hooks/useWallet";

const Navbar = ({ onShowToast }) => {
  const {
    walletAddress,
    isConnected,
    isMetaMaskInstalled,
    connecting,
    chainId,
    connectWallet,
    disconnectWallet,
    switchToMainnet,
  } = useWallet();

  const [showDropdown, setShowDropdown] = useState(false);

  const handleConnect = async () => {
    const result = await connectWallet();
    if (result.success) {
      onShowToast("success", "Wallet connected successfully");
    } else {
      onShowToast("error", result.message);
    }
  };

  const handleDisconnect = async () => {
    const result = await disconnectWallet();
    if (result.success) {
      onShowToast("success", "Wallet disconnected");
      setShowDropdown(false);
    } else {
      onShowToast("error", result.message);
    }
  };

  const handleSwitchNetwork = async () => {
    const result = await switchToMainnet();
    if (result.success) {
      onShowToast("success", "Switched to Ethereum Mainnet");
    } else {
      onShowToast("error", result.message);
    }
  };

  const truncateAddress = (address) => {
    if (!address) return "";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getNetworkName = (chainId) => {
    switch (chainId) {
      case 1:
        return "Ethereum";
      case 5:
        return "Goerli";
      case 11155111:
        return "Sepolia";
      default:
        return `Chain ${chainId}`;
    }
  };

  const isMainnet = chainId === 1;

  return (
    <nav className="navbar">
      <div className="navbar-left">
        <h1 className="navbar-logo">X-QUO</h1>
      </div>
      <div className="navbar-right">
        {!isConnected ? (
          <button
            className="wallet-button connect"
            onClick={handleConnect}
            disabled={connecting}
          >
            {connecting ? "Connecting..." : "Connect MetaMask"}
          </button>
        ) : (
          <div className="wallet-connected">
            {/* Network indicator */}
            {!isMainnet && (
              <button
                className="network-warning-btn"
                onClick={handleSwitchNetwork}
                title="Click to switch to Ethereum Mainnet"
              >
                ⚠️ {getNetworkName(chainId)}
              </button>
            )}

            <button
              className="wallet-button connected"
              onClick={() => setShowDropdown(!showDropdown)}
            >
              <span className="wallet-indicator"></span>
              {truncateAddress(walletAddress)}
            </button>

            {showDropdown && (
              <div className="wallet-dropdown">
                <div className="dropdown-info">
                  <span className="dropdown-label">Network</span>
                  <span className="dropdown-value">
                    {getNetworkName(chainId)}
                  </span>
                </div>
                {!isMainnet && (
                  <button
                    className="dropdown-item warning"
                    onClick={handleSwitchNetwork}
                  >
                    Switch to Mainnet
                  </button>
                )}
                <button className="dropdown-item" onClick={handleDisconnect}>
                  Disconnect
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;

