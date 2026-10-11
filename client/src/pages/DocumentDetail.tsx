import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { deleteDocument, getChunk, getDocument, listChunks, retryDocument } from '../api/client.js';
import type { ChunkPreview, DocumentDetail } from '../api/types.js';
import { EmptyState } from '../components/EmptyState.js';
import { FileIcon } from '../components/FileIcon.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { formatBytes, formatDateTime } from '../components/format.js';

export function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<DocumentDetail | null>(null);
  const [chunks, setChunks] = useState<ChunkPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    if (!id) return;
    setLoading(true);
    try {
      const d = await getDocument(id);
      setDetail(d);
      setError(null);
      try {
        const c = await listChunks(id, 20, 0);
        setChunks(c.chunks);
      } catch { setChunks([]); }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load document');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  async function onRetry() {
    if (!id) return;
    try { await retryDocument(id); await load(); } catch (e) { setMsg(e instanceof Error ? e.message : 'Retry failed'); }
  }
  async function onDelete() {
    if (!id || !detail) return;
    if (!window.confirm(`Delete "${detail.document.original_filename}" and its chunks?`)) return;
    try { await deleteDocument(id); navigate('/documents'); } catch (e) { setMsg(e instanceof Error ? e.message : 'Delete failed'); }
  }
  async function copyChunk(chunkId: string) {
    if (!id) return;
    try {
      const { chunk } = await getChunk(id, chunkId);
      await navigator.clipboard.writeText(chunk.content);
      setMsg('Chunk content copied to clipboard.');
    } catch { setMsg('Copy failed.'); }
  }

  if (loading) return <div className="empty"><div className="big"><span className="spin">⟳</span></div>Loading document…</div>;
  if (error || !detail) return <div><div className="alert alert-error"><span className="mono">{error ?? 'Not found'}</span></div><Link to="/documents">← Back to Documents</Link></div>;

  const d = detail.document;
  const job = detail.latestJob;

  return (
    <div>
      <Link to="/documents">← Documents</Link>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
        <FileIcon ext={d.file_extension} />
        <h1 className="title" style={{ margin: 0 }}>{d.original_filename}</h1>
        <StatusBadge status={d.status} />
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <Link className="btn" to={`/explorer?doc=${d.id}`}>▦ Open in Chunk Explorer</Link>
          {d.status === 'FAILED' && <button className="btn btn-primary" onClick={onRetry}>⟳ Retry</button>}
          <button className="btn btn-danger-ghost" onClick={onDelete}>🗑 Delete</button>
        </span>
      </div>
      <p className="subtitle">Document metadata, processing job, and chunk preview.</p>
      {msg && <div className="alert alert-info"><span className="mono">{msg}</span></div>}

      {d.status === 'FAILED' && d.error_message && (
        <div className="alert alert-error"><strong>Processing failed (safe message): </strong><span className="mono">{d.error_message}</span><div className="note" style={{ marginTop: 4 }}>Only FAILED documents can be retried — chunk writes are idempotent, so retry never duplicates.</div></div>
      )}

      <div className="grid-2" style={{ marginBottom: 14 }}>
        <div className="card card-pad">
          <div className="eyebrow">Metadata</div>
          <div className="kv"><span className="k">Original filename</span><span className="v">{d.original_filename}</span></div>
          <div className="kv"><span className="k">MIME type</span><span className="v">{d.mime_type}</span></div>
          <div className="kv"><span className="k">Extension</span><span className="v">{d.file_extension}</span></div>
          <div className="kv"><span className="k">Size</span><span className="v">{formatBytes(d.file_size_bytes)} ({d.file_size_bytes} bytes)</span></div>
          <div className="kv"><span className="k">SHA-256</span><span className="v">{d.sha256.slice(0, 24)}…</span></div>
          <div className="kv"><span className="k">Pages</span><span className="v">{d.page_count ?? '—'}</span></div>
          <div className="kv"><span className="k">Uploaded</span><span className="v">{formatDateTime(d.created_at)}</span></div>
          <div className="kv"><span className="k">Updated</span><span className="v">{formatDateTime(d.updated_at)}</span></div>
        </div>
        <div className="card card-pad">
          <div className="eyebrow">Embedding record</div>
          <div className="kv"><span className="k">Provider</span><span className="v">{d.embedding_provider ?? '—'}</span></div>
          <div className="kv"><span className="k">Model</span><span className="v">{d.embedding_model ?? '—'}</span></div>
          <div className="kv"><span className="k">Dimensions</span><span className="v">{d.embedding_dim ?? '—'}</span></div>
          <div className="kv"><span className="k">Chunks persisted</span><span className="v">{detail.chunkCount}</span></div>
          <div className="eyebrow" style={{ marginTop: 14 }}>Latest processing job</div>
          {job ? (
            <>
              <div className="kv"><span className="k">Status</span><span className="v">{job.status}</span></div>
              <div className="kv"><span className="k">Attempts</span><span className="v">{job.attempt_count}</span></div>
              <div className="kv"><span className="k">Started</span><span className="v">{job.started_at ? formatDateTime(job.started_at) : '—'}</span></div>
              <div className="kv"><span className="k">Completed</span><span className="v">{job.completed_at ? formatDateTime(job.completed_at) : '—'}</span></div>
              {job.error_message && <div className="kv"><span className="k">Error</span><span className="v">{job.error_message}</span></div>}
            </>
          ) : <div className="note">No job record.</div>}
        </div>
      </div>

      <div className="card card-pad">
        <div className="eyebrow">Chunks · first {chunks.length} of {detail.chunkCount}</div>
        {chunks.length === 0 ? (
          <EmptyState icon="▦" title="No chunks yet" hint="Chunks appear after successful processing." />
        ) : chunks.map((c) => (
          <div key={c.id} className="card card-pad" style={{ marginTop: 10, background: 'var(--border-soft)', borderColor: 'var(--border)' }}>
            <div className="result-head">
              <span className="chip">#{String(c.chunk_index).padStart(3, '0')}</span>
              {c.page_number != null && <span className="mono">Page {c.page_number}</span>}
              {c.sheet_name && <span className="mono">Sheet: {c.sheet_name}</span>}
              <span className="mono" style={{ color: 'var(--muted)' }}>{c.token_estimate ?? '?'} tokens est.</span>
              <span className="score-pill" style={{ display: 'flex', gap: 6 }}>
                <button className="btn" style={{ padding: '5px 10px' }} onClick={() => copyChunk(c.id)}>⧉ Copy</button>
                <Link className="btn" style={{ padding: '5px 10px' }} to={`/explorer?doc=${d.id}&chunk=${c.chunk_index}`}>Inspect →</Link>
              </span>
            </div>
            <div className="excerpt">{c.content.length > 400 ? c.content.slice(0, 400) + '…' : c.content}</div>
          </div>
        ))}
        {detail.chunkCount > chunks.length && <div className="note" style={{ marginTop: 10 }}>Open the <Link to={`/explorer?doc=${d.id}`}>Chunk Explorer</Link> to page through all {detail.chunkCount} chunks.</div>}
      </div>
    </div>
  );
}
