import { useState } from 'react';
import { Link } from 'react-router-dom';
import { deleteDocument, retryDocument } from '../api/client.js';
import { useLibraryStats } from '../hooks.js';
import { EmptyState } from '../components/EmptyState.js';
import { FileIcon } from '../components/FileIcon.js';
import { StatCard } from '../components/StatCard.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { formatBytes, formatDateTime } from '../components/format.js';
import type { Document } from '../api/types.js';

/** Pipeline stage derived from the real document status (no fake percentages). */
function stageOf(d: Document): { label: string; cls: string } {
  switch (d.status) {
    case 'UPLOADED': return { label: 'Waiting (queued for pipeline)', cls: '' };
    case 'PROCESSING': return { label: 'Processing (sync pipeline)', cls: 'now' };
    case 'COMPLETED': return { label: 'Completed (6/6)', cls: 'done' };
    case 'FAILED': return { label: 'Failed — see diagnostics', cls: 'fail' };
  }
}

function elapsed(d: Document): string {
  const ms = +new Date(d.updated_at) - +new Date(d.created_at);
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function QueuePage() {
  const [auto, setAuto] = useState(true);
  const [hideDone, setHideDone] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const { documents, byStatus, total, chunkCounts, loading, error, refresh } = useLibraryStats(auto ? 5000 : undefined);

  const docs = documents.filter((d) => !hideDone || d.status !== 'COMPLETED');

  const active = docs.filter((d) => d.status === 'PROCESSING' || d.status === 'UPLOADED').length;
  const failed = docs.filter((d) => d.status === 'FAILED').length;

  async function onRetry(id: string) {
    setMsg(null);
    try { await retryDocument(id); refresh(); } catch (e) { setMsg(e instanceof Error ? e.message : 'Retry failed'); }
  }
  async function onDelete(doc: Document) {
    if (!window.confirm(`Delete "${doc.original_filename}"?`)) return;
    setMsg(null);
    try { await deleteDocument(doc.id); refresh(); } catch (e) { setMsg(e instanceof Error ? e.message : 'Delete failed'); }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <div className="eyebrow">Pipeline orchestration · synchronous MVP</div>
          <h1 className="title">Processing Queue</h1>
          <p className="subtitle">Track extraction, chunking, and embedding progress.</p>
        </div>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="badge b-neutral"><span className="dot" style={{ background: auto ? '#12b76a' : '#98a2b3' }} />Auto-refresh: {auto ? '5s' : 'off'}</span>
          <button className="btn" onClick={() => setAuto(!auto)}>{auto ? '❚❚ Pause queue' : '▶ Resume'}</button>
          <button className="btn" onClick={() => setHideDone(!hideDone)}>{hideDone ? 'Show completed' : 'Hide completed'}</button>
        </span>
      </div>

      {error && <div className="alert alert-error"><span className="mono">{error} — is the API running?</span></div>}
      {msg && <div className="alert alert-error"><span className="mono">{msg}</span></div>}

      <div className="grid-4">
        <StatCard label="ACTIVE JOBS" value={active} sub={<span className="info">Uploaded + processing</span>} />
        <StatCard label="QUEUE (SYNC MVP)" value={byStatus.UPLOADED} sub="Waiting for pipeline" />
        <StatCard label="COMPLETED" value={byStatus.COMPLETED} sub={<span className="good">Searchable documents</span>} barClass="green" barPct={total ? (byStatus.COMPLETED / total) * 100 : 0} />
        <StatCard label="⚠ ATTENTION" value={<span style={{ color: failed ? 'var(--danger-ink)' : undefined }}>{failed}</span>} sub={<span className="bad">Failed executions</span>} barClass="red" barPct={docs.length ? (failed / docs.length) * 100 : 0} />
      </div>

      <div className="card card-pad" style={{ marginBottom: 14 }}>
        <div className="mono" style={{ color: 'var(--muted)', marginBottom: 8 }}>STANDARD INGESTION STAGES · validate → extract → normalize → chunk → embed → persist</div>
        <div className="steps">
          <span className="step">1 Validating</span><span className="step">2 Extracting</span><span className="step">3 Normalizing</span>
          <span className="step">4 Chunking</span><span className="step">5 Embeddings</span><span className="step">6 Persisting</span>
        </div>
        <div className="note">MVP processes uploads synchronously inside the upload request — a row typically flips straight to Completed/Failed. Granular per-stage progress arrives with background workers (Phase 13+).</div>
      </div>

      <div className="card card-pad">
        {loading && docs.length === 0 ? (
          <div className="empty"><div className="big"><span className="spin">⟳</span></div>Loading queue…</div>
        ) : docs.length === 0 ? (
          <EmptyState icon="✓" title="Queue is clear" hint="Upload documents to see them flow through the pipeline here." />
        ) : (
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>DOCUMENT</th><th>CURRENT STAGE</th><th>STATUS</th><th>STARTED</th><th>DURATION ~</th><th>RESULT / DIAGNOSTICS</th><th></th></tr></thead>
              <tbody>
                {docs.map((d) => {
                  const st = stageOf(d);
                  return (
                    <tr key={d.id} className={d.status === 'FAILED' ? 'row-failed' : undefined}>
                      <td><div className="cell-flex"><FileIcon ext={d.file_extension} /><span><div className="doc-name">{d.original_filename}</div><div className="doc-sub">{formatBytes(d.file_size_bytes)}</div></span></div></td>
                      <td>
                        <div className="mono" style={{ fontWeight: 600 }}>{st.label}</div>
                        <div className={`progress ${d.status === 'PROCESSING' ? 'indet' : ''}`} style={{ marginTop: 8, minWidth: 140 }}>
                          <div style={{ width: d.status === 'COMPLETED' ? '100%' : d.status === 'FAILED' ? '35%' : d.status === 'PROCESSING' ? '40%' : '4%' }} />
                        </div>
                      </td>
                      <td><StatusBadge status={d.status} /></td>
                      <td className="mono" title={formatDateTime(d.created_at)}>{formatDateTime(d.created_at)}</td>
                      <td className="mono">{d.status === 'UPLOADED' ? '—' : elapsed(d)}</td>
                      <td className="mono" style={{ maxWidth: 260 }}>
                        {d.status === 'COMPLETED' ? <span style={{ color: 'var(--success-ink)' }}>{chunkCounts.get(d.id) ?? '…'} chunks saved</span>
                          : d.status === 'FAILED' ? <span style={{ color: 'var(--danger-ink)' }}>⚠ {d.error_message ?? 'failed'}</span>
                          : <span style={{ color: 'var(--muted)' }}>sync pipeline — refresh for status</span>}
                      </td>
                      <td><span className="row-actions">
                        <Link className="btn" style={{ padding: '6px 10px' }} to={`/documents/${d.id}`}>👁</Link>
                        {d.status === 'FAILED' && <button className="btn" style={{ padding: '6px 10px' }} onClick={() => onRetry(d.id)}>⟳</button>}
                        <button className="btn btn-danger-ghost" style={{ padding: '6px 10px' }} onClick={() => onDelete(d)}>🗑</button>
                      </span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="footer-note"><span>Showing {docs.length} queue events · Storage engine: PostgreSQL + local files</span><span>Queue memory: n/a (sync MVP)</span></div>
      </div>
    </div>
  );
}
