import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getChunk, listChunks } from '../api/client.js';
import type { ChunkDetail, ChunkPreview } from '../api/types.js';
import { useLibraryStats } from '../hooks.js';
import { EmptyState } from '../components/EmptyState.js';
import { Sparkline } from '../components/Sparkline.js';

function l2norm(v: number[]): number { return Math.sqrt(v.reduce((s, x) => s + x * x, 0)); }
function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i]! * b[i]!; na += a[i]! * a[i]!; nb += b[i]! * b[i]!; }
  return na === 0 || nb === 0 ? 0 : dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export function EmbeddingsPage() {
  const [params, setParams] = useSearchParams();
  const { documents, chunkCounts } = useLibraryStats();
  const completed = useMemo(() => documents.filter((d) => d.status === 'COMPLETED'), [documents]);
  const docId = params.get('doc') ?? completed[0]?.id ?? null;

  const [chunks, setChunks] = useState<ChunkPreview[]>([]);
  const [detail, setDetail] = useState<ChunkDetail | null>(null);
  const [compareIdx, setCompareIdx] = useState<number | ''>('');
  const [compareVec, setCompareVec] = useState<number[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selIdx = params.get('chunk') != null ? Number(params.get('chunk')) : null;

  useEffect(() => {
    if (!docId) return;
    setLoading(true);
    listChunks(docId, 200, 0)
      .then((r) => setChunks(r.chunks))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load chunks'))
      .finally(() => setLoading(false));
  }, [docId]);

  useEffect(() => {
    if (!docId || selIdx == null || Number.isNaN(selIdx)) { setDetail(null); return; }
    const row = chunks.find((c) => c.chunk_index === selIdx);
    if (!row) return;
    getChunk(docId, row.id)
      .then((r) => { setDetail(r.chunk); setError(null); })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load vector'));
  }, [docId, selIdx, chunks]);

  useEffect(() => {
    if (!docId || compareIdx === '' || detail == null) { setCompareVec(null); return; }
    const row = chunks.find((c) => c.chunk_index === compareIdx);
    if (!row) { setCompareVec(null); return; }
    getChunk(docId, row.id).then((r) => setCompareVec(r.chunk.embedding)).catch(() => setCompareVec(null));
  }, [docId, compareIdx, chunks, detail]);

  const providers = useMemo(() => {
    const m = new Map<string, { provider: string; model: string; dim: number; docs: number }>();
    for (const d of completed) {
      const key = `${d.embedding_provider ?? '?'}|${d.embedding_model ?? '?'}|${d.embedding_dim ?? '?'}`;
      const e = m.get(key) ?? { provider: d.embedding_provider ?? '—', model: d.embedding_model ?? '—', dim: d.embedding_dim ?? 0, docs: 0 };
      e.docs++;
      m.set(key, e);
    }
    return [...m.values()];
  }, [completed]);

  const vec = detail?.embedding ?? null;
  const sim = vec && compareVec && vec.length === compareVec.length ? cosine(vec, compareVec) : null;

  return (
    <div>
      <div className="eyebrow">Vector inspector · provider &amp; dimensions</div>
      <h1 className="title">Embeddings</h1>
      <p className="subtitle">Inspect the provider, dimensions, and stored vectors behind each chunk. Vectors shown on demand — never rendered in bulk.</p>
      {error && <div className="alert alert-error"><span className="mono">{error}</span></div>}

      <div className="grid-4" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {providers.length === 0 && <div className="card card-pad"><EmptyState icon="◈" title="No embeddings yet" hint="Process a document to record its embedding provider here." /></div>}
        {providers.map((p) => (
          <div key={`${p.provider}${p.model}${p.dim}`} className="card card-pad">
            <div className="stat-label">PROVIDER</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{p.provider}</div>
            <div className="kv"><span className="k">Model</span><span className="v">{p.model}</span></div>
            <div className="kv"><span className="k">Dimensions</span><span className="v">{p.dim}</span></div>
            <div className="kv"><span className="k">Documents</span><span className="v">{p.docs}</span></div>
          </div>
        ))}
      </div>

      <div className="card card-pad" style={{ marginBottom: 14 }}>
        <div className="eyebrow">Dimension compatibility</div>
        <div className="note">pgvector fixes one dimension per column — providers with different dims (mock 128 vs Gemini 768) can never share a column. Switching models requires a new vector column + backfill migration, never silent truncation. Rows whose dims mismatch the query are skipped at search time.</div>
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="card card-pad">
          <div className="eyebrow">Vector inspector</div>
          <div className="toolbar" style={{ marginTop: 8 }}>
            <select className="select grow" value={docId ?? ''} onChange={(e) => setParams(e.target.value ? { doc: e.target.value } : {})}>
              {completed.length === 0 && <option value="">No completed documents</option>}
              {completed.map((d) => <option key={d.id} value={d.id}>{d.original_filename} ({chunkCounts.get(d.id) ?? '?'} chunks)</option>)}
            </select>
          </div>
          <div className="toolbar">
            <select className="select grow" value={selIdx ?? ''} onChange={(e) => setParams(docId ? { doc: docId, ...(e.target.value ? { chunk: e.target.value } : {}) } : {})} disabled={chunks.length === 0}>
              <option value="">Select a chunk…</option>
              {chunks.map((c) => <option key={c.id} value={c.chunk_index}>#{String(c.chunk_index).padStart(3, '0')}{c.page_number != null ? ` · p.${c.page_number}` : ''} · {(c.token_estimate ?? '?')} tok</option>)}
            </select>
          </div>
          {loading && <div className="note">Loading…</div>}
          {!detail ? <EmptyState icon="◈" title="Pick a chunk" hint="Its stored vector loads here on demand." /> : vec ? (
            <div>
              <div className="kv"><span className="k">Chunk UUID</span><span className="v">{detail.id.slice(0, 18)}…</span></div>
              <div className="kv"><span className="k">Dimensions (actual)</span><span className="v">{vec.length}</span></div>
              <div className="kv"><span className="k">L2 norm (computed)</span><span className="v">{l2norm(vec).toFixed(4)}</span></div>
              <div className="eyebrow" style={{ marginTop: 10 }}>First 16 of {vec.length}</div>
              <div className="vec-box">[{vec.slice(0, 16).map((v) => v.toFixed(4)).join(', ')}]</div>
              <div className="eyebrow" style={{ marginTop: 10 }}>Shape</div>
              <Sparkline values={vec} width={320} height={52} />
            </div>
          ) : <div className="alert alert-error"><span className="mono">This chunk has no stored vector.</span></div>}
        </div>

        <div className="card card-pad">
          <div className="eyebrow">Pairwise cosine check (same math as the API)</div>
          <div className="note" style={{ marginBottom: 8 }}>Compare two stored vectors. With the mock provider this validates plumbing determinism only — <strong>it is not a semantic experiment</strong>.</div>
          <div className="toolbar">
            <select className="select grow" value={compareIdx} onChange={(e) => setCompareIdx(e.target.value === '' ? '' : Number(e.target.value))} disabled={!detail}>
              <option value="">Second chunk…</option>
              {chunks.filter((c) => c.chunk_index !== (selIdx ?? -1)).map((c) => <option key={c.id} value={c.chunk_index}>#{String(c.chunk_index).padStart(3, '0')}</option>)}
            </select>
          </div>
          {detail && compareIdx !== '' && (
            compareVec == null ? <div className="note">Loading second vector…</div>
            : vec && vec.length !== compareVec.length ? <div className="alert alert-error"><span className="mono">Dimension mismatch ({vec.length} vs {compareVec.length}) — the API skips such rows instead of comparing.</span></div>
            : sim != null ? (
              <div>
                <div style={{ fontSize: 28, fontWeight: 800 }}>cosine = {sim.toFixed(4)}</div>
                <div className="mono" style={{ color: 'var(--muted)' }}>distance = {(1 - sim).toFixed(4)} · similarity ∈ [-1, 1], not a probability</div>
              </div>
            ) : null
          )}
        </div>
      </div>
    </div>
  );
}
