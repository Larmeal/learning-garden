import { useState } from 'react';

type Lang = 'th' | 'en';

interface F {
  name: string;
  year: number;
  month: number;
  day: number;
  rows: number;
}

const FILES: F[] = [
  { name: 'data_2024-01-01.csv', year: 2024, month: 1, day: 1, rows: 120 },
  { name: 'data_2024-01-02.csv', year: 2024, month: 1, day: 2, rows: 118 },
  { name: 'data_2024-02-01.csv', year: 2024, month: 2, day: 1, rows: 131 },
  { name: 'data_2024-02-02.csv', year: 2024, month: 2, day: 2, rows: 0 },
  { name: 'data_2024-03-01.csv', year: 2024, month: 3, day: 1, rows: 140 },
];

const OPTS = {
  year: [2024],
  month: [1, 2, 3],
  day: [1, 2, 3],
};

const TEXT: Record<
  Lang,
  {
    title: string;
    unset: string;
    clear: string;
    rows: (n: number) => string;
    chosen: string;
    matched: string;
    filtered: string;
    got: string;
    noParams: string;
    several: (n: number) => string;
    one: string;
    noMatch: string;
    capA: string;
    capB: string;
  }
> = {
  th: {
    title: 'get_batch() จะเลือกไฟล์ไหน ขึ้นอยู่กับพารามิเตอร์ที่เราส่งเข้าไป',
    unset: 'ไม่ระบุ',
    clear: 'ล้าง',
    rows: (n) => `${n} แถว`,
    chosen: 'ถูกเลือก',
    matched: 'ตรงเงื่อนไข',
    filtered: 'ถูกกรองออก',
    got: 'ได้ ',
    noParams: 'ถ้าไม่ส่งพารามิเตอร์เลย GX จะไม่ Error แต่จะให้ Batch สุดท้ายตามลำดับ ดังนั้นถ้า Pipeline ลืมส่งค่า ก็จะตรวจไฟล์ล่าสุดไปเงียบ ๆ',
    several: (n) => `พารามิเตอร์ไม่ครบ ทำให้มี ${n} ไฟล์ที่ตรง และ GX จะเลือกไฟล์สุดท้ายให้เงียบ ๆ`,
    one: 'พารามิเตอร์ระบุไฟล์เดียว',
    noMatch: 'ไม่มีไฟล์ที่ตรงกับพารามิเตอร์ GX จึง raise Error ออกมา',
    capA: 'ไฟล์ตัวอย่างเป็นแบบเดียวกับที่ทดลองใน ',
    capB: ' (Regex รายวัน) ลองเลือกเฉพาะ month แล้วสังเกตดูว่าเราได้ไฟล์เดียว ทั้งที่ตรงอยู่สองไฟล์',
  },
  en: {
    title: 'Which file get_batch() picks depends on the parameters you pass',
    unset: 'not set',
    clear: 'Clear',
    rows: (n) => `${n} rows`,
    chosen: 'chosen',
    matched: 'matches',
    filtered: 'filtered out',
    got: 'Got ',
    noParams: 'No parameters passed. GX gives no error, but returns the last batch in order. If a pipeline forgets to pass the values, it quietly checks the latest file.',
    several: (n) => `The parameters are not complete and ${n} files match. GX quietly picks the last file.`,
    one: 'The parameters point to one file',
    noMatch: 'No file matches the parameters. GX raises an error.',
    capA: 'The sample files are the same as the ones tried in ',
    capB: ' (daily regex). Try choosing only month, and notice that you get one file even though two files match.',
  },
};

type P = { year?: number; month?: number; day?: number };

// get_batch(): keep the batches that match every given parameter, then return the LAST of them (verified by running GX).
function pick(p: P) {
  const match = FILES.filter(
    (f) => (p.year === undefined || f.year === p.year) && (p.month === undefined || f.month === p.month) && (p.day === undefined || f.day === p.day),
  );
  return { match, chosen: match.length ? match[match.length - 1] : null };
}

export default function BatchLab({ lang = 'th' }: { lang?: Lang }) {
  const t = TEXT[lang];
  const [p, setP] = useState<P>({});
  const { match, chosen } = pick(p);
  const given = Object.entries(p).filter(([, v]) => v !== undefined);
  const set = (k: keyof P, v: string) => setP((o) => ({ ...o, [k]: v === '' ? undefined : +v }));
  const call = `batch_definition.get_batch(${given.length ? `batch_parameters={${given.map(([k, v]) => `"${k}": ${v}`).join(', ')}}` : ''})`;

  return (
    <figure className="viz">
      <div className="viz-title">{t.title}</div>
      <div className="lab-controls">
        {(['year', 'month', 'day'] as const).map((k) => (
          <label key={k} className="gx-select">
            <span className="lab-label">{k}</span>
            <select value={p[k] ?? ''} onChange={(e) => set(k, e.target.value)}>
              <option value="">{t.unset}</option>
              {OPTS[k].map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </label>
        ))}
        <button type="button" className="btn sm" onClick={() => setP({})}>{t.clear}</button>
      </div>

      <pre className="codeline">{call}</pre>

      <ul className="gx-files">
        {FILES.map((f) => {
          const isMatch = match.includes(f);
          const isChosen = chosen === f;
          return (
            <li key={f.name} data-match={isMatch} data-chosen={isChosen}>
              <code>{f.name}</code>
              <span>{t.rows(f.rows)}</span>
              <span className="gx-tag">{isChosen ? t.chosen : isMatch ? t.matched : t.filtered}</span>
            </li>
          );
        })}
      </ul>

      <div className="viz-now" aria-live="polite" data-bad={!chosen || undefined}>
        {chosen ? (
          <>
            <strong>{t.got}{chosen.name}</strong>
            <span>
              {given.length === 0
                ? t.noParams
                : match.length > 1
                  ? t.several(match.length)
                  : t.one}
            </span>
          </>
        ) : (
          <>
            <strong>NoAvailableBatchesError</strong>
            <span>{t.noMatch}</span>
          </>
        )}
      </div>

      <p className="viz-caption">
        {t.capA}<code>04_batches.py</code>{t.capB}
      </p>
    </figure>
  );
}
