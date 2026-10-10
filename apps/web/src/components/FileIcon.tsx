const SHORT: Record<string, string> = { pdf: 'PDF', docx: 'DOC', txt: 'TXT', csv: 'CSV', xlsx: 'XLS' };

export function FileIcon({ ext }: { ext: string }) {
  const key = ext.toLowerCase();
  return <span className={`file-tile ft-${key}`}>{SHORT[key] ?? key.slice(0, 3).toUpperCase()}</span>;
}
