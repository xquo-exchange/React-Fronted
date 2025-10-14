// src/App.jsx
import React, { useState } from "react";
import { WalletProvider } from "./contexts/WalletContext";
import { RpcProvider } from "./contexts/RpcContext";
import { CurveProvider } from "./contexts/CurveContext";
import { PoolProvider } from "./contexts/PoolContext";
import { useWallet } from "./hooks/useWallet";
import Navbar from "./components/Navbar";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import SwapInterface from "./components/SwapInterface";
import StakeBox from "./components/StakeBox";
import CurvePoolStatistics from "./components/CurvePoolStatistics";
import GalaxyLanding from "./components/GalaxyLanding";
import Toast from "./components/Toast";
import Orb from "./components/Orb";
import "./App.css";

function AppContent() {
  const [activePage, setActivePage] = useState("swap");
  const [swapSuccessAmount, setSwapSuccessAmount] = useState(null);
  const [toast, setToast] = useState(null);
  const { isConnected, connectWallet } = useWallet();

  const showToast = (type, message, txHash = null) => {
    setToast({ type, message, txHash });
  };

  const closeToast = () => setToast(null);

  const handleSwapSuccess = (amount) => {
    setSwapSuccessAmount(amount);
    setTimeout(() => setSwapSuccessAmount(null), 100);
  };

  const handlePrefillUsed = () => {
    setSwapSuccessAmount(null);
  };

  const handleConnect = async () => {
    const result = await connectWallet();
    if (!result.success) {
      showToast('error', result.message);
    }
  };

  // Show Galaxy Landing when wallet is not connected
  if (!isConnected) {
    return <GalaxyLanding onConnect={handleConnect} />;
  }

  return (
    <>
      <Orb hue={0} hoverIntensity={0.2} rotateOnHover={true} />
      <Navbar onShowToast={showToast} />
      
      <div className="content-wrapper">
        <Header />
        
        <div className="main-container">
          <Sidebar activePage={activePage} setActivePage={setActivePage} />
          
          <div className="center-content">
            {activePage === "swap" && (
              <SwapInterface 
                onShowToast={showToast}
                onSwapSuccess={handleSwapSuccess}
              />
            )}
            {activePage === "stake" && (
              <StakeBox 
                onShowToast={showToast}
                prefillAmount={swapSuccessAmount}
                onPrefillUsed={handlePrefillUsed}
              />
            )}
          </div>
        </div>

        {/* Only show pool stats on stake page */}
        {activePage === "stake" && (
          <div className="pool-stats-container">
            <CurvePoolStatistics />
          </div>
        )}
      </div>

      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          txHash={toast.txHash}
          onClose={closeToast}
          duration={5000}
        />
      )}
    </>
  );
}

function App() {
  return (
    <WalletProvider>
      <RpcProvider>
        <CurveProvider>
          <PoolProvider poolId="factory-stable-ng-161">
            <div className="app">
              <AppContent />
            </div>
          </PoolProvider>
        </CurveProvider>
      </RpcProvider>
    </WalletProvider>
  );
}

export default App;
