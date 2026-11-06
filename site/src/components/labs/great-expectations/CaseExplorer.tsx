import { useState } from 'react';

// A generic "pick a case, see what each check said" table. Cases and results are written into the lesson from a
// script run (the lesson names the script), so the component only lays them out.

type Lang = 'th' | 'en';

const TEXT: Record<Lang, { ok: string; bad: string; group: string; input: string; failed: (bad: string, f: number, n: number) => string; allOk: (ok: string, n: number) => string }> = {
  th: {
    ok: 'ผ่าน',
    bad: 'ไม่ผ่าน',
    group: 'กรณี',
    input: 'ข้อมูลที่ตรวจ',
    failed: (bad, f, n) => `${bad} ${f} จาก ${n} ข้อ`,
    allOk: (ok, n) => `${ok}ครบ ${n} ข้อ`,
  },
  en: {
    ok: 'Pass',
    bad: 'Fail',
    group: 'Case',
    input: 'Data checked',
    failed: (bad, f, n) => `${bad}: ${f} of ${n} checks`,
    allOk: (ok, n) => `${ok}: all ${n} checks`,
  },
};

export interface Row {
  name: string;
  ok: boolean;
  detail?: string;
}
export interface Case {
  label: string;
  input?: string;
  rows: Row[];
  note?: string;
}
interface Props {
  title: string;
  cases: Case[];
  okWord?: string;
  badWord?: string;
  caption?: string;
  lang?: Lang;
}

export default function CaseExplorer({ title, cases, okWord: okProp, badWord: badProp, caption, lang = 'th' }: Props) {
  const t = TEXT[lang];
  const okWord = okProp ?? t.ok;
  const badWord = badProp ?? t.bad;
  const [k, setK] = useState(0);
  const c = cases[k];
  const failed = c.rows.filter((r) => !r.ok).length;

  return (
    <figure className="viz">
      <div className="viz-title">{title}</div>
      <div className="viz-controls">
        <div className="viz-steps" role="group" aria-label={t.group}>
          {cases.map((x, n) => (
            <button key={x.label} type="button" aria-pressed={k === n} onClick={() => setK(n)}>{x.label}</button>
          ))}
        </div>
      </div>
      <div className="gx-split">
        {c.input && (
          <div className="gx-pane">
            <span className="lab-label">{t.input}</span>
            <pre className="codeline">{c.input}</pre>
          </div>
        )}
        <div className="gx-pane gx-grow">
          <ul className="gx-results">
            {c.rows.map((r) => (
              <li key={r.name} data-ok={r.ok ? 'true' : 'false'}>
                <span className="gx-badge">{r.ok ? okWord : badWord}</span>
                <span>
                  <code>{r.name}</code>
                  {r.detail && <span className="gx-detail"> {r.detail}</span>}
                </span>
              </li>
            ))}
          </ul>
          <div className="viz-now" data-bad={failed ? '' : undefined} aria-live="polite">
            <strong>{failed ? t.failed(badWord, failed, c.rows.length) : t.allOk(okWord, c.rows.length)}</strong>
            {c.note && <span>{c.note}</span>}
          </div>
        </div>
      </div>
      {caption && <p className="viz-caption">{caption}</p>}
    </figure>
  );
}
