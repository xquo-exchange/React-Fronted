import React, { useState } from "react";
import { ethers } from "ethers";
import curve from "@curvefi/api";
import { useWallet } from "../context/useWallet";

// Again, move to env when you’re done hardcoding like it’s 2017.
const INFURA_URL =
  "https://mainnet.infura.io/v3/2dd1a437f34141deb299352ba4bbd0e2";
const rpcProvider = new ethers.providers.JsonRpcProvider(INFURA_URL);

// Pool keys used below. If Curve renames/rotates, update these.
const ETH_USDC_POOL_KEY = "factory-tricrypto-3";
const RUSDY_POOL_KEY = "factory-stable-ng-161";

// rUSDY token address on Ethereum mainnet (as in your earlier code)
const RUSDY_ADDRESS = "0xaf37c1167910ebc994e266949387d2c7c326b879";

const CurveSwapButton = ({ slippage = 0.1 }) => {
  const { account } = useWallet();

  const [amount, setAmount] = useState(""); // desired rUSDY out
  const [status, setStatus] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [showStatus, setShowStatus] = useState(false);

  const [ethAmountNeeded, setEthAmountNeeded] = useState(null); // ETH in (without gas)
  const [ethPreviewTotal, setEthPreviewTotal] = useState(null); // ETH in incl. gas pad

  // Preview: how much ETH to end up with `amount` rUSDY
  const previewSwap = async () => {
    if (!amount || Number(amount) <= 0) return;

    try {
      if (!window.ethereum) {
        setStatus("No Web3 provider found. Open a wallet.");
        setShowStatus(true);
        return;
      }

      await curve.init(
        "Web3",
        { externalProvider: window.ethereum, network: "mainnet" },
        { chainId: 1 }
      );

      await Promise.all([
        curve.factory.fetchPools(),
        curve.tricryptoFactory.fetchPools(),
        curve.stableNgFactory.fetchPools(),
      ]);

      const ethUsdcPool = curve.getPool(ETH_USDC_POOL_KEY);
      const usdcUsdyPool = curve.getPool(RUSDY_POOL_KEY);
      if (!ethUsdcPool) throw new Error("ETH/USDC pool not found");
      if (!usdcUsdyPool) throw new Error("USDC/rUSDY pool not found");

      // Step 1: how much USDC to get `amount` rUSDY
      const usdcNeeded = await usdcUsdyPool.swapExpected(
        RUSDY_ADDRESS, // output token
        "USDC",        // input token (what we must provide)
        amount         // desired rUSDY out
      );
      if (!usdcNeeded) throw new Error("Cannot preview USDC→rUSDY leg");

      // Step 2: how much ETH to get that USDC
      const ethNeededStr = await ethUsdcPool.swapExpected("USDC", "ETH", usdcNeeded);
      if (!ethNeededStr) throw new Error("Cannot preview ETH→USDC leg");

      // Turn into BN and attempt to add gas cushion
      let totalEthBN = ethers.utils.parseEther(String(ethNeededStr));
      try {
        const gasPrice = await rpcProvider.getGasPrice();
        if (ethUsdcPool.estimateGas?.swap && gasPrice) {
          const gasUnits = await ethUsdcPool.estimateGas.swap(
            "ETH",
            "USDC",
            ethNeededStr,
            slippage
          );
          // pad x2, we’re not writing a PhD thesis here
          const fee = gasUnits.mul(gasPrice).mul(2);
          totalEthBN = totalEthBN.add(fee);
        }
      } catch {
        // If gas estimate fails, we still show the base ETH amount.
      }

      setEthAmountNeeded(String(ethNeededStr));
      setEthPreviewTotal(ethers.utils.formatEther(totalEthBN));
      setShowConfirm(true);
    } catch (e) {
      console.error("Preview error:", e);
      setStatus("Preview calculation error: " + String(e?.message || e));
      setShowStatus(true);
    }
  };

  // Execute: either USDC→rUSDY direct (if not enough ETH), or ETH→USDC→rUSDY
  const executeSwap = async () => {
    if (!account || !window.ethereum) return;

    try {
      // Make sure Curve is initialized; re-init is harmless
      await curve.init(
        "Web3",
        { externalProvider: window.ethereum, network: "mainnet" },
        { chainId: 1 }
      );

      const balance = await rpcProvider.getBalance(account);
      const usdcUsdyPool = curve.getPool(RUSDY_POOL_KEY);
      if (!usdcUsdyPool) throw new Error("USDC/rUSDY pool not found");

      // If we lack enough ETH to cover the previewed total, try direct USDC→rUSDY
      const needEthBN = ethPreviewTotal
        ? ethers.utils.parseEther(String(ethPreviewTotal))
        : null;

      if (!ethAmountNeeded || (needEthBN && balance.lt(needEthBN))) {
        setStatus("Direct USDC → rUSDY swap...");
        setShowStatus(true);

        const requiredUSDC = await usdcUsdyPool.swapExpected(
          RUSDY_ADDRESS,
          "USDC",
          amount
        );

        const txOrHash = await usdcUsdyPool.swap(
          "USDC",
          RUSDY_ADDRESS,
          requiredUSDC,
          slippage
        );
        const txHash =
          typeof txOrHash === "string" ? txOrHash : txOrHash?.hash || String(txOrHash);

        const receipt = await rpcProvider.waitForTransaction(txHash);
        if (!receipt) throw new Error("Transaction not found");

        setStatus("Purchase completed with USDC! 🎉");
      } else {
        const ethUsdcPool = curve.getPool(ETH_USDC_POOL_KEY);
        if (!ethUsdcPool) throw new Error("ETH/USDC pool not found");

        setStatus("Executing ETH → USDC...");
        setShowStatus(true);

        const tx1 = await ethUsdcPool.swap("ETH", "USDC", ethAmountNeeded, slippage);
        const tx1Hash = typeof tx1 === "string" ? tx1 : tx1?.hash || String(tx1);
        await rpcProvider.waitForTransaction(tx1Hash);

        setStatus("Executing USDC → rUSDY...");
        const tx2 = await usdcUsdyPool.swap("USDC", RUSDY_ADDRESS, amount, slippage);
        const tx2Hash = typeof tx2 === "string" ? tx2 : tx2?.hash || String(tx2);

        const receipt = await rpcProvider.waitForTransaction(tx2Hash);
        if (!receipt) throw new Error("Transaction not found");

        setStatus("Purchase completed! 🎉");
      }

      setShowConfirm(false);
    } catch (e) {
      console.error("Swap error:", e);
      setStatus("Error: " + String(e?.message || e));
      setShowStatus(true);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <input
        type="number"
        placeholder="Amount of rUSDY to purchase"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        style={{ padding: 8, borderRadius: 6, border: "1px solid #ccc" }}
      />

      <button
        onClick={previewSwap}
        style={{
          padding: 10,
          borderRadius: 8,
          background: "#0070f3",
          color: "white",
          cursor: "pointer",
        }}
      >
        Buy
      </button>

      {/* Confirm modal */}
      {showConfirm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: "white",
              padding: 20,
              borderRadius: 10,
              minWidth: 320,
              maxWidth: 480,
              boxShadow: "0 5px 15px rgba(0,0,0,0.3)",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <p style={{ margin: 0 }}>
              You need approximately:{" "}
              <b>{ethPreviewTotal || "…"}</b> ETH to purchase <b>{amount}</b> rUSDY
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                onClick={() => {
                  setShowConfirm(false);
                  setShowStatus(true);
                  executeSwap();
                }}
                style={{
                  padding: 8,
                  borderRadius: 6,
                  background: "#28a745",
                  color: "white",
                  cursor: "pointer",
                }}
              >
                Confirm Swap
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                style={{
                  padding: 8,
                  borderRadius: 6,
                  background: "#dc3545",
                  color: "white",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status modal */}
      {showStatus && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 10000,
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              padding: 20,
              borderRadius: 10,
              minWidth: 320,
              maxWidth: 480,
              boxShadow: "0 5px 15px rgba(0,0,0,0.3)",
              display: "flex",
              flexDirection: "column",
              gap: 12,
              textAlign: "center",
            }}
          >
            <h3>Transaction Status</h3>
            <p style={{ wordBreak: "break-word" }}>
              {status || "Waiting for confirmation..."}
            </p>

            {(status.toLowerCase().includes("completed") ||
              status.toLowerCase().includes("error")) && (
              <button
                onClick={() => setShowStatus(false)}
                style={{
                  padding: 8,
                  borderRadius: 6,
                  background: "#0070f3",
                  color: "white",
                  cursor: "pointer",
                  marginTop: 10,
                }}
              >
                Close
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CurveSwapButton;
