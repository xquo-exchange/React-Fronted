import React, { createContext, useContext, useMemo } from 'react';
import { ethers } from 'ethers';

const RpcContext = createContext(null);

export function RpcProvider({ children }) {
  const provider = useMemo(() => {
    return new ethers.providers.JsonRpcProvider(
      "https://mainnet.infura.io/v3/ea960234de134c39aede4f75ea416681"
    );
  }, []); // Create ONCE

  return <RpcContext.Provider value={provider}>{children}</RpcContext.Provider>;
}

export function useRpcProvider() {
  const context = useContext(RpcContext);
  if (!context) throw new Error('useRpcProvider must be used within RpcProvider');
  return context;
}