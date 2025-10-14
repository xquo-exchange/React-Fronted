// src/components/CurvePoolStatistics.jsx
import React, { useState } from 'react';
import { usePool } from '../contexts/PoolContext';
import './curve_pool_statistics.css';

export default function CurvePoolStatistics() {
  const [activeTab, setActiveTab] = useState('pool');
  
  let poolContext;
  try {
    poolContext = usePool();
  } catch (error) {
    return (
      <div className="pool-container">
        <div className="tab-content">
          <div style={{ textAlign: 'center', padding: '40px', color: '#ff5a5a' }}>
            <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>
              Error loading pool data
            </div>
            <div style={{ fontSize: '14px', opacity: 0.8 }}>
              {error.message || 'Failed to connect to pool provider'}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { status, poolData, walletData } = poolContext;

  if (status.loading) {
    return (
      <div className="pool-container">
        <div className="tab-content">
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div style={{ fontSize: '16px', opacity: 0.8 }}>Loading pool data...</div>
          </div>
        </div>
      </div>
    );
  }

  if (status.error || !poolData) {
    return (
      <div className="pool-container">
        <div className="tab-content">
          <div style={{ textAlign: 'center', padding: '40px', color: '#ff5a5a' }}>
            <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>
              Failed to load pool data
            </div>
            <div style={{ fontSize: '14px', opacity: 0.8 }}>
              {status.error || 'Unknown error'}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const pd = poolData;
  const wd = walletData || {};
  const currentBoost = '0x';

  return (
    <div className="pool-container">
      {/* Header Tabs */}
      <div className="tabs">
        <div
          className={`tab ${activeTab === 'pool' ? 'active' : ''}`}
          onClick={() => setActiveTab('pool')}
        >
          POOL DETAILS
        </div>
        <div
          className={`tab ${activeTab === 'your' ? 'active' : ''}`}
          onClick={() => setActiveTab('your')}
        >
          YOUR DETAILS
        </div>
        <div
          className={`tab ${activeTab === 'advanced' ? 'active' : ''}`}
          onClick={() => setActiveTab('advanced')}
        >
          ADVANCED
        </div>
      </div>

      {/* POOL DETAILS TAB */}
      {activeTab === 'pool' && (
        <div className="tab-content pool-details-grid">
          {/* Left Column */}
          <div className="pool-details-left">
            <h3 className="section-title">Currency reserves</h3>
            {(pd.tokens || []).map((token, index) => (
              <div key={index} className="reserve">
                <div className="token-info">
                  <div className="reserve-name">{token.symbol}</div>
                </div>
                <div className="token-values">
                  <div className="reserve-balance">{formatNumber(token.amount, 0)}</div>
                  <div className="reserve-percent">{formatNumber(token.percentage, 1)}%</div>
                </div>
              </div>
            ))}

            <div className="total-line">
              <span>USD total</span>
              <span>${formatNumber(pd.stats?.usdTotal, 0)}</span>
            </div>

            <div className="vapy-box">
              <div className="vapy-header">
                <span>Base vAPY</span>
                <a href="https://resources.curve.finance/pools/calculating-yield/#types-of-yield" target="_blank" rel="noopener noreferrer">
                  Learn more
                </a>
              </div>
              <div className="vapy-values">
                <span>Daily</span>
                <span>{formatNumber(pd.vapy?.daily, 2)}%</span>
              </div>
              <div className="vapy-values">
                <span>Weekly</span>
                <span>{formatNumber(pd.vapy?.weekly, 2)}%</span>
              </div>
            </div>


          </div>

          {/* Right Column */}
          <div className="pool-details-right">
            <div className="details-grid">
              <div className="details-col">
                <p>Daily USD volume: <b>${formatNumber(pd.stats?.dailyUSDVolume, 0)}</b></p>
                <p>Liquidity utilization: <b>{formatNumber(pd.stats?.liquidityUtilization, 1)}%</b></p>
                <p>Total LP Tokens staked: <b>{formatNumber(pd.stats?.totalLPTokensStaked, 0)}</b></p>
                <p>Staked percent: <b>{formatNumber(pd.stats?.stakedPercent, 1)}%</b></p>
              </div>
              <div className="details-col">
                <p>Fee: <b>{formatNumber(pd.fees?.fee, 3)}%</b></p>
                <p>DAO fee: <b>{formatNumber(pd.fees?.daoFee, 3)}%</b></p>
                <p>Virtual price: <b>{formatNumber(pd.fees?.virtualPrice, 4)}</b></p>
              </div>
            </div>

            <div className="contracts">
              <h4>Contracts</h4>
              <p>
                Pool / Token:{' '}
                <a 
                  href={`https://etherscan.io/address/${pd.contracts?.poolAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="address"
                >
                  {truncateAddress(pd.contracts?.poolAddress)}
                </a>
              </p>
              <p>
                Gauge:{' '}
                <a 
                  href={`https://etherscan.io/address/${pd.contracts?.gaugeAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="address"
                >
                  {truncateAddress(pd.contracts?.gaugeAddress)}
                </a>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* YOUR DETAILS TAB */}
      {activeTab === 'your' && (
        <div className="tab-content your-details-content">
          {!walletData || !walletData.address ? (
            <div style={{ textAlign: 'center', padding: '40px', opacity: 0.6 }}>
              <div style={{ fontSize: '16px', marginBottom: '8px' }}>Connect wallet to view your details</div>
            </div>
          ) : (
            <>
              <div className="your-position-header">
                <h3 className="section-title">Your position</h3>
                <p className="staked-share">
                  Deposit share: <strong>{formatNumber((wd.depositShare || 0) * 100, 4)}% of pool</strong>
                </p>
              </div>

              <div className="details-split">
                <div className="details-left">
                  <p className="detail-label">LP Tokens</p>
                  <div className="detail-item">
                    <span>Staked:</span>
                    <span>{formatNumber(wd.stakedAmount, 2)}</span>
                  </div>
                  <div className="detail-item">
                    <span>Unstaked:</span>
                    <span>{formatNumber(wd.unstakedAmount, 2)}</span>
                  </div>
                </div>
                <div className="details-right">
                  <p className="detail-label">Your CRV Rewards tAPR: -</p>
                  <p className="detail-label">
                    Current Boost: <strong>{currentBoost}</strong>
                  </p>
                </div>
              </div>

              <h4 className="withdraw-title">Balanced withdraw amounts</h4>
              <div className="withdraw-details">
                {(wd.tokenBalances || []).map((tokenBalance, index) => (
                  <div key={index} className="withdraw-line">
                    <span>{tokenBalance.symbol}</span>
                    <span>{formatNumber(tokenBalance.amount, 2)}</span>
                  </div>
                ))}
              </div>

              <div className="total-line usd-balance">
                <span>USD balance</span>
                <span>${formatNumber(wd.usdBalance, 2)}</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* ADVANCED TAB */}
      {activeTab === 'advanced' && (
        <div className="tab-content">
          <div style={{ textAlign: 'center', padding: '40px', opacity: 0.6 }}>
            <p>Advanced configuration coming soon...</p>
          </div>
        </div>
      )}
    </div>
  );
}

function formatNumber(v, decimals = 2) {
  if (v == null || v === undefined || Number.isNaN(Number(v))) return '—';
  try {
    const num = Number(v);
    if (Math.abs(num) >= 1000) {
      return new Intl.NumberFormat('en-US', { 
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals 
      }).format(num);
    }
    return num.toFixed(decimals);
  } catch {
    return '—';
  }
}

function truncateAddress(address) {
  if (!address) return '—';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}