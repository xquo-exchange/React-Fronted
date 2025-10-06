import React from "react";
import "./SwapBox.css";
import { FaBitcoin, FaEthereum, FaSyncAlt } from "react-icons/fa"; 

const SwapBox = () => {
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
        <button className="swap-middle" type="button" aria-label="Swap">
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
      </div>
  );
};

export default SwapBox;
