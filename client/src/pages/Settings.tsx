import { useEffect, useState } from 'react';
import { health, resolveApiBase } from '../api/client.js';
import { MAX_FILE_SIZE_BYTES } from '../api/types.js';
import { formatBytes } from '../components/format.js';

export function SettingsPage() {
  const [base, setBase] = useState('');
  const [saved, setSaved] = useState<string | null>(null);
  const [ping, setPing] = useState<{ ok: boolean; detail: string } | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    try { setSaved(localStorage.getItem('documind.apiBase')); } catch { setSaved(null); }
  }, []);

  function save() {
    try {
      if (base.trim()) localStorage.setItem('documind.apiBase', base.trim());
      else localStorage.removeItem('documind.apiBase');
      setSaved(base.trim() || null);
    } catch { /* private mode */ }
  }

  async function test() {
    setChecking(true);
    setPing(null);
    try {
      const h = await health();
      setPing({ ok: h.status === 'ok', detail: `${h.service} · ${h.time}` });
    } catch (e) {
      setPing({ ok: false, detail: e instanceof Error ? e.message : 'Unreachable' });
    } finally {
      setChecking(false);
    }
  }

  return (
    <div>
      <div className="eyebrow">● Configuration</div>
      <h1 className="title">Settings</h1>
      <p className="subtitle">Connection and workspace limits. No secrets live in the browser — API keys stay on the backend.</p>

      <div className="card card-pad" style={{ marginBottom: 14, maxWidth: 720 }}>
        <div className="eyebrow">API connection</div>
        <div className="mono" style={{ margin: '6px 0 10px' }}>Effective base: <strong>{resolveApiBase()}</strong>{saved ? ' (override)' : ' (default)'}</div>
        <div className="toolbar">
          <input className="input mono grow" placeholder="http://localhost:4000/api (empty = default)" value={base} onChange={(e) => setBase(e.target.value)} />
          <button className="btn btn-primary" onClick={save}>Save</button>
          <button className="btn" onClick={test} disabled={checking}>{checking ? 'Testing…' : 'Test connection'}</button>
        </div>
        {ping && <div className={`alert ${ping.ok ? 'alert-info' : 'alert-error'}`}><span className="mono">{ping.ok ? `✓ ${ping.detail}` : `✗ ${ping.detail}`}</span></div>}
        <div className="note">Local dev proxies same-origin <span className="mono">/api</span> → <span className="mono">localhost:4000</span> (see <span className="mono">client/vite.config.ts</span>). For a deployed API, save its origin here or set <span className="mono">VITE_API_BASE</span> at build time.</div>
      </div>

      <div className="card card-pad" style={{ maxWidth: 720 }}>
        <div className="eyebrow">Workspace limits (enforced by the API)</div>
        <div className="kv"><span className="k">Max file size</span><span className="v">{formatBytes(MAX_FILE_SIZE_BYTES)} per file</span></div>
        <div className="kv"><span className="k">Max files / request</span><span className="v">5</span></div>
        <div className="kv"><span className="k">Allowed formats</span><span className="v">PDF · DOCX · TXT · CSV · XLSX</span></div>
        <div className="kv"><span className="k">Pipeline</span><span className="v">sync MVP (upload → searchable)</span></div>
        <div className="kv"><span className="k">Storage</span><span className="v">local files + PostgreSQL + pgvector</span></div>
      </div>
    </div>
  );
}
