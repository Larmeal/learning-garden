import { useState } from 'react';

// A collapsible viewer for a piece of JSON that a script printed. `notes` maps a dotted path (for example
// "results.result.unexpected_count") or a bare key to a one-line explanation shown when the key is selected.

type Lang = 'th' | 'en';

const TEXT: Record<Lang, { pick: string; expand: string; noNote: string }> = {
  th: { pick: 'กดชื่อ Key เพื่อดูความหมาย', expand: 'กดลูกศรเพื่อขยายหรือยุบ', noNote: 'ไม่มีหมายเหตุสำหรับ Key นี้' },
  en: { pick: 'Click a key name to see what it means', expand: 'Click an arrow to expand or collapse', noNote: 'No note for this key' },
};

interface Props {
  title: string;
  data: unknown;
  notes?: Record<string, string>;
  open?: string[];
  caption?: string;
  lang?: Lang;
}

function kind(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return `list(${v.length})`;
  if (typeof v === 'object') return `dict(${Object.keys(v as object).length})`;
  return typeof v;
}

function Node({ k, v, path, depth, notes, openSet, sel, onSel }: {
  k: string; v: unknown; path: string; depth: number; notes: Record<string, string>; openSet: Set<string>; sel: string; onSel: (p: string) => void;
}) {
  const container = v !== null && typeof v === 'object';
  const [open, setOpen] = useState(openSet.has(path) || depth === 0);
  const entries: [string, unknown][] = container ? (Array.isArray(v) ? v.map((x, i) => [String(i), x] as [string, unknown]) : Object.entries(v as object)) : [];
  const isSel = sel === path;
  return (
    <li>
      <div className="gx-tree-line" data-sel={isSel ? 'true' : undefined} style={{ paddingLeft: depth * 16 }}>
        {container ? (
          <button type="button" className="gx-tree-tog" aria-expanded={open} onClick={() => { setOpen(!open); onSel(path); }}>{open ? '▾' : '▸'}</button>
        ) : (
          <span className="gx-tree-tog" aria-hidden="true">·</span>
        )}
        <button type="button" className="gx-tree-key" onClick={() => onSel(path)}><code>{k}</code></button>
        <span className="gx-tag">{kind(v)}</span>
        {!container && <code className="gx-tree-val">{JSON.stringify(v)}</code>}
      </div>
      {container && open && (
        <ul className="gx-tree-ul">
          {entries.map(([ck, cv]) => (
            <Node key={ck} k={ck} v={cv} path={`${path}.${Array.isArray(v) ? '[]' : ck}`} depth={depth + 1} notes={notes} openSet={openSet} sel={sel} onSel={onSel} />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function JsonTree({ title, data, notes = {}, open = [], caption, lang = 'th' }: Props) {
  const t = TEXT[lang];
  const [sel, setSel] = useState('');
  const bare = sel.split('.').filter((x) => x !== '[]').slice(-1)[0] ?? '';
  const note = notes[sel] ?? notes[sel.replace(/^root\./, '')] ?? notes[bare];
  const openSet = new Set(open.map((p) => `root.${p}`));

  return (
    <figure className="viz">
      <div className="viz-title">{title}</div>
      <div className="gx-split">
        <ul className="gx-tree-ul gx-pane gx-grow" style={{ minWidth: 0 }}>
          <Node k="root" v={data} path="root" depth={0} notes={notes} openSet={openSet} sel={sel} onSel={setSel} />
        </ul>
        <div className="gx-pane">
          <div className="viz-now" aria-live="polite">
            <strong>{sel ? bare || 'root' : t.pick}</strong>
            <span>{sel ? note ?? t.noNote : t.expand}</span>
          </div>
        </div>
      </div>
      {caption && <p className="viz-caption">{caption}</p>}
    </figure>
  );
}
