import { useCallback, useEffect, useRef, useState } from 'react';
import { getDocument, listDocuments } from './api/client.js';
import type { Document } from './api/types.js';

export interface StatusCounts { UPLOADED: number; PROCESSING: number; COMPLETED: number; FAILED: number; }

export interface LibraryStats {
  documents: Document[];
  total: number;
  byStatus: StatusCounts;
  storageBytes: number;
  /** chunkCount per document id (only for docs successfully detailed). */
  chunkCounts: Map<string, number>;
  totalChunks: number;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/** Library-wide stats. Chunk counts come from real detail calls (settled, best-effort). */
export function useLibraryStats(pollMs?: number): LibraryStats {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [total, setTotal] = useState(0);
  const [chunkCounts, setChunkCounts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const refresh = useCallback(() => {
    const my = ++seq.current;
    setLoading(true);
    (async () => {
      try {
        const { documents: docs, total: t } = await listDocuments(100, 0);
        if (seq.current !== my) return;
        setDocuments(docs);
        setTotal(t);
        setError(null);
        const settled = await Promise.allSettled(docs.map((d) => getDocument(d.id)));
        if (seq.current !== my) return;
        const counts = new Map<string, number>();
        settled.forEach((r, i) => {
          if (r.status === 'fulfilled') counts.set(docs[i]!.id, r.value.chunkCount);
        });
        setChunkCounts(counts);
      } catch (e) {
        if (seq.current !== my) return;
        setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        if (seq.current === my) setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    refresh();
    if (pollMs && pollMs > 0) {
      const t = setInterval(refresh, pollMs);
      return () => clearInterval(t);
    }
    return () => { seq.current++; };
  }, [refresh, pollMs]);

  const byStatus: StatusCounts = { UPLOADED: 0, PROCESSING: 0, COMPLETED: 0, FAILED: 0 };
  let storageBytes = 0;
  let totalChunks = 0;
  for (const d of documents) {
    byStatus[d.status]++;
    storageBytes += d.file_size_bytes;
  }
  for (const c of chunkCounts.values()) totalChunks += c;

  return { documents, total, byStatus, storageBytes, chunkCounts, totalChunks, loading, error, refresh };
}
