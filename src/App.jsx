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
    <div style={{ position: 'relative', minHeight: '100vh', overflow: 'visible' }}>
      <div style={{ pointerEvents: 'none' }}>
        <Orb hoverIntensity={0.5} rotateOnHover={true} hue={0} forceHoverState={false} />
      </div>

      <Navbar onShowToast={showToast} />

      <div className="app-container">
        <div style={{ width: 311, flexShrink: 0, zIndex: 2, position: 'sticky', display: 'flex', flexDirection: 'row'}}>
          <Header />
          <Sidebar activePage={activePage} setActivePage={setActivePage}/>
        </div>

        <main className="main-content" style={{ position: 'relative', zIndex: 2, overflow: 'visible', marginTop: '140px' }}>
          {activePage === 'swap' && (
            <SwapInterface onShowToast={showToast} onSwapSuccess={handleSwapSuccess} />
          )}

          {activePage === 'stake' && (
            <StakeBox 
              onShowToast={showToast} 
              prefillAmount={swapToStakeAmount}
              onPrefillUsed={() => setSwapToStakeAmount('')}
            />
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
