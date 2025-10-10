import React, { useState } from 'react';
import './App.css';

import Header from './components/Header';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import SwapBox from './components/SwapBox';
import StakeBox from './components/StakeBox';
import Graph from './components/Graph';
import Toast from './components/Toast';
import Orb from './components/Orb';
import CurveSwapButton from "./components/CurveSwapButton.jsx";
import CurveDepositButton from "./components/CurveDepositButton.jsx";


function App() {
  const [toast, setToast] = useState(null);
  const [activePage, setActivePage] = useState('swap');

  const showToast = (type, message, txHash = null) => {
    setToast({ type, message, txHash });
  };
  const closeToast = () => setToast(null);

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

          {/* Keep your StakeBox where you had it */}
          {activePage === 'stake' && (
            <>
              <StakeBox onShowToast={showToast} />
              <div style={{ marginTop: 16 }}>
                <CurveDepositButton slippage={0.1} />
              </div>
            </>
          )}
        </aside>

        {/* MAIN AREA */}
        <main className="main-content" style={{ position: 'relative', zIndex: 2, overflow: 'visible' }}>
          {activePage === 'swap' && (
            <>
              <SwapBox onShowToast={showToast} />
              <div style={{ marginTop: 16 }}>
                <CurveSwapButton slippage={0.1} />
              </div>
            </>
          )}

          {/* Graph section: give it its own wrapper for sticky behavior */}
          <section className="graph-section">
            <Graph />
          </section>
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
