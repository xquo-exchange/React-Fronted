// src/main.jsx
import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

import { WalletProvider } from './contexts/WalletContext.jsx';
import { PoolProvider } from './contexts/PoolContext.jsx';

const el = document.getElementById('root');
createRoot(el).render(
  <StrictMode>
    <WalletProvider>
      <PoolProvider poolId="crvusd-usdc-factory-431">
        <App />
      </PoolProvider>
    </WalletProvider>
  </StrictMode>
);
