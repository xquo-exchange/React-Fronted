// src/main.jsx
import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

// Già esistente
import { WalletProvider } from './contexts/WalletContext.jsx';

// NUOVO: aggiungi questo import
import { PoolProvider } from './contexts/PoolContext.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <WalletProvider>
      {/* puoi cambiare poolId se non vuoi crvusd-usdc-factory-431 */}
      <PoolProvider poolId="crvusd-usdc-factory-431">
        <App />
      </PoolProvider>
    </WalletProvider>
  </StrictMode>
);
