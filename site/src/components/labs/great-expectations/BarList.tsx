// Horizontal bars for a short list of measured numbers. The lesson passes the numbers (copied from a script run);
// the component only draws them, with the value printed next to each bar.

type Lang = 'th' | 'en';

const TEXT: Record<Lang, { none: string }> = {
  th: { none: 'ไม่มี' },
  en: { none: 'none' },
};

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
  lang?: Lang;
}

export default function BarList({ title, items, unit = '', caption, lang = 'th' }: Props) {
  const t = TEXT[lang];
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
              <b style={{ whiteSpace: 'nowrap' }}>{it.value === null ? t.none : `${it.value}${unit}`}</b>
              {it.note && <span className="gx-detail">{it.note}</span>}
            </span>
          </li>
        ))}
      </ul>
      {caption && <p className="viz-caption">{caption}</p>}
    </figure>
  );
}
