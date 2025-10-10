import React, { useState } from 'react';
import './App.css';

import Header from './components/Header';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import SwapInterface from './components/SwapInterface';
import StakeBox from './components/StakeBox';
import Graph from './components/Graph';
import Toast from './components/Toast';
import Orb from './components/Orb';


function App() {
  const [toast, setToast] = useState(null);
  const [activePage, setActivePage] = useState('swap');
  const [swapToStakeAmount, setSwapToStakeAmount] = useState('');

  const showToast = (type, message, txHash = null) => {
    setToast({ type, message, txHash });
  };
  const closeToast = () => setToast(null);

  const handleSwapSuccess = (usdcAmount) => {
    // Store USDC amount from successful swap for pre-filling stake
    setSwapToStakeAmount(usdcAmount);
  };

  return (
    <div style={{ position: 'relative', minHeight: '100vh', overflow: 'visible' }}>
      {/* Background orb should never eat clicks */}
      <div style={{ pointerEvents: 'none' }}>
        <Orb hoverIntensity={0.5} rotateOnHover={true} hue={0} forceHoverState={false} />
      </div>

      <Navbar onShowToast={showToast} />

      <div className="app-container">
        {/* LEFT COLUMN */}
        <aside style={{ width: 311, flexShrink: 0, zIndex: 2, position: 'relative' }}>
          <Header />
          <Sidebar activePage={activePage} setActivePage={setActivePage} />
        </aside>

        {/* MAIN AREA */}
        <main className="main-content" style={{ position: 'relative', zIndex: 2, overflow: 'visible' }}>
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
