import { useRef, useState } from 'react';
import { MAX_FILE_SIZE_BYTES, SUPPORTED_EXTENSIONS } from '../api/types.js';

interface Props {
  onFiles: (files: File[]) => void;
  busy: boolean;
}

/** Drag-and-drop + browse. Client pre-checks mirror the API limits (10 MB, allowlist). */
export function Dropzone({ onFiles, busy }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [rejected, setRejected] = useState<string | null>(null);

  function accept(list: FileList | File[]) {
    const files = [...list];
    const bad = files.find((f) => f.size > MAX_FILE_SIZE_BYTES);
    if (bad) {
      setRejected(`"${bad.name}" exceeds 10 MB and was not added.`);
      return;
    }
    const unknown = files.find((f) => {
      const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
      return !(SUPPORTED_EXTENSIONS as string[]).includes(ext);
    });
    if (unknown) {
      setRejected(`"${unknown.name}" has an unsupported extension. Allowed: PDF, DOCX, TXT, CSV, XLSX.`);
      return;
    }
    setRejected(null);
    onFiles(files);
  }

  return (
    <div>
      <div
        className={`dropzone ${over ? 'over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); if (!busy) accept(e.dataTransfer.files); }}
      >
        <div className="drop-icon">⇪</div>
        <div className="drop-title">
          Drop your documents here or{' '}
          <span className="link" onClick={() => inputRef.current?.click()}>browse files</span>
        </div>
        <div className="drop-sub">Maximum file size: 10 MB per file · Unsupported files and oversized uploads will be rejected</div>
        <div className="format-chips">
          {SUPPORTED_EXTENSIONS.map((e) => <span key={e} className="chip">{e.toUpperCase()}</span>)}
        </div>
        <input
          ref={inputRef} type="file" hidden multiple
          accept=".pdf,.docx,.txt,.csv,.xlsx"
          onChange={(e) => { if (e.target.files?.length) accept(e.target.files); e.target.value = ''; }}
        />
      </div>
      {rejected && <div className="alert alert-error" style={{ marginTop: 10 }}><span className="mono">{rejected}</span></div>}
    </div>
  );
}
