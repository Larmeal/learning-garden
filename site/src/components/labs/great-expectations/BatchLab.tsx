import { useState } from 'react';

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

type P = { year?: number; month?: number; day?: number };

// get_batch(): keep the batches that match every given parameter, then return the LAST of them (verified by running GX).
function pick(p: P) {
  const match = FILES.filter(
    (f) => (p.year === undefined || f.year === p.year) && (p.month === undefined || f.month === p.month) && (p.day === undefined || f.day === p.day),
  );
  return { match, chosen: match.length ? match[match.length - 1] : null };
}

export default function BatchLab() {
  const [p, setP] = useState<P>({});
  const { match, chosen } = pick(p);
  const given = Object.entries(p).filter(([, v]) => v !== undefined);
  const set = (k: keyof P, v: string) => setP((o) => ({ ...o, [k]: v === '' ? undefined : +v }));
  const call = `batch_definition.get_batch(${given.length ? `batch_parameters={${given.map(([k, v]) => `"${k}": ${v}`).join(', ')}}` : ''})`;

  return (
    <figure className="viz">
      <div className="viz-title">get_batch() เลือกไฟล์ไหน ขึ้นกับพารามิเตอร์ที่ส่ง</div>
      <div className="lab-controls">
        {(['year', 'month', 'day'] as const).map((k) => (
          <label key={k} className="gx-select">
            <span className="lab-label">{k}</span>
            <select value={p[k] ?? ''} onChange={(e) => set(k, e.target.value)}>
              <option value="">ไม่ระบุ</option>
              {OPTS[k].map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </label>
        ))}
        <button type="button" className="btn sm" onClick={() => setP({})}>ล้าง</button>
      </div>

      <pre className="codeline">{call}</pre>

      <ul className="gx-files">
        {FILES.map((f) => {
          const isMatch = match.includes(f);
          const isChosen = chosen === f;
          return (
            <li key={f.name} data-match={isMatch} data-chosen={isChosen}>
              <code>{f.name}</code>
              <span>{f.rows} แถว</span>
              <span className="gx-tag">{isChosen ? 'ถูกเลือก' : isMatch ? 'ตรงเงื่อนไข' : 'ถูกกรองออก'}</span>
            </li>
          );
        })}
      </ul>

      <div className="viz-now" aria-live="polite" data-bad={!chosen || undefined}>
        {chosen ? (
          <>
            <strong>ได้ {chosen.name}</strong>
            <span>
              {given.length === 0
                ? 'ไม่ส่งพารามิเตอร์เลย GX ไม่ error แต่ให้ batch สุดท้ายตามลำดับ ถ้า pipeline ลืมส่งค่า จะตรวจไฟล์ล่าสุดเงียบๆ'
                : match.length > 1
                  ? `พารามิเตอร์ไม่ครบ มี ${match.length} ไฟล์ที่ตรง GX เลือกไฟล์สุดท้ายให้เงียบๆ`
                  : 'พารามิเตอร์ระบุไฟล์เดียว'}
            </span>
          </>
        ) : (
          <>
            <strong>NoAvailableBatchesError</strong>
            <span>ไม่มีไฟล์ที่ตรงกับพารามิเตอร์ GX raise error</span>
          </>
        )}
      </div>

      <p className="viz-caption">
        ไฟล์ตัวอย่างเป็นแบบเดียวกับที่ทดลองใน <code>04_batches.py</code> (regex รายวัน) ลองเลือกเฉพาะ month แล้วสังเกตว่าได้ไฟล์เดียวทั้งที่ตรงสองไฟล์
      </p>
    </figure>
  );
}
