import { useEffect, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import { listDocuments } from './api/client.js';
import { Layout } from './components/Layout.js';
import { ChunkExplorerPage } from './pages/ChunkExplorer.js';
import { DocumentDetailPage } from './pages/DocumentDetail.js';
import { DocumentsPage } from './pages/Documents.js';
import { EmbeddingsPage } from './pages/Embeddings.js';
import { OverviewPage } from './pages/Overview.js';
import { QueuePage } from './pages/Queue.js';
import { SearchPage } from './pages/Search.js';
import { SettingsPage } from './pages/Settings.js';

/** Topbar model badge reflects the REAL provider/dims reported by indexed docs. */
function useProviderLabel(): string {
  const [label, setLabel] = useState('no embeddings yet');
  useEffect(() => {
    let alive = true;
    listDocuments(20, 0)
      .then(({ documents }) => {
        if (!alive) return;
        const done = documents.find((d) => d.status === 'COMPLETED' && d.embedding_provider);
        if (done) {
          setLabel(`${done.embedding_provider} ${done.embedding_model ?? ''} · ${done.embedding_dim ?? '?'}d`.trim());
        }
      })
      .catch(() => { /* badge keeps fallback; Layout shows API status */ });
    return () => { alive = false; };
  }, []);
  return label;
}

export function App() {
  const providerLabel = useProviderLabel();
  return (
    <Routes>
      <Route element={<Layout providerLabel={providerLabel} />}>
        <Route index element={<OverviewPage />} />
        <Route path="documents" element={<DocumentsPage />} />
        <Route path="documents/:id" element={<DocumentDetailPage />} />
        <Route path="queue" element={<QueuePage />} />
        <Route path="explorer" element={<ChunkExplorerPage />} />
        <Route path="embeddings" element={<EmbeddingsPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<div className="empty"><div className="big">404</div>Unknown page — <a href="/">go home</a>.</div>} />
      </Route>
    </Routes>
  );
}
