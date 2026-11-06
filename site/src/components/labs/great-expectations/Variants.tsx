import { useState } from 'react';

// A generic "change one thing, see the output" panel: tabs, each with a code snippet, the output a script printed
// and a one-line reading. Used where a trap is easiest to see by flipping between two versions of the same code.

type Lang = 'th' | 'en';

const TEXT: Record<Lang, { group: string; code: string; output: string }> = {
  th: { group: 'แบบที่เทียบ', code: 'โค้ด', output: 'ที่สคริปต์พิมพ์ออกมา' },
  en: { group: 'Versions to compare', code: 'Code', output: 'What the script printed' },
};

export interface Variant {
  label: string;
  code?: string;
  output: string;
  reading: string;
  bad?: boolean;
}
interface Props {
  title: string;
  variants: Variant[];
  caption?: string;
  lang?: Lang;
}

export default function Variants({ title, variants, caption, lang = 'th' }: Props) {
  const t = TEXT[lang];
  const [k, setK] = useState(0);
  const v = variants[k];

  return (
    <figure className="viz">
      <div className="viz-title">{title}</div>
      <div className="viz-controls">
        <div className="viz-steps" role="group" aria-label={t.group}>
          {variants.map((x, n) => (
            <button key={x.label} type="button" aria-pressed={k === n} onClick={() => setK(n)}>{x.label}</button>
          ))}
        </div>
      </div>
      <div className="gx-split">
        {v.code && (
          <div className="gx-pane">
            <span className="lab-label">{t.code}</span>
            <pre className="codeline">{v.code}</pre>
          </div>
        )}
        <div className="gx-pane gx-grow">
          <span className="lab-label">{t.output}</span>
          <pre className="codeline">{v.output}</pre>
          <div className="viz-now" data-bad={v.bad ? '' : undefined} aria-live="polite">
            <span>{v.reading}</span>
          </div>
        </div>
      </div>
      {caption && <p className="viz-caption">{caption}</p>}
    </figure>
  );
}
