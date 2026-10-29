import { useMemo, useState } from 'react';
import data from './support.json';

// Reads support.json, written by code/30_sql_where_support.py. Each expectation module of GX lists
// SUPPORTED_DATA_SOURCES (the docstring is built from it). It is documentation metadata: whether a backend really
// works depends on the metric providers (see the metric registry page).

export default function SupportLookup() {
  const sources: string[] = data.sources;
  const names: string[] = data.names;
  const bits: number[] = data.bits;
  const [source, setSource] = useState(sources.includes('Spark') ? 'Spark' : sources[0]);
  const [q, setQ] = useState('');
  const bit = 1 << sources.indexOf(source);

  const missing = useMemo(() => names.filter((n, i) => !(bits[i] & bit) && n.toLowerCase().includes(q.trim().toLowerCase())), [names, bits, bit, q]);
  const have = useMemo(() => bits.filter((b) => b & bit).length, [bits, bit]);

  return (
    <figure className="viz">
      <div className="viz-title">expectation ที่ GX ระบุว่ารองรับ backend ของคุณ</div>
      <div className="viz-controls">
        <label className="gx-select">
          <span className="lab-label">backend</span>
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            {sources.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <input
          type="search"
          aria-label="กรองชื่อ expectation"
          placeholder="กรองชื่อที่ไม่รองรับ"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ font: 'inherit', padding: '6px 12px', borderRadius: 10, border: '2px solid var(--line-strong)', background: 'var(--surface)', color: 'var(--fg)', minWidth: 260 }}
        />
      </div>

      <div className="gx-status">
        <div><span>expectation ในรายการ</span><b data-on="true">{names.length}</b></div>
        <div><span>ระบุว่ารองรับ {source}</span><b data-on="true">{have}</b></div>
        <div><span>ไม่ได้ระบุ</span><b data-on={have === names.length ? 'true' : 'false'}>{names.length - have}</b></div>
      </div>

      <ul className="gx-results" style={{ maxHeight: 300, overflowY: 'auto' }}>
        {missing.map((n) => (
          <li key={n} data-ok="false"><span className="gx-badge">ไม่ระบุ</span><code>{n}</code></li>
        ))}
        {missing.length === 0 && <li data-ok="true"><span className="gx-detail">ไม่มี expectation ที่ขาด {source} ตามตัวกรองนี้</span></li>}
      </ul>
      <p className="viz-caption">
        รายการมาจากตัวแปร <code>SUPPORTED_DATA_SOURCES</code> ในไฟล์ของแต่ละ expectation ของ GX {data.version} ซึ่งใช้สร้างเอกสาร ไม่ได้ทดลองรันทุกตัวบนทุก backend
      </p>
    </figure>
  );
}
