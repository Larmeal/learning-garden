// Horizontal bars for a short list of measured numbers. The lesson passes the numbers (copied from a script run);
// the component only draws them, with the value printed next to each bar.

export interface Item {
  label: string;
  value: number | null;
  note?: string;
}
interface Props {
  title: string;
  items: Item[];
  unit?: string;
  caption?: string;
}

export default function BarList({ title, items, unit = '', caption }: Props) {
  const max = Math.max(1, ...items.map((i) => i.value ?? 0));
  return (
    <figure className="viz">
      <div className="viz-title">{title}</div>
      <ul className="gx-results">
        {items.map((it) => (
          <li key={it.label} data-ok={(it.value ?? 0) === 0 ? 'true' : undefined}>
            <span style={{ flex: '0 0 min(46%, 330px)', minWidth: 0 }}><code>{it.label}</code></span>
            <span style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                aria-hidden="true"
                style={{ display: 'block', height: 12, borderRadius: 99, width: `${((it.value ?? 0) / max) * 100}%`, minWidth: it.value ? 4 : 0, background: 'var(--accent)' }}
              />
              <b>{it.value === null ? 'ไม่มี' : `${it.value}${unit}`}</b>
              {it.note && <span className="gx-detail">{it.note}</span>}
            </span>
          </li>
        ))}
      </ul>
      {caption && <p className="viz-caption">{caption}</p>}
    </figure>
  );
}
