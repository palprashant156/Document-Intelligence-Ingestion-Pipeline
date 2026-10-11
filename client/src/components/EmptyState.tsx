export function EmptyState({ icon, title, hint }: { icon: string; title: string; hint?: string }) {
  return (
    <div className="empty">
      <div className="big">{icon}</div>
      <div style={{ fontWeight: 600, color: 'var(--ink-2)' }}>{title}</div>
      {hint && <div className="note" style={{ marginTop: 6 }}>{hint}</div>}
    </div>
  );
}
