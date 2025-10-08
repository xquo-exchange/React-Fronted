import React, { useState } from "react";
import "./Navbar.css";
import { useWallet } from "../hooks/useWallet";

const Navbar = ({ onShowToast }) => {
  const {
    walletAddress,
    isConnected,
    isPhantomInstalled,
    connecting,
    connectWallet,
    disconnectWallet,
  } = useWallet();

  const [showDropdown, setShowDropdown] = useState(false);

  const handleConnect = async () => {
    const result = await connectWallet();
    if (result.success) {
      onShowToast("success", "Wallet connected successfully");
    } else {
      // Display error message from WalletContext
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

  const truncateAddress = (address) => {
    if (!address) return "";
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

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
            {connecting ? "Connecting..." : "Connect Wallet"}
          </button>
        ) : (
          <div className="wallet-connected">
            <button
              className="wallet-button connected"
              onClick={() => setShowDropdown(!showDropdown)}
            >
              <span className="wallet-indicator"></span>
              {truncateAddress(walletAddress)}
            </button>
            {showDropdown && (
              <div className="wallet-dropdown">
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

