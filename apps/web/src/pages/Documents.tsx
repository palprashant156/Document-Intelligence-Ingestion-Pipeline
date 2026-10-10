import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { deleteDocument, retryDocument, uploadDocuments, type UploadedItem } from '../api/client.js';
import { ApiError } from '../api/client.js';
import { MAX_FILE_SIZE_BYTES, SUPPORTED_EXTENSIONS, type Document, type FileExtension } from '../api/types.js';
import { useLibraryStats } from '../hooks.js';
import { Dropzone } from '../components/Dropzone.js';
import { EmptyState } from '../components/EmptyState.js';
import { FileIcon } from '../components/FileIcon.js';
import { StatCard } from '../components/StatCard.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { formatBytes, formatDateTime, timeAgo } from '../components/format.js';

interface UploadRow { name: string; state: 'uploading' | 'done' | 'error'; detail: string }

export function DocumentsPage() {
  const { documents, total, byStatus, storageBytes, chunkCounts, totalChunks, loading, error, refresh } = useLibraryStats();
  const [uploads, setUploads] = useState<UploadRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [filter, setFilter] = useState('');
  const [status, setStatus] = useState<'ALL' | Document['status']>('ALL');
  const [format, setFormat] = useState<'ALL' | FileExtension>('ALL');
  const [sort, setSort] = useState<'new' | 'old' | 'name'>('new');
  const [page, setPage] = useState(0);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const PAGE_SIZE = 10;

  async function handleFiles(files: File[]) {
    if (files.length === 0) return;
    setUploading(true);
    setUploads(files.map((f) => ({ name: f.name, state: 'uploading' as const, detail: 'Uploading + processing…' })));
    // Backend accepts ≤5 files per request — batch client-side.
    const batches: File[][] = [];
    for (let i = 0; i < files.length; i += 5) batches.push(files.slice(i, i + 5));
    const done: UploadedItem[] = [];
    const failed: string[] = [];
    for (const b of batches) {
      try {
        done.push(...(await uploadDocuments(b)));
      } catch (e) {
        failed.push(e instanceof ApiError ? `${e.code}: ${e.message}` : 'Upload failed');
      }
    }
    setUploads([
      ...done.map((d) => ({ name: d.document.original_filename, state: 'done' as const, detail: `${d.document.status} · ${d.chunks} chunk${d.chunks === 1 ? '' : 's'}` })),
      ...failed.map((detail) => ({ name: 'batch', state: 'error' as const, detail }))
    ]);
    setUploading(false);
    refresh();
  }

  async function onRetry(id: string) {
    setActionMsg(null);
    try {
      await retryDocument(id);
      refresh();
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : 'Retry failed');
    }
  }

  async function onDelete(doc: Document) {
    if (!window.confirm(`Delete "${doc.original_filename}" and its chunks?`)) return;
    setActionMsg(null);
    try {
      await deleteDocument(doc.id);
      refresh();
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  const rows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const out = documents.filter((d) =>
      (status === 'ALL' || d.status === status) &&
      (format === 'ALL' || d.file_extension === format) &&
      (!q || d.original_filename.toLowerCase().includes(q))
    );
    out.sort((a, b) =>
      sort === 'name' ? a.original_filename.localeCompare(b.original_filename) :
      sort === 'old' ? +new Date(a.created_at) - +new Date(b.created_at) :
      +new Date(b.created_at) - +new Date(a.created_at)
    );
    return out;
  }, [documents, filter, status, format, sort]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <h1 className="title">Documents <span className="chip">v0.9.4-local</span></h1>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="btn" onClick={refresh} disabled={loading}>⟳ Refresh</button>
          <button className="btn btn-primary" onClick={() => document.getElementById('dropzone')?.scrollIntoView({ behavior: 'smooth' })}>+ Upload documents</button>
        </span>
      </div>
      <p className="subtitle">Upload, process, and inspect your knowledge sources.</p>

      {error && <div className="alert alert-error"><span className="mono">{error} — is the API running?</span></div>}
      {actionMsg && <div className="alert alert-error"><span className="mono">{actionMsg}</span></div>}

      <div className="grid-4">
        <StatCard label="TOTAL DOCUMENTS" value={total} sub={<>{formatBytes(storageBytes)} total storage</>} barPct={total ? 100 : 0} />
        <StatCard label="INDEXED CHUNKS" value={totalChunks} sub={<><span className="good">{totalChunks} chunks in pgvector</span></>} barPct={total ? (totalChunks / Math.max(1, total * 50)) * 100 : 0} barClass="green" />
        <StatCard label="PROCESSING" value={byStatus.PROCESSING + byStatus.UPLOADED} sub={<span className="info">Active pipeline jobs</span>} barPct={total ? ((byStatus.PROCESSING + byStatus.UPLOADED) / total) * 100 : 0} />
        <StatCard label="⚠ ATTENTION REQUIRED" value={<span style={{ color: byStatus.FAILED ? 'var(--danger-ink)' : undefined }}>{byStatus.FAILED}</span>} sub={<span className="bad">Requires retry / review</span>} barPct={total ? (byStatus.FAILED / total) * 100 : 0} barClass="red" />
      </div>

      <div className="card card-pad" id="dropzone" style={{ marginBottom: 16 }}>
        <Dropzone onFiles={handleFiles} busy={uploading} />
        {uploads.length > 0 && (
          <div style={{ marginTop: 12 }}>
            {uploads.map((u, i) => (
              <div key={i} className="upload-item">
                {u.state === 'uploading' ? <span className="spin">⟳</span> : u.state === 'done' ? <span style={{ color: 'var(--success-ink)' }}>●</span> : <span style={{ color: 'var(--danger-ink)' }}>●</span>}
                <span className="mono" style={{ fontWeight: 600 }}>{u.name}</span>
                <span className="mono" style={{ color: 'var(--muted)' }}>{u.detail}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card card-pad">
        <div className="toolbar">
          <input className="input grow" placeholder="⌕ Filter by filename…" value={filter} onChange={(e) => { setFilter(e.target.value); setPage(0); }} />
          <select className="select" value={status} onChange={(e) => { setStatus(e.target.value as typeof status); setPage(0); }}>
            <option value="ALL">All Statuses</option><option value="COMPLETED">Completed</option><option value="PROCESSING">Processing</option><option value="UPLOADED">Uploaded</option><option value="FAILED">Failed</option>
          </select>
          <select className="select" value={format} onChange={(e) => { setFormat(e.target.value as typeof format); setPage(0); }}>
            <option value="ALL">All Formats</option>{SUPPORTED_EXTENSIONS.map((e) => <option key={e} value={e}>{e.toUpperCase()}</option>)}
          </select>
          <select className="select" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
            <option value="new">Newest first</option><option value="old">Oldest first</option><option value="name">Name A–Z</option>
          </select>
        </div>

        {loading && documents.length === 0 ? (
          <div className="empty"><div className="big"><span className="spin">⟳</span></div>Loading documents…</div>
        ) : rows.length === 0 ? (
          <EmptyState icon="🗂" title={documents.length === 0 ? 'No documents yet' : 'No matches'} hint={documents.length === 0 ? 'Upload your first PDF, DOCX, TXT, CSV or XLSX above.' : 'Try clearing the filters.'} />
        ) : (
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>DOCUMENT</th><th>FORMAT</th><th>SIZE</th><th>STATUS &amp; PIPELINE DETAILS</th><th>CHUNKS</th><th>UPLOADED</th><th>ACTIONS</th></tr></thead>
              <tbody>
                {pageRows.map((d) => (
                  <tr key={d.id} className={d.status === 'FAILED' ? 'row-failed' : undefined}>
                    <td><div className="cell-flex"><FileIcon ext={d.file_extension} /><span><div className="doc-name">{d.original_filename}</div><div className="doc-sub">{d.mime_type}</div></span></div></td>
                    <td><span className="chip">{d.file_extension.toUpperCase()}</span></td>
                    <td className="mono">{formatBytes(d.file_size_bytes)}</td>
                    <td>
                      <StatusBadge status={d.status} />
                      {d.status === 'FAILED' && d.error_message && <div className="doc-sub" style={{ color: 'var(--danger-ink)', marginTop: 4 }}>{d.error_message}</div>}
                    </td>
                    <td className="mono">{chunkCounts.get(d.id) ?? (d.status === 'COMPLETED' ? '…' : '—')}</td>
                    <td className="mono" title={formatDateTime(d.created_at)}>{timeAgo(d.created_at)}</td>
                    <td>
                      <span className="row-actions">
                        <Link className="btn" style={{ padding: '6px 10px' }} to={`/documents/${d.id}`} title="Inspect document">👁</Link>
                        <Link className="btn" style={{ padding: '6px 10px' }} to={`/explorer?doc=${d.id}`} title="Open in Chunk Explorer">▦</Link>
                        {d.status === 'FAILED' && <button className="btn" style={{ padding: '6px 10px' }} onClick={() => onRetry(d.id)} title="Retry processing">⟳ Retry</button>}
                        <button className="btn btn-danger-ghost" style={{ padding: '6px 10px' }} onClick={() => onDelete(d)} title="Delete document">🗑</button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="footer-note">
          <span>Page {page + 1} of {pages} · Showing {pageRows.length} of {rows.length} files · Storage engine: local files + PostgreSQL</span>
          <span style={{ display: 'flex', gap: 6 }}>
            <button className="btn" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
            <button className="btn btn-primary" disabled>{page + 1}</button>
            <button className="btn" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next</button>
          </span>
        </div>
      </div>
    </div>
  );
}
