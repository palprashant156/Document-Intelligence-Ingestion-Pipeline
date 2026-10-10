import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { listChunks } from '../api/client.js';
import type { ChunkPreview } from '../api/types.js';
import { useLibraryStats } from '../hooks.js';
import { EmptyState } from '../components/EmptyState.js';

const PAGE_SIZE = 10;
const FETCH_LIMIT = 200;

function words(s: string): string[] { return s.split(/\s+/).filter(Boolean); }
function commonPrefix(a: string[], b: string[]): number {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n++;
  return n;
}
function commonSuffix(a: string[], b: string[]): number {
  let n = 0;
  while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n++;
  return n;
}

export function ChunkExplorerPage() {
  const [params, setParams] = useSearchParams();
  const { documents, chunkCounts } = useLibraryStats();
  const completed = useMemo(() => documents.filter((d) => d.status === 'COMPLETED'), [documents]);
  const docId = params.get('doc') ?? completed[0]?.id ?? null;

  const [chunks, setChunks] = useState<ChunkPreview[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [asc, setAsc] = useState(true);
  const [page, setPage] = useState(0);
  const [selIdx, setSelIdx] = useState<number | null>(null);
  const [showJson, setShowJson] = useState(false);

  useEffect(() => {
    if (!docId) { setChunks([]); setTotal(0); return; }
    setLoading(true);
    listChunks(docId, FETCH_LIMIT, 0)
      .then((r) => { setChunks(r.chunks); setTotal(r.total); setError(null); })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load chunks'))
      .finally(() => setLoading(false));
  }, [docId]);

  // Keep selection valid; honor ?chunk= deep link.
  useEffect(() => {
    const want = params.get('chunk');
    if (want != null && chunks.length > 0) {
      const i = chunks.findIndex((c) => c.chunk_index === Number(want));
      if (i >= 0) { setSelIdx(chunks[i]!.chunk_index); return; }
    }
    if (chunks.length > 0 && (selIdx == null || !chunks.some((c) => c.chunk_index === selIdx))) {
      setSelIdx(chunks[0]!.chunk_index);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chunks]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = needle ? chunks.filter((c) => c.content.toLowerCase().includes(needle)) : [...chunks];
    out.sort((a, b) => (asc ? a.chunk_index - b.chunk_index : b.chunk_index - a.chunk_index));
    return out;
  }, [chunks, q, asc]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const sel = selIdx != null ? chunks.find((c) => c.chunk_index === selIdx) ?? null : null;
  const selPos = sel ? chunks.findIndex((c) => c.id === sel.id) : -1;
  const prev = selPos > 0 ? chunks[selPos - 1]! : null;
  const next = selPos >= 0 && selPos < chunks.length - 1 ? chunks[selPos + 1]! : null;

  // Derived word overlap with real neighbours (counts + samples, not token claims).
  const overlap = useMemo(() => {
    if (!sel) return null;
    const w = words(sel.content);
    const lead = prev ? Math.min(commonPrefix(w, words(prev.content)), w.length) : 0;
    const trail = next ? Math.min(commonSuffix(w, words(next.content)), w.length) : 0;
    return { lead, trail, total: w.length };
  }, [sel, prev, next]);

  function renderContent(): React.ReactNode {
    if (!sel || !overlap) return null;
    const w = words(sel.content);
    let { lead, trail } = overlap;
    if (lead + trail > w.length) {
      // Tiny chunk: clamp display ranges, counts stay honest.
      const scale = w.length / (lead + trail);
      lead = Math.floor(lead * scale);
      trail = w.length - lead;
    }
    const head = w.slice(0, lead).join(' ');
    const tail = w.slice(w.length - trail).join(' ');
    const mid = w.slice(lead, w.length - trail).join(' ');
    return (
      <span>
        {lead > 0 && <span className="hl-lead">{head} </span>}
        {mid}
        {trail > 0 && <span className="hl-trail"> {tail}</span>}
      </span>
    );
  }

  const doc = documents.find((d) => d.id === docId);

  return (
    <div>
      <div className="eyebrow">Chunk inspector · word-overlap diagnostics</div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <h1 className="title" style={{ margin: 0 }}>Chunk Explorer</h1>
        <span style={{ marginLeft: 'auto' }}>
          <select className="select" value={docId ?? ''} onChange={(e) => { setParams(e.target.value ? { doc: e.target.value } : {}); setPage(0); setSelIdx(null); }}>
            {completed.length === 0 && <option value="">No completed documents</option>}
            {completed.map((d) => <option key={d.id} value={d.id}>{d.original_filename} ({chunkCounts.get(d.id) ?? '?'} chunks)</option>)}
          </select>
        </span>
      </div>
      <p className="subtitle">Inspect how extracted document semantics are partitioned, overlapped, and indexed for vector retrieval.</p>
      {error && <div className="alert alert-error"><span className="mono">{error}</span></div>}

      <div className="toolbar">
        <input className="input grow mono" placeholder="Filter chunks in this document…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
        <button className="btn" onClick={() => setAsc(!asc)}>{asc ? '↑ Ascending' : '↓ Descending'}</button>
      </div>

      <div className="grid-2" style={{ gridTemplateColumns: 'minmax(340px, 5fr) minmax(0, 7fr)', alignItems: 'start' }}>
        <div>
          <div className="mono" style={{ color: 'var(--muted)', marginBottom: 8 }}>EXTRACTED CHUNKS · showing {pageRows.length} of {filtered.length}{total > FETCH_LIMIT ? ` (first ${FETCH_LIMIT} of ${total} fetched)` : ''}</div>
          {loading ? <div className="empty">Loading chunks…</div>
            : pageRows.length === 0 ? <div className="card"><EmptyState icon="▦" title="No chunks" hint={docId ? 'Try clearing the filter.' : 'Process a document first.'} /></div>
            : pageRows.map((c) => (
              <div key={c.id} className="card card-pad" onClick={() => setSelIdx(c.chunk_index)}
                style={{ marginBottom: 10, cursor: 'pointer', borderLeft: sel?.id === c.id ? '4px solid var(--primary)' : undefined }}>
                <div className="result-head">
                  <span className="chip">#{String(c.chunk_index).padStart(3, '0')}</span>
                  {c.page_number != null && <span className="mono">Page {c.page_number}</span>}
                  <span className="mono" style={{ color: 'var(--muted)' }}>{c.token_estimate ?? '?'} tokens · {c.content.length.toLocaleString()} chars</span>
                </div>
                <div className="excerpt">{c.content.slice(0, 220)}{c.content.length > 220 ? '…' : ''}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                  <span className="mono" style={{ color: 'var(--success-ink)' }}>● {c.embedding ? 'Embedded' : 'No vector'}</span>
                  <span className="mono" style={{ color: sel?.id === c.id ? 'var(--primary)' : 'var(--muted)' }}>{sel?.id === c.id ? 'Inspecting' : 'Select ›'}</span>
                </div>
              </div>
            ))}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
            <button className="btn" disabled={page === 0} onClick={() => setPage(page - 1)}>← Prev {PAGE_SIZE}</button>
            <span className="mono" style={{ color: 'var(--muted)' }}>Viewing {page * PAGE_SIZE + 1}–{Math.min(filtered.length, (page + 1) * PAGE_SIZE)} of {filtered.length}</span>
            <button className="btn" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next {PAGE_SIZE} →</button>
          </div>
        </div>

        <div>
          {!sel ? <div className="card"><EmptyState icon="🔍" title="Select a chunk" hint="Click any chunk on the left to inspect it." /></div> : (
            <div className="card invest">
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="rank-tag">#{String(sel.chunk_index).padStart(2, '0')}</span>
                <h3>Chunk #{sel.chunk_index} of {total}</h3>
                {sel.page_number != null && <span className="chip">Pages: {sel.page_number}</span>}
                {doc && <span className="mono" style={{ color: 'var(--muted)' }}>▤ {doc.original_filename}</span>}
              </div>
              {overlap && (overlap.lead > 0 || overlap.trail > 0) && (
                <div className="note-box" style={{ marginTop: 10 }}>
                  <span className="mono">Derived word overlap (real neighbour comparison): </span>
                  <span className="mono">leading <strong>{overlap.lead}</strong> words shared with #{sel.chunk_index - 1} · trailing <strong>{overlap.trail}</strong> words shared with #{sel.chunk_index + 1}</span>
                </div>
              )}
              <div className="grid-4" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginTop: 12 }}>
                <div><div className="mono" style={{ color: 'var(--muted)' }}>Token estimate</div><div style={{ fontSize: 20, fontWeight: 700 }}>{sel.token_estimate ?? '—'}</div><div className="mono" style={{ color: 'var(--muted)' }}>≈ words × 1.33</div></div>
                <div><div className="mono" style={{ color: 'var(--muted)' }}>Characters</div><div style={{ fontSize: 20, fontWeight: 700 }}>{sel.content.length.toLocaleString()}</div></div>
                <div><div className="mono" style={{ color: 'var(--muted)' }}>Words</div><div style={{ fontSize: 20, fontWeight: 700 }}>{overlap?.total ?? words(sel.content).length}</div></div>
                <div><div className="mono" style={{ color: 'var(--muted)' }}>Vector</div><div style={{ fontSize: 20, fontWeight: 700, color: sel.embedding ? 'var(--success-ink)' : 'var(--danger-ink)' }}>{sel.embedding ? '● Active' : '○ Missing'}</div></div>
              </div>
              <div className="eyebrow" style={{ marginTop: 14 }}>Raw extracted text stream {showJson ? '' : <><button className="link-btn" onClick={() => setShowJson(true)}>· View JSON</button></>}</div>
              {showJson ? (
                <div><button className="link-btn" onClick={() => setShowJson(false)}>View text</button>
                <div className="vec-box">{JSON.stringify({ id: sel.id, document_id: sel.document_id, chunk_index: sel.chunk_index, token_estimate: sel.token_estimate, page_number: sel.page_number, sheet_name: sel.sheet_name, metadata: sel.chunk_metadata, content_preview: sel.content.slice(0, 120) }, null, 2)}</div></div>
              ) : <div className="excerpt" style={{ background: '#f4f6fb' }}>{renderContent()}</div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <button className="btn" disabled={!prev} onClick={() => prev && setSelIdx(prev.chunk_index)}>← Chunk #{prev ? String(prev.chunk_index).padStart(3, '0') : '—'}</button>
                <button className="btn" disabled={!next} onClick={() => next && setSelIdx(next.chunk_index)}>Chunk #{next ? String(next.chunk_index).padStart(3, '0') : '—'} →</button>
                <span style={{ marginLeft: 'auto' }}>
                  <Link className="btn btn-primary" to={`/embeddings?doc=${docId}&chunk=${sel.chunk_index}`}>Inspect Vector in Embeddings ⧉</Link>
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
