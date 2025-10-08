import React, { useState, useEffect, useRef } from "react";
import "./SwapBox.css";
import { FaBitcoin, FaEthereum, FaSyncAlt } from "react-icons/fa";
import { useWallet } from "../hooks/useWallet";

const SwapBox = ({ onShowToast }) => {
  const { isConnected, connectWallet } = useWallet();
  const [showWarning, setShowWarning] = useState(false);
  const autoHideTimer = useRef(null); // ✅ Move inside component

  useEffect(() => {
    if (isConnected && showWarning) setShowWarning(false);
  }, [isConnected, showWarning]);

  useEffect(() => {
    if (!showWarning) return;
    const onKey = (e) => {
      if (e.key === "Escape") setShowWarning(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showWarning]);

  const handleSwapClick = () => {
    if (!isConnected) {
      setShowWarning(true);

      if (autoHideTimer.current) {
        clearTimeout(autoHideTimer.current);
        autoHideTimer.current = null;
      }

      autoHideTimer.current = setTimeout(() => {
        setShowWarning(false);
        autoHideTimer.current = null;
      }, 3000);

      if (onShowToast) onShowToast("error", "Connect your wallet to Swap");
      return;
    }
    console.log("Swap initiated");
  };

  const closeWarning = () => {
    if (autoHideTimer.current) {
      clearTimeout(autoHideTimer.current);
      autoHideTimer.current = null;
    }
    setShowWarning(false);
  };

  return (
    <div className="swap-row-horizontal">
      <div className="swap-section">
        <div className="swap-left">
          <p className="swap-label">You send</p>
          <h2 className="swap-amount">1</h2>
          <p className="swap-rate">1 BTC = $119,273.00</p>
        </div>
        <div className="swap-right">
          <div className="coin-info">
            <p className="coin-symbol">BTC</p>
            <p className="coin-name">Bitcoin</p>
          </div>
          <FaBitcoin className="coin-icon" />
        </div>
      </div>

      <button
        className="swap-middle"
        type="button"
        aria-label="Swap"
        onClick={handleSwapClick}
      >
        <FaSyncAlt className="swap-icon" />
      </button>

      <div className="swap-section">
        <div className="swap-left">
          <p className="swap-label">You receive</p>
          <h2 className="swap-amount">27.06874248</h2>
          <p className="swap-rate">1 ETH = $4,406.30</p>
        </div>
        <div className="swap-right">
          <div className="coin-info">
            <p className="coin-symbol">ETH</p>
            <p className="coin-name">Ethereum</p>
          </div>
          <FaEthereum className="coin-icon" />
        </div>
      </div>

      {showWarning && (
        <div className="swap-warning" role="dialog" aria-modal="true" onClick={closeWarning}>
          <div className="swap-warning__content" onClick={(e) => e.stopPropagation()}>
            <h3 className="swap-warning__title">Wallet not connected</h3>
            <p className="swap-warning__text">
              Connect Your Phantom Wallet to Swap.
            </p>
            <div className="swap-warning__actions">
              <button className="btn-secondary" type="button" onClick={closeWarning}>
                Close Now
              </button>
              {connectWallet && (
                <button
                  className="btn-primary"
                  type="button"
                  onClick={() => {
                    closeWarning();
                    connectWallet();
                  }}
                >
                  Connect Phantom Wallet
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SwapBox;
