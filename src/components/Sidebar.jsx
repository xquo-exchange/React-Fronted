import React from "react";
import "./Sidebar.css";

const Sidebar = ({ activePage, setActivePage }) => {
  return (
    <div className="sidebar-box">
      <div className="buttons">
        <button
          className={`swap-button ${activePage === "swap" ? "active" : ""}`}
          onClick={() => setActivePage("swap")}
        >
          <h1 className="s-text">Swap</h1>
        </button>

        <button
          className={`deposit-button ${activePage === "stake" ? "active" : ""}`}
          onClick={() => setActivePage("stake")}
        >
          <h1 className="d-text">Stake</h1>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
