/**
 * Retrieval evaluation (no DB needed): 10 hand-labelled queries over a tiny
 * in-memory corpus using the REAL chunker + mock provider + cosine ranking.
 * Metrics: Precision@K, Recall@K, MRR.
 * NOTE: mock vectors are deterministic keyword-hash proxies, NOT semantic.
 * These numbers validate plumbing/ranking determinism, not production quality.
 */
import { chunkText } from '../src/documents/chunking/chunker.js';
import { MockEmbeddingProvider } from '../src/embeddings/mockProvider.js';
import { cosineSimilarity } from '../src/embeddings/provider.js';

const CORPUS: Array<{ id: string; text: string }> = [
  { id: 'handbook', text: 'Employee leave policy. Employees may request up to 12 days of annual leave per year. Sick leave requires a doctor note after 3 days. Maternity leave is 26 weeks paid.' },
  { id: 'expenses', text: 'Expense reimbursement policy. Submit receipts within 30 days. Meals capped at 25 per day. Travel must be pre-approved by a manager.' },
  { id: 'security', text: 'Security policy. Enable two-factor authentication. Never share passwords. Report phishing to security@example.com within 24 hours.' },
  { id: 'pricing', text: 'Pricing tiers. Starter is 9 per month. Pro is 29 per month with SSO. Enterprise is custom with SLA and audit logs.' }
];

const QUERIES: Array<{ q: string; relevant: string[] }> = [
  { q: 'annual leave days', relevant: ['handbook'] },
  { q: 'sick leave doctor note', relevant: ['handbook'] },
  { q: 'maternity weeks paid', relevant: ['handbook'] },
  { q: 'expense receipts 30 days', relevant: ['expenses'] },
  { q: 'meals capped per day', relevant: ['expenses'] },
  { q: 'travel pre-approved manager', relevant: ['expenses'] },
  { q: 'two-factor authentication passwords', relevant: ['security'] },
  { q: 'report phishing', relevant: ['security'] },
  { q: 'Pro tier SSO price', relevant: ['pricing'] },
  { q: 'Enterprise SLA audit logs', relevant: ['pricing'] }
];

async function main(): Promise<void> {
  const provider = new MockEmbeddingProvider(128);
  const chunks = CORPUS.flatMap((d) =>
    chunkText(d.text, { targetWords: 40, overlapWords: 5 }).map((c) => ({ docId: d.id, content: c.content }))
  );
  const vecs = await provider.embedBatch(chunks.map((c) => c.content));
  const K = 2;
  let pSum = 0;
  let rSum = 0;
  let rrSum = 0;

  for (const { q, relevant } of QUERIES) {
    const [qv] = await provider.embedBatch([q]);
    const ranked = chunks
      .map((c, i) => ({ docId: c.docId, score: cosineSimilarity(qv!, vecs[i]!) }))
      .sort((a, b) => b.score - a.score);
    const topK = ranked.slice(0, K);
    const hits = topK.filter((r) => relevant.includes(r.docId)).length;
    pSum += hits / K;
    rSum += hits / relevant.length;
    const first = ranked.findIndex((r) => relevant.includes(r.docId));
    rrSum += first >= 0 ? 1 / (first + 1) : 0;
    console.log(`q="${q}" -> top=${ranked[0]!.docId} (${ranked[0]!.score.toFixed(3)}) P@${K}=${(hits / K).toFixed(2)}`);
  }

  console.log(`\nN=${QUERIES.length} P@${K}=${(pSum / QUERIES.length).toFixed(3)} R@${K}=${(rSum / QUERIES.length).toFixed(3)} MRR=${(rrSum / QUERIES.length).toFixed(3)}`);
  console.log('Reminder: mock-based numbers measure plumbing, not semantic quality. Re-run after enabling Gemini.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
