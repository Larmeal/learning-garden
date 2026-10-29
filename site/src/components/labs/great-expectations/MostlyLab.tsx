import { useState } from 'react';

const N = 10;

// Mirrors _mostly_success: (considered - unexpected) / considered >= mostly, where nulls are not considered.
export default function MostlyLab() {
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
      <div className="viz-title">ลองปรับ mostly: ข้อมูล 10 แถว ผิดกี่แถวจึงยังผ่าน</div>
      <div className="gx-cells" role="img" aria-label={`แถว null ${nn} แถว ผิด ${unexpected} แถว ถูก ${considered - unexpected} แถว`}>
        {cells.map((c, i) => (
          <span key={i} data-c={c}>{c === 'null' ? 'null' : c === 'bad' ? '✕' : '✓'}</span>
        ))}
      </div>

      <div className="gx-sliders">
        <label className="range">
          <span>แถวที่เป็น null: <b className="mono">{nn}</b></span>
          <input type="range" min={0} max={N} value={nn} onChange={(e) => setNulls(+e.target.value)} />
        </label>
        <label className="range">
          <span>แถวที่ผิด (ไม่นับ null): <b className="mono">{unexpected}</b></span>
          <input type="range" min={0} max={Math.max(considered, 0)} value={unexpected} onChange={(e) => setBad(+e.target.value)} />
        </label>
        <label className="range">
          <span>mostly: <b className="mono">{mostly.toFixed(2)}</b></span>
          <input type="range" min={0.5} max={1} step={0.05} value={mostly} onChange={(e) => setMostly(+e.target.value)} />
        </label>
      </div>

      <div className="viz-now">
        <strong>{pass ? 'ผ่าน' : 'ไม่ผ่าน'}</strong>
        <span>
          {vacuous
            ? 'ไม่มีแถวให้พิจารณา (ทุกแถวเป็น null) GX ถือว่าผ่านโดยปริยาย'
            : `สัดส่วนที่ถูก = (${considered} - ${unexpected}) / ${considered} = ${ratio.toFixed(3)} ${pass ? '≥' : '<'} mostly ${mostly.toFixed(2)}`}
        </span>
      </div>

      <p className="viz-caption">
        แถวที่เป็น null ไม่ถูกนับในตัวหาร และไม่นับว่าผิด (สำหรับ expectation แบบ column map ส่วนใหญ่ เช่น <code>ExpectColumnValuesToBeBetween</code>)
        ถ้าต้องการจับ null ให้ใช้ <code>ExpectColumnValuesToNotBeNull</code> อีกข้อหนึ่ง
      </p>
    </figure>
  );
}
