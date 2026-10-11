import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getChunk, listChunks, search } from '../api/client.js';
import { SUPPORTED_EXTENSIONS, type ChunkPreview, type FileExtension, type SearchResult } from '../api/types.js';
import { useLibraryStats } from '../hooks.js';
import { EmptyState } from '../components/EmptyState.js';
import { FileIcon } from '../components/FileIcon.js';

/** Highlight real query-term hits in excerpts (keyword match, not a semantic claim). */
function highlight(content: string, query: string): React.ReactNode {
  const terms = [...new Set(query.toLowerCase().split(/[^a-z0-9$€£₹¥]+/).filter((t) => t.length > 2))];
  if (terms.length === 0) return content;
  const re = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  const parts = content.split(re);
  return parts.map((p, i) => (i % 2 === 1 ? <mark key={i}>{p}</mark> : <span key={i}>{p}</span>));
}

function queryTermsIn(query: string, content: string): string[] {
  const low = content.toLowerCase();
  return [...new Set(query.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2 && low.includes(t)))];
}

export function SearchPage() {
  const { documents, chunkCounts } = useLibraryStats();
  const completed = useMemo(() => documents.filter((d) => d.status === 'COMPLETED'), [documents]);

  const [query, setQuery] = useState('What is the policy for remote work stipends and equipment?');
  const [topK, setTopK] = useState(5);
  const [docId, setDocId] = useState<string>('ALL');
  const [formats, setFormats] = useState<FileExtension[]>([...SUPPORTED_EXTENSIONS]);
  const [minScore, setMinScore] = useState(0);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [roundTripMs, setRoundTripMs] = useState<number | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [inspectId, setInspectId] = useState<string | null>(null);
  const [fullText, setFullText] = useState<Map<string, string>>(new Map());
  const [neighbors, setNeighbors] = useState<ChunkPreview[]>([]);

  const shown = useMemo(() => results.filter((r) => r.score >= minScore), [results, minScore]);
  const inspect = shown.find((r) => r.chunkId === inspectId) ?? shown[0] ?? null;

  async function run() {
    const q = query.trim();
    if (!q || searching) return;
    setSearching(true);
    setError(null);
    const t0 = performance.now();
    try {
      const r = await search(q, topK, {
        documentId: docId === 'ALL' ? null : docId,
        fileTypes: formats.length === SUPPORTED_EXTENSIONS.length ? null : formats
      });
      setResults(r.results);
      setRoundTripMs(Math.round(performance.now() - t0));
      setSearched(true);
      setInspectId(r.results[0]?.chunkId ?? null);
      setFullText(new Map());
      setNeighbors([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  }

  async function investigate(r: SearchResult) {
    setInspectId(r.chunkId);
    // Load full chunk context + neighbours on demand (real API data).
    try {
      const [full, list] = await Promise.all([
        getChunk(r.documentId, r.chunkId).catch(() => null),
        listChunks(r.documentId, 200, 0).catch(() => null)
      ]);
      if (full) setFullText((m) => new Map(m).set(r.chunkId, full.chunk.content));
      if (list) {
        const idx = list.chunks.findIndex((c) => c.id === r.chunkId);
        setNeighbors([list.chunks[idx - 1], list.chunks[idx + 1]].filter((c): c is ChunkPreview => !!c));
      }
    } catch { /* investigation extras are best-effort */ }
  }

  function toggleFormat(f: FileExtension) {
    setFormats((cur) => (cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f]));
  }

  const doc = inspect ? documents.find((d) => d.id === inspect.documentId) : null;

  return (
    <div>
      <div className="eyebrow">● Vector inspector &amp; query execution</div>
      <h1 className="title">Semantic Search</h1>
      <p className="subtitle">Find relevant passages across your processed documents with cosine proximity diagnostics.</p>

      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div className="mono" style={{ color: 'var(--muted)', marginBottom: 8 }}>
          Provider: <strong>{doc?.embedding_provider ?? '—'}</strong> · {doc?.embedding_model ?? 'no index yet'} · {doc?.embedding_dim ?? '?'} dims · Metric: Cosine Similarity
        </div>
        <div className="search-box">
          <input className="input" placeholder="Ask about your documents…" value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') run(); }} />
          <button className="btn btn-primary" onClick={run} disabled={searching || !query.trim() || completed.length === 0}>
            {searching ? <span className="spin">⟳</span> : '▶'} Search
          </button>
        </div>
        <div className="toolbar" style={{ marginTop: 12, marginBottom: 0 }}>
          <span className="mono">Top K:</span>
          <span className="seg">{[3, 5, 10].map((k) => <button key={k} className={topK === k ? 'on' : ''} onClick={() => setTopK(k)}>{k}</button>)}</span>
          <select className="select" value={docId} onChange={(e) => setDocId(e.target.value)}>
            <option value="ALL">🗂 All documents · {completed.length} indexed</option>
            {completed.map((d) => <option key={d.id} value={d.id}>{d.original_filename} ({chunkCounts.get(d.id) ?? '?'} chunks)</option>)}
          </select>
          <span className="checks">
            {SUPPORTED_EXTENSIONS.map((f) => (
              <label key={f} className="check"><input type="checkbox" checked={formats.includes(f)} onChange={() => toggleFormat(f)} />{f.toUpperCase()}</label>
            ))}
          </span>
          <span className="mono">Min score (client filter): <input type="range" min={0} max={0.95} step={0.05} value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} /> <strong>&gt; {minScore.toFixed(2)}</strong></span>
        </div>
        <div className="mono" style={{ color: 'var(--muted)', marginTop: 8 }}>Active: pgvector ⟷ cosine distance · score = similarity (higher = closer)</div>
      </div>

      {error && <div className="alert alert-error"><span className="mono">{error}</span></div>}
      {completed.length === 0 && <div className="alert alert-info">No indexed documents yet — <Link to="/documents">upload and process</Link> something first.</div>}

      {!searched ? (
        <div className="card"><EmptyState icon="⌕" title="Run a search" hint="Results with ranked chunks and an investigation panel appear here." /></div>
      ) : shown.length === 0 ? (
        <div className="card"><EmptyState icon="∅" title={results.length === 0 ? 'No matches' : `All ${results.length} results below min score ${minScore.toFixed(2)}`} hint="Lower the min-score slider or broaden the filters." /></div>
      ) : (
        <div className="grid-2" style={{ gridTemplateColumns: 'minmax(0, 7fr) minmax(340px, 5fr)', alignItems: 'start' }}>
          <div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', marginBottom: 10 }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>Ranked Results <span className="chip">{shown.length} match{minScore > 0 ? `es > ${minScore.toFixed(2)}` : 'es'}</span></h2>
              <span className="mono" style={{ marginLeft: 'auto', color: 'var(--muted)' }}>Sort: Highest Similarity First{roundTripMs != null ? ` · ${roundTripMs} ms round-trip` : ''}</span>
            </div>
            {shown.map((r, i) => (
              <div key={r.chunkId} className={`card result-card ${i === 0 ? 'rank1' : ''}`}>
                <div className="result-head">
                  <span className="rank-tag">#{i + 1}</span>
                  <FileIcon ext={r.fileExtension} />
                  <span className="result-file">{r.originalFilename}</span>
                  <span className="badge b-completed score-pill">● Cosine Similarity: {r.score.toFixed(3)}</span>
                </div>
                <div className="result-meta">Page {r.pageNumber ?? '—'}{r.sheetName ? ` · Sheet ${r.sheetName}` : ''} · Chunk #{String(r.chunkIndex).padStart(3, '0')}</div>
                <div className="excerpt">{highlight(r.content, query)}</div>
                <div className="result-actions">
                  <button className="btn btn-primary" style={{ padding: '7px 14px' }} onClick={() => investigate(r)}>◉ Investigate Result</button>
                  <button className="link-btn" onClick={() => investigate(r)}>View Full Chunk</button>
                  <span style={{ marginLeft: 'auto' }}><Link to={`/documents/${r.documentId}`}>Open Document ⧉</Link></span>
                </div>
                {fullText.get(r.chunkId) && fullText.get(r.chunkId)!.length > r.content.length && (
                  <div className="excerpt" style={{ background: '#f4f6fb' }}><strong>Full chunk:</strong> {fullText.get(r.chunkId)}</div>
                )}
              </div>
            ))}
          </div>

          {inspect && (
            <div className="card invest" style={{ position: 'sticky', top: 76 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <h3>● Investigation: Rank #{shown.findIndex((r) => r.chunkId === inspect.chunkId) + 1}</h3>
                <span className="badge b-neutral" style={{ marginLeft: 'auto' }}>Cos Sim {inspect.score.toFixed(3)}</span>
              </div>
              <div className="kv"><span className="k">Cosine distance (1 − sim)</span><span className="v">{(1 - inspect.score).toFixed(3)}</span></div>
              <div className="kv"><span className="k">Query terms in chunk</span><span className="v">{queryTermsIn(query, fullText.get(inspect.chunkId) ?? inspect.content).join(', ') || '—'}</span></div>
              <div className="eyebrow" style={{ marginTop: 10 }}>Why did this chunk appear?</div>
              <div className="note-box note">Query vector matched chunk #{inspect.chunkIndex} at distance {(1 - inspect.score).toFixed(3)} (similarity {inspect.score.toFixed(3)}). Scores are cosine similarities over stored vectors — <strong>not calibrated probabilities</strong>. Keyword overlap above is shown for orientation only.</div>
              <div className="eyebrow" style={{ marginTop: 10 }}>Complete chunk context</div>
              <div className="vec-box" style={{ whiteSpace: 'pre-wrap' }}>[Source: {inspect.originalFilename}{inspect.pageNumber != null ? ` · Page ${inspect.pageNumber}` : ''} · Chunk #{String(inspect.chunkIndex).padStart(3, '0')}] {fullText.get(inspect.chunkId) ?? inspect.content}</div>
              {neighbors.length > 0 && (
                <><div className="eyebrow" style={{ marginTop: 10 }}>Adjacent chunks</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {neighbors.map((n) => (
                    <button key={n.id} className="btn" style={{ flex: 1 }} onClick={() => investigate({ ...inspect, chunkId: n.id, chunkIndex: n.chunk_index, content: n.content, pageNumber: n.page_number, sheetName: n.sheet_name })}>
                      #{String(n.chunk_index).padStart(3, '0')} · {(n.token_estimate ?? '?')} tok
                    </button>
                  ))}
                </div></>
              )}
              <div className="eyebrow" style={{ marginTop: 10 }}>Vector storage record</div>
              <div className="kv"><span className="k">PostgreSQL table</span><span className="v">document_chunks</span></div>
              <div className="kv"><span className="k">Dimensions</span><span className="v">{doc?.embedding_dim ?? '?'} ({doc?.embedding_model ?? '?'})</span></div>
              <div className="kv"><span className="k">Chunk UUID</span><span className="v">{inspect.chunkId.slice(0, 18)}…</span></div>
              <div className="kv"><span className="k">Distance metric</span><span className="v">⟷ cosine distance {(1 - inspect.score).toFixed(3)}</span></div>
              {doc?.embedding_dim === 128 && <><div className="eyebrow" style={{ marginTop: 8 }}>Note</div><div className="note">128-dim mock vectors are deterministic plumbing — switch the backend to Gemini for genuine semantic ranking.</div></>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
