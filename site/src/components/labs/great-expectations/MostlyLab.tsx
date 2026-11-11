import { useState } from 'react';

type Lang = 'th' | 'en';

const TEXT: Record<Lang, {
  title: string; aria: (n: number, b: number, g: number) => string; nulls: string; bad: string; pass: string; fail: string; vacuous: string;
  calc: (considered: number, unexpected: number, ratio: string, pass: boolean, mostly: string) => string; cap1: string; cap2: string; cap3: string;
}> = {
  th: {
    title: 'ลองปรับ mostly ดู ข้อมูล 10 แถว ผิดกี่แถวจึงยังผ่าน',
    aria: (n, b, g) => `แถว Null ${n} แถว ผิด ${b} แถว ถูก ${g} แถว`,
    nulls: 'แถวที่เป็น Null: ',
    bad: 'แถวที่ผิด (ไม่นับ Null): ',
    pass: 'ผ่าน',
    fail: 'ไม่ผ่าน',
    vacuous: 'ไม่มีแถวให้พิจารณา (ทุกแถวเป็น Null) GX จึงถือว่าผ่านโดยปริยาย',
    calc: (considered, unexpected, ratio, pass, mostly) => `สัดส่วนที่ถูก = (${considered} - ${unexpected}) / ${considered} = ${ratio} ${pass ? '≥' : '<'} mostly ${mostly}`,
    cap1: 'แถวที่เป็น Null จะไม่ถูกนับในตัวหาร และไม่นับว่าผิด (สำหรับ Expectation แบบ Column Map ส่วนใหญ่ เช่น ',
    cap2: ') ถ้าต้องการจับ Null ให้ใช้ ',
    cap3: ' อีกข้อหนึ่ง',
  },
  en: {
    title: 'Try changing mostly: with 10 rows, how many bad rows can still pass?',
    aria: (n, b, g) => `${n} null rows, ${b} bad rows, ${g} good rows`,
    nulls: 'Null rows: ',
    bad: 'Bad rows (nulls not counted): ',
    pass: 'Pass',
    fail: 'Fail',
    vacuous: 'There are no rows to consider (every row is null). GX counts this as a pass by default.',
    calc: (considered, unexpected, ratio, pass, mostly) => `Share of good rows = (${considered} - ${unexpected}) / ${considered} = ${ratio} ${pass ? '≥' : '<'} mostly ${mostly}`,
    cap1: 'Null rows are not in the denominator, and they do not count as bad (for most column map expectations, such as ',
    cap2: '). To catch nulls, add ',
    cap3: ' as a separate expectation.',
  },
};

const N = 10;

// Mirrors _mostly_success: (considered - unexpected) / considered >= mostly, where nulls are not considered.
export default function MostlyLab({ lang = 'th' }: { lang?: Lang }) {
  const t = TEXT[lang];
  const [bad, setBad] = useState(2);
  const [nulls, setNulls] = useState(2);
  const [mostly, setMostly] = useState(0.8);

  const nn = Math.min(nulls, N);
  const considered = N - nn;
  const unexpected = Math.min(bad, considered);
  const vacuous = considered === 0;
  const ratio = vacuous ? 1 : (considered - unexpected) / considered;
  const pass = vacuous || ratio >= mostly;

  const cells = Array.from({ length: N }, (_, i) => {
    if (i < nn) return 'null';
    if (i < nn + unexpected) return 'bad';
    return 'ok';
  });

  return (
    <figure className="viz">
      <div className="viz-title">{t.title}</div>
      <div className="gx-cells" role="img" aria-label={t.aria(nn, unexpected, considered - unexpected)}>
        {cells.map((c, i) => (
          <span key={i} data-c={c}>{c === 'null' ? 'null' : c === 'bad' ? '✕' : '✓'}</span>
        ))}
      </div>

      <div className="gx-sliders">
        <label className="range">
          <span>{t.nulls}<b className="mono">{nn}</b></span>
          <input type="range" min={0} max={N} value={nn} onChange={(e) => setNulls(+e.target.value)} />
        </label>
        <label className="range">
          <span>{t.bad}<b className="mono">{unexpected}</b></span>
          <input type="range" min={0} max={Math.max(considered, 0)} value={unexpected} onChange={(e) => setBad(+e.target.value)} />
        </label>
        <label className="range">
          <span>mostly: <b className="mono">{mostly.toFixed(2)}</b></span>
          <input type="range" min={0.5} max={1} step={0.05} value={mostly} onChange={(e) => setMostly(+e.target.value)} />
        </label>
      </div>

      <div className="viz-now">
        <strong>{pass ? t.pass : t.fail}</strong>
        <span>
          {vacuous ? t.vacuous : t.calc(considered, unexpected, ratio.toFixed(3), pass, mostly.toFixed(2))}
        </span>
      </div>

      <p className="viz-caption">
        {t.cap1}<code>ExpectColumnValuesToBeBetween</code>{t.cap2}<code>ExpectColumnValuesToNotBeNull</code>{t.cap3}
      </p>
    </figure>
  );
}
