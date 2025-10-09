import React, { useState } from 'react';
import './App.css';
import Header from './components/Header';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import SwapBox from './components/SwapBox';
import StakeBox from './components/StakeBox'; 
import Graph from './components/Graph';
import Toast from './components/Toast';

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
    <>
      <Navbar onShowToast={showToast} />

      <div className="app-container">
        <div style={{ width: '311px', flexShrink: 0 }}>
          <Header />
          <Sidebar
            activePage={activePage}
            setActivePage={setActivePage}
          />
        </div>

        <main className="main-content">

          {activePage === 'swap' && <SwapBox onShowToast={showToast} />}

          {activePage === 'stake' && <StakeBox onShowToast={showToast} />}

          <Graph />
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
    </>
  );
}

export default App;
