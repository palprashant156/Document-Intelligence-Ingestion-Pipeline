import { Link } from 'react-router-dom';
import { useLibraryStats } from '../hooks.js';
import { EmptyState } from '../components/EmptyState.js';
import { StatCard } from '../components/StatCard.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { formatBytes, timeAgo } from '../components/format.js';

export function OverviewPage() {
  const { documents, total, byStatus, storageBytes, totalChunks, loading, error } = useLibraryStats();
  const recent = [...documents].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)).slice(0, 5);

  return (
    <div>
      <div className="eyebrow">● Workspace at a glance</div>
      <h1 className="title">Overview</h1>
      <p className="subtitle">Library health, recent activity, and where to go next.</p>
      {error && <div className="alert alert-error"><span className="mono">{error} — is the API running?</span></div>}

      <div className="grid-4">
        <StatCard label="DOCUMENTS" value={loading ? '…' : total} sub={<>{formatBytes(storageBytes)} stored</>} />
        <StatCard label="INDEXED CHUNKS" value={loading ? '…' : totalChunks} sub={<span className="good">searchable vectors</span>} barClass="green" barPct={total ? Math.min(100, (totalChunks / Math.max(1, total * 20)) * 100) : 0} />
        <StatCard label="IN PIPELINE" value={loading ? '…' : byStatus.PROCESSING + byStatus.UPLOADED} sub="uploaded + processing" />
        <StatCard label="FAILED" value={loading ? '…' : byStatus.FAILED} sub={byStatus.FAILED ? <span className="bad">needs review → queue</span> : 'all clear'} barClass="red" barPct={total ? (byStatus.FAILED / total) * 100 : 0} />
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="card card-pad">
          <div className="eyebrow">Recent documents</div>
          {recent.length === 0 ? <EmptyState icon="🗂" title="Nothing here yet" hint="Upload documents to populate your workspace." />
            : recent.map((d) => (
              <div key={d.id} className="upload-item">
                <StatusBadge status={d.status} />
                <Link to={`/documents/${d.id}`} className="mono" style={{ fontWeight: 600 }}>{d.original_filename}</Link>
                <span className="mono" style={{ marginLeft: 'auto', color: 'var(--muted)' }}>{timeAgo(d.created_at)}</span>
              </div>
            ))}
        </div>
        <div className="card card-pad">
          <div className="eyebrow">Getting started</div>
          <div className="upload-item"><span>1.</span><Link to="/documents">Upload</Link><span className="note">PDF, DOCX, TXT, CSV, XLSX — max 10 MB each.</span></div>
          <div className="upload-item"><span>2.</span><Link to="/queue">Watch the queue</Link><span className="note">validate → extract → normalize → chunk → embed → persist.</span></div>
          <div className="upload-item"><span>3.</span><Link to="/explorer">Inspect chunks</Link><span className="note">overlap, tokens, pages, vectors.</span></div>
          <div className="upload-item"><span>4.</span><Link to="/search">Search</Link><span className="note">ranked cosine-similarity retrieval with filters.</span></div>
          <div className="note-box note" style={{ marginTop: 10 }}>Default embeddings are a deterministic <strong>mock</strong> (pipeline testing only — not semantic). Point the backend at Gemini for real semantic search.</div>
        </div>
      </div>
    </div>
  );
}
