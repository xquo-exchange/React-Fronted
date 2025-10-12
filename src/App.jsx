// src/App.jsx
import React, { useState } from 'react';
import './App.css';

import Header from './components/Header';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import SwapInterface from './components/SwapInterface';
import StakeBox from './components/StakeBox';
import Toast from './components/Toast';
import Orb from './components/Orb';
import GalaxyLanding from './components/GalaxyLanding';
import { useWallet } from './hooks/useWallet';

// NUOVO: stats del pool
import CurvePoolStatistics from './components/CurvePoolStatistics';

function App() {
  const [toast, setToast] = useState(null);
  const [activePage, setActivePage] = useState('swap');
  const [swapToStakeAmount, setSwapToStakeAmount] = useState('');
  const { isConnected, connectWallet } = useWallet();

  const showToast = (type, message, txHash = null) => {
    setToast({ type, message, txHash });
  };
  const closeToast = () => setToast(null);

  const handleSwapSuccess = (usdcAmount) => {
    setSwapToStakeAmount(usdcAmount);
  };

  // Show galaxy landing if not connected
  if (!isConnected) {
    return (
      <>
        <GalaxyLanding onConnect={connectWallet} />
        {toast && (
          <Toast
            type={toast.type}
            message={toast.message}
            txHash={toast.txHash}
            onClose={closeToast}
          />
        )}
      </>
    );
  }

  return (
    <div style={{ position: 'relative', minHeight: '100vh', overflow: 'visible', background: '#000000' }}>
      <div style={{ pointerEvents: 'none' }}>
        <Orb hoverIntensity={0.5} rotateOnHover={true} hue={0} forceHoverState={false} />
      </div>

      <Navbar onShowToast={showToast} />

      {/* Main container with proper flexbox */}
      <div
        className="app-container"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: '80px',
          paddingLeft: '24px',
          paddingRight: '24px',
          gap: '16px',
          width: '100%',
          maxWidth: '1200px',
          margin: '0 auto',
        }}
      >
        {/* Header */}
        <Header />

        {/* Swap/Stake Toggle Buttons */}
        <Sidebar activePage={activePage} setActivePage={setActivePage} />

        {/* Main Content */}
        <main
          style={{
            width: '100%',
            maxWidth: '600px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {activePage === 'swap' && (
            <>
              <SwapInterface/>
            </>
          )}

          {activePage === 'stake' && (
            <>
              <StakeBox/>
              <div style={{ marginTop: 12 }}>
                <CurvePoolStatistics />
              </div>
            </>
          )}

        </main>
      </div>

      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          txHash={toast.txHash}
          onClose={closeToast}
        />
      )}
    </div>
  );
}

export default App;
