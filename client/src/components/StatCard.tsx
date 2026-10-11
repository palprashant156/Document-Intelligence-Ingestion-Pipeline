import type { ReactNode } from 'react';

export function StatCard({ label, value, sub, barPct, barClass }: { label: string; value: ReactNode; sub?: ReactNode; barPct?: number; barClass?: string }) {
  return (
    <div className="card stat-card">
      <div className="stat-label"><span>{label}</span></div>
      <div className="stat-value">{value}</div>
      {sub != null && <div className="stat-sub">{sub}</div>}
      {barPct != null && (
        <div className={`bar ${barClass ?? ''}`}><div style={{ width: `${Math.min(100, Math.max(0, barPct))}%` }} /></div>
      )}
    </div>
  );
}
