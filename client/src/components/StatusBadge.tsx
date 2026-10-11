import type { DocumentStatus } from '../api/types.js';

const LABEL: Record<DocumentStatus, string> = {
  UPLOADED: 'Uploaded',
  PROCESSING: 'Processing',
  COMPLETED: 'Completed',
  FAILED: 'Failed'
};

const CLASS: Record<DocumentStatus, string> = {
  UPLOADED: 'b-uploaded',
  PROCESSING: 'b-processing',
  COMPLETED: 'b-completed',
  FAILED: 'b-failed'
};

export function StatusBadge({ status, extra }: { status: DocumentStatus; extra?: string }) {
  return (
    <span className={`badge ${CLASS[status]}`}>
      <span className="dot" />
      {extra ?? LABEL[status]}
    </span>
  );
}
