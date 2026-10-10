/** Tiny inline SVG sparkline for embedding previews. Purely presentational. */
export function Sparkline({ values, width = 220, height = 44 }: { values: number[]; width?: number; height?: number }) {
  if (values.length === 0) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / Math.max(1, values.length - 1)) * width;
    const y = height - 4 - ((v - min) / span) * (height - 8);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline points={pts.join(' ')} fill="none" stroke="var(--primary)" strokeWidth="1.6" />
    </svg>
  );
}
