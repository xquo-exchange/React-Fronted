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


function App() {

  const [toast, setToast] = useState(null);

  const [activePage, setActivePage] = useState('swap');
  const showToast = (type, message, txHash = null) => {
    setToast({ type, message, txHash });
  };

  const closeToast = () => {
    setToast(null);
  };

return (
  <div style={{ position: 'relative', minHeight: '100vh', overflow: 'hidden' }}>
    <Orb
      hoverIntensity={0.5}
      rotateOnHover={true}
      hue={0}
      forceHoverState={false}
    />

<div style={{ position: 'relative', minHeight: '100vh', overflow: 'hidden' }}>
  <Navbar onShowToast={showToast} />

  <div className="app-container">
    <div style={{ width: '311px', flexShrink: 0, zIndex: 2, position: 'relative' }}>
      <Header />
      <Sidebar activePage={activePage} setActivePage={setActivePage} />
      {activePage === 'stake' && <StakeBox onShowToast={showToast} />}
    </div>

    <main className="main-content" style={{ position: 'relative', zIndex: 2 }}>
      {activePage === 'swap' && <SwapBox onShowToast={showToast} />}

      <div className="graph-container">
        <Graph className="graph"/>
      </div>
      
    </main>
  </div>
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
