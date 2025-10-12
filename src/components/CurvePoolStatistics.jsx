import React from 'react';
import usePool from '../hooks/usePool.js';
import "./curve_pool_statistics.css";


function Stat({ label, value, suffix, fallback = '—' }) {
  const shown =
    value == null || Number.isNaN(Number(value)) ? fallback : `${formatNumber(value)}${suffix || ''}`;
  return (
    <div className="cps-stat">
      <div className="cps-stat-label">{label}</div>
      <div className="cps-stat-value">{shown}</div>
    </div>
  );
}

function TokenRow({ t }) {
  return (
    <div className="cps-row">
      <div className="cps-row-left">{t.symbol}</div>
      <div className="cps-row-right">
        <span>{formatNumber(t.amount)}</span>
        <span className="cps-dot">•</span>
        <span>{t.percentage != null ? `${t.percentage}%` : '—'}</span>
      </div>
    </div>
  );
}

export default function CurvePoolStatistics() {
  const { status, poolData, walletData } = usePool();

  if (status.loading) {
    return <div className="cps-card">Caricamento pool… prova a respirare nel frattempo.</div>;
  }
  if (status.error && !poolData) {
    return <div className="cps-card cps-error">Errore: {String(status.error)}</div>;
  }

  const pd = poolData || {};
  const wd = walletData || {};

  return (
    <div className="cps-grid">
      <div className="cps-card">
        <div className="cps-title">{pd.name || 'Curve Pool'}</div>
        <div className="cps-columns">
          <Stat label="TVL" value={pd.stats?.usdTotal} suffix=" $" />
          <Stat label="Volume 24h" value={pd.stats?.dailyUSDVolume} suffix=" $" />
          <Stat label="LP Staked" value={pd.stats?.totalLPTokensStaked} />
          <Stat label="% Staked" value={pd.stats?.stakedPercent} suffix="%" />
          <Stat label="Utilization" value={pd.stats?.liquidityUtilization} suffix="%" />
        </div>
      </div>

      <div className="cps-card">
        <div className="cps-subtitle">Fee & VP</div>
        <div className="cps-columns">
          <Stat label="Swap fee" value={pd.fees?.fee} suffix="%" />
          <Stat label="DAO fee" value={pd.fees?.daoFee} suffix="%" />
          <Stat label="Virtual price" value={pd.fees?.virtualPrice} />
        </div>
      </div>

      <div className="cps-card">
        <div className="cps-subtitle">VAPY</div>
        <div className="cps-columns">
          <Stat label="Daily" value={pd.vapy?.daily} suffix="%" />
          <Stat label="Weekly" value={pd.vapy?.weekly} suffix="%" />
        </div>
      </div>

      <div className="cps-card">
        <div className="cps-subtitle">Pool tokens</div>
        <div className="cps-list">
          {(pd.tokens || []).map((t, i) => <TokenRow key={i} t={t} />)}
          {(!pd.tokens || pd.tokens.length === 0) && <div className="cps-empty">Nessun dato token.</div>}
        </div>
      </div>

      <div className="cps-card">
        <div className="cps-subtitle">Wallet</div>
        <div className="cps-list">
          <div className="cps-row">
            <div className="cps-row-left">Address</div>
            <div className="cps-row-right mono">{wd.address || '—'}</div>
          </div>
          {(wd.tokenBalances || []).map((b, i) => (
            <div className="cps-row" key={i}>
              <div className="cps-row-left">{b.symbol}</div>
              <div className="cps-row-right">
                <span>{formatNumber(b.amount)}</span>
                <span className="cps-dot">•</span>
                <span>{b.usd != null ? `${formatNumber(b.usd)} $` : '—'}</span>
              </div>
            </div>
          ))}
          <div className="cps-row">
            <div className="cps-row-left">Staked</div>
            <div className="cps-row-right">{formatNumber(wd.stakedAmount)} LP</div>
          </div>
          <div className="cps-row">
            <div className="cps-row-left">Unstaked</div>
            <div className="cps-row-right">{formatNumber(wd.unstakedAmount)} LP</div>
          </div>
        </div>
      </div>

      <div className="cps-card">
        <div className="cps-subtitle">Contracts</div>
        <div className="cps-list">
          <div className="cps-row">
            <div className="cps-row-left">Pool</div>
            <div className="cps-row-right mono">{pd.contracts?.poolAddress || '—'}</div>
          </div>
          <div className="cps-row">
            <div className="cps-row-left">Gauge</div>
            <div className="cps-row-right mono">{pd.contracts?.gaugeAddress || '—'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatNumber(v) {
  if (v == null || Number.isNaN(Number(v))) return '—';
  try {
    if (Math.abs(v) >= 1000) {
      return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(v);
    }
    return `${Number(v).toFixed(2)}`;
  } catch {
    return String(v);
  }
}
