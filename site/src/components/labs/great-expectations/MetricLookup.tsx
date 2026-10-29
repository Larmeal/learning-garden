import { useMemo, useState } from 'react';
import data from './registry.json';

// Reads registry.json, written by code/26_registry_domains.py from registry._registered_metrics of the installed GX.
// bits: 1 = pandas, 2 = SQLAlchemy, 4 = Spark. A missing bit means expectations that need this metric fail with
// "No provider found" on that engine.

const ENGINES: { key: 'p' | 's' | 'k'; bit: number; label: string }[] = [
  { key: 'p', bit: 1, label: 'pandas' },
  { key: 's', bit: 2, label: 'SQL' },
  { key: 'k', bit: 4, label: 'Spark' },
];
type Filter = 'all' | 'no-p' | 'no-s' | 'no-k' | 'all3';

export default function MetricLookup() {
  const [q, setQ] = useState('');
  const [f, setF] = useState<Filter>('all');
  const names: string[] = data.names;
  const bits: number[] = data.bits;

  const rows = useMemo(() => {
    const out: { name: string; bits: number }[] = [];
    names.forEach((name, i) => {
      const b = bits[i];
      if (q && !name.includes(q.trim())) return;
      if (f === 'no-p' && b & 1) return;
      if (f === 'no-s' && b & 2) return;
      if (f === 'no-k' && b & 4) return;
      if (f === 'all3' && b !== 7) return;
      out.push({ name, bits: b });
    });
    return out;
  }, [q, f, names, bits]);

  const total = names.length;
  const count = (bit: number) => bits.filter((b) => b & bit).length;
  const all3 = bits.filter((b) => b === 7).length;

  return (
    <figure className="viz">
      <div className="viz-title">ค้นหา metric ในทะเบียนของ GX {data.version}</div>
      <div className="viz-controls">
        <input
          type="search"
          aria-label="ค้นหาชื่อ metric"
          placeholder="เช่น column.max หรือ nonnull"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ font: 'inherit', padding: '6px 12px', borderRadius: 10, border: '2px solid var(--line-strong)', background: 'var(--surface)', color: 'var(--fg)', minWidth: 220 }}
        />
        <div className="viz-steps" role="group" aria-label="ตัวกรอง">
          {([['all', 'ทั้งหมด'], ['all3', 'มีครบสาม engine'], ['no-p', 'ไม่มี pandas'], ['no-s', 'ไม่มี SQL'], ['no-k', 'ไม่มี Spark']] as [Filter, string][]).map(([k, l]) => (
            <button key={k} type="button" aria-pressed={f === k} onClick={() => setF(k)}>{l}</button>
          ))}
        </div>
      </div>

      <div className="gx-status">
        <div><span>metric ทั้งหมด</span><b data-on="true">{total}</b></div>
        {ENGINES.map((e) => (
          <div key={e.key}><span>มีใน {e.label}</span><b data-on="true">{count(e.bit)}</b></div>
        ))}
        <div><span>ครบทั้งสาม</span><b data-on="true">{all3}</b></div>
      </div>

      <ul className="gx-results" style={{ maxHeight: 340, overflowY: 'auto' }}>
        {rows.slice(0, 60).map((r) => (
          <li key={r.name} data-ok={r.bits === 7 ? 'true' : 'false'}>
            <code>{r.name}</code>
            <span className="gx-detail">
              {ENGINES.map((e) => (r.bits & e.bit ? `✓ ${e.label}` : `✗ ${e.label}`)).join('   ')}
            </span>
          </li>
        ))}
        {rows.length === 0 && <li data-ok="true"><span className="gx-detail">ไม่พบ metric ที่ตรงกับเงื่อนไข</span></li>}
      </ul>
      <p className="viz-caption">
        แสดงสูงสุด 60 รายการจาก {rows.length} ที่ตรงเงื่อนไข ข้อมูลมาจาก <code>registry._registered_metrics</code> ของ GX {data.version} ที่ติดตั้งจริง
        (นับ implementation ที่ลงทะเบียนไว้ ไม่ได้ทดลองรันทุก metric บนทุก engine)
      </p>
    </figure>
  );
}
