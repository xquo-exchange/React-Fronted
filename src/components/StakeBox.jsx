import React, { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import "./StakeBox.css";
import "../components/SwapBox.css"; // keeps your modal styles
import { useWallet } from "../hooks/useWallet";

const StakeBox = ({ onShowToast }) => {
  const { isConnected, connectWallet } = useWallet();
  const [showWarning, setShowWarning] = useState(false);
  const [showBalanceWarning, setShowBalanceWarning] = useState(false);
  const [balance, setBalance] = useState(0);
  const requiredAmount = 10;
  const autoHideTimer = useRef(null);
  const balanceTimer = useRef(null);

  const [mode, setMode] = useState("stake"); // "stake" = deposit, "unstake" = withdraw

  useEffect(() => {
    if (isConnected && showWarning) setShowWarning(false);
  }, [isConnected, showWarning]);

  const closeWarning = () => {
    if (autoHideTimer.current) clearTimeout(autoHideTimer.current);
    setShowWarning(false);
  };

  const closeBalanceWarning = () => {
    if (balanceTimer.current) clearTimeout(balanceTimer.current);
    setShowBalanceWarning(false);
  };

  const handleActionClick = () => {
    if (!isConnected) {
      setShowWarning(true);
      if (autoHideTimer.current) clearTimeout(autoHideTimer.current);
      autoHideTimer.current = setTimeout(() => setShowWarning(false), 3000);
      if (onShowToast) onShowToast("error", "Connect your wallet first");
      return;
    }

    if (mode === "stake" && balance < requiredAmount) {
      setShowBalanceWarning(true);
      if (balanceTimer.current) clearTimeout(balanceTimer.current);
      balanceTimer.current = setTimeout(() => setShowBalanceWarning(false), 3000);
      return;
    }

    console.log(`${mode === "stake" ? "Deposit" : "Withdraw"} confirmed ✅`);
    if (onShowToast)
      onShowToast(
        "success",
        mode === "stake"
          ? "Successfully staked your tokens"
          : "Successfully withdrew your tokens"
      );
  };

  return (
    <>
      
        <div className="stake-box">
        
        <div className="switch-buttons">
          <div className="stake-mode-switch">
            <button
              className={`mode-btn ${mode === "stake" ? "active" : ""}`}
              onClick={() => setMode("stake")}
            >
              Deposit
            </button>
            <button
              className={`mode-btn ${mode === "unstake" ? "active" : ""}`}
              onClick={() => setMode("unstake")}
            >
              Withdraw
            </button>
          </div>

          <input
            type="number"
            className="stake-box-input"
            placeholder={
              mode === "stake"
                ? "Amount to deposit"
                : "Amount to withdraw"
            }
          />
          <button className="stake-box-button" onClick={handleActionClick}>
            {mode === "stake" ? "Stake" : "Unstake"}
          </button>

          </div>

        </div>  
        


      {/* Wallet not connected warning */}
      {showWarning &&
        ReactDOM.createPortal(
          <div className="swap-warning" onClick={closeWarning}>
            <div
              className="swap-warning__content"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="swap-warning__title">Phantom Wallet not connected</h3>
              <p className="swap-warning__text">
                Connect Your Phantom Wallet to continue.
              </p>
              <div className="swap-warning__actions">
                <button className="btn-secondary" onClick={closeWarning}>
                  Close
                </button>
                <button
                  className="btn-primary"
                  onClick={() => {
                    closeWarning();
                    connectWallet();
                  }}
                >
                  Connect Phantom Wallet
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Balance warning */}
      {showBalanceWarning &&
        ReactDOM.createPortal(
          <div className="swap-warning" onClick={closeBalanceWarning}>
            <div
              className="swap-warning__content"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="swap-warning__title">Insufficient Balance</h3>
              <p className="swap-warning__text">
                You need at least {requiredAmount} tokens to stake.
              </p>
              <div className="swap-warning__actions">
                <button className="btn-secondary" onClick={closeBalanceWarning}>
                  Close
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

export default StakeBox;
