// src/components/CurveDepositButton.jsx
import React, { useState } from "react";
import { ethers } from "ethers";
import curve from "@curvefi/api";
import { useWallet } from "../context/useWallet";

const INFURA_URL = "https://mainnet.infura.io/v3/2dd1a437f34141deb299352ba4bbd0e2";
const rpcProvider = new ethers.providers.JsonRpcProvider(INFURA_URL);

// Curve USDC/rUSDY Stable NG pool key
const RUSDY_POOL_KEY = "factory-stable-ng-161";

export default function CurveDepositButton({ slippage = 0.1 }) {
  const { account } = useWallet();
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState("");
  const [showStatus, setShowStatus] = useState(false);

  async function executeDeposit() {
    try {
      if (!window.ethereum) return setStatus("No Web3 provider found.");
      if (!account) return setStatus("Connect a wallet first.");
      if (!amount || Number(amount) <= 0) return setStatus("Enter an amount > 0.");

      await curve.init("Web3", { externalProvider: window.ethereum, network: "mainnet" }, { chainId: 1 });
      await Promise.all([
        curve.factory.fetchPools(),
        curve.tricryptoFactory.fetchPools(),
        curve.stableNgFactory.fetchPools(),
      ]);

      const pool = curve.getPool(RUSDY_POOL_KEY);
      if (!pool) throw new Error("USDC/rUSDY pool not found");

      setStatus("Executing rUSDY deposit...");
      const txOrHash = await pool.deposit([amount, 0], slippage);
      const txHash = typeof txOrHash === "string" ? txOrHash : txOrHash?.hash || String(txOrHash);

      setStatus("Waiting for transaction confirmation...");
      const receipt = await rpcProvider.waitForTransaction(txHash);
      if (!receipt) throw new Error("Transaction not found");

      setStatus(`Deposit completed successfully! 🎉 (block ${receipt.blockNumber})`);
    } catch (e) {
      console.error(e);
      setStatus("Deposit error: " + String(e?.message || e));
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <input
        type="number"
        placeholder="Amount of USDY to stake"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        style={{ padding: 8, borderRadius: 6, border: "1px solid #ccc" }}
      />
      <button
        onClick={() => { setShowStatus(true); executeDeposit(); }}
        style={{ padding: 10, borderRadius: 8, background: "#0070f3", color: "white", cursor: "pointer" }}
      >
        Stake
      </button>

      {showStatus && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 10000 }}>
          <div style={{ background: "white", padding: 20, borderRadius: 10, minWidth: 320, maxWidth: 480, boxShadow: "0 5px 15px rgba(0,0,0,0.3)", textAlign: "center" }}>
            <h3>Operation Status</h3>
            <p style={{ wordBreak: "break-word" }}>{status || "Waiting for confirmation..."}</p>
            {(status.toLowerCase().includes("completed") || status.toLowerCase().includes("error")) && (
              <button onClick={() => setShowStatus(false)} style={{ padding: 8, borderRadius: 6, background: "#0070f3", color: "white", cursor: "pointer", marginTop: 10 }}>
                Close
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
