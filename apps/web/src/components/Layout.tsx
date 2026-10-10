import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { health, resolveApiBase } from '../api/client.js';

function apiBaseShort(): string {
  const b = resolveApiBase();
  return b === '/api' ? 'same-origin /api' : b.replace(/^https?:\/\//, '');
}

const NAV: Array<{ to: string; label: string; icon: string; badge?: () => string | null }> = [
  { to: '/', label: 'Overview', icon: '▦' },
  { to: '/documents', label: 'Documents', icon: '▤' },
  { to: '/queue', label: 'Processing Queue', icon: '☰' },
  { to: '/explorer', label: 'Chunk Explorer', icon: '▦' },
  { to: '/embeddings', label: 'Embeddings', icon: '◈' },
  { to: '/search', label: 'Semantic Search', icon: '⌕' }
];

export function Layout({ providerLabel }: { providerLabel: string }) {
  const [queueCount, setQueueCount] = useState<number | null>(null);
  const [apiOk, setApiOk] = useState<boolean | null>(null);
  const loc = useLocation();

  // Sidebar badge: real count of non-completed docs (lightweight list fetch).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const h = await health();
        if (!alive) return;
        setApiOk(h.status === 'ok');
        if (h.status !== 'ok') return;
        const { listDocuments } = await import('../api/client.js');
        const { documents } = await listDocuments(100, 0);
        if (alive) {
          const active = documents.filter((d) => d.status !== 'COMPLETED').length;
          setQueueCount(active > 0 ? active : null);
        }
      } catch {
        if (alive) { setApiOk(false); setQueueCount(null); }
      }
    })();
    return () => { alive = false; };
  }, [loc.pathname]);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">{'{ }'}</span><span className="brand-name">DocuMind</span></div>
        <span className="workspace-badge"><span className="dot" />Local Workspace</span>
        <nav className="nav">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              <span className="nav-icon">{n.icon}</span>{n.label}
              {n.to === '/queue' && queueCount != null && <span className="count">{queueCount}</span>}
            </NavLink>
          ))}
          <NavLink to="/settings" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <span className="nav-icon">⚙</span>Settings
          </NavLink>
        </nav>
        <div className="sidebar-foot">
          <div className="pg-badge">
            {apiOk == null ? '○ Checking API…' : apiOk ? (<><span className="dot" />API connected<br /></>) : (<>○ API unreachable<br /></>)}
            Backend: {apiBaseShort()}
          </div>
          <div className="user-card"><span className="avatar">DM</span><span><div className="who">local_engineer</div><div className="role">admin</div></span></div>
        </div>
      </aside>
      <div className="main">
        <div className="topbar">
          <span className="crumb"><strong>DocuMind</strong> / Workspace</span>
          <span className="topbar-right">
            <span className="env-badge">▤ Local dev · PostgreSQL</span>
            <span className="model-badge" title="Embedding provider reported by the API"><span className="dot" />Model: {providerLabel}</span>
            <span className="avatar-round">◔</span>
          </span>
        </div>
        <div className="page"><Outlet /></div>
      </div>
    </div>
  );
}
