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
type Lang = 'th' | 'en';
const TEXT: Record<
  Lang,
  {
    title: string;
    search: string;
    placeholder: string;
    filterLabel: string;
    filters: [string, string][];
    total: string;
    inEngine: string;
    all3: string;
    none: string;
    cap1: string;
    cap2: string;
    cap3: string;
    cap4: string;
    cap5: string;
  }
> = {
  th: {
    title: 'ค้นหา metric ในทะเบียนของ GX',
    search: 'ค้นหาชื่อ metric',
    placeholder: 'เช่น column.max หรือ nonnull',
    filterLabel: 'ตัวกรอง',
    filters: [['all', 'ทั้งหมด'], ['all3', 'มีครบสาม engine'], ['no-p', 'ไม่มี pandas'], ['no-s', 'ไม่มี SQL'], ['no-k', 'ไม่มี Spark']],
    total: 'metric ทั้งหมด',
    inEngine: 'มีใน ',
    all3: 'ครบทั้งสาม',
    none: 'ไม่พบ metric ที่ตรงกับเงื่อนไข',
    cap1: 'แสดงสูงสุด 60 รายการจาก ',
    cap2: ' ที่ตรงเงื่อนไข ข้อมูลมาจาก ',
    cap3: ' ของ GX ',
    cap4: ' ที่ติดตั้งจริง',
    cap5: '(นับ implementation ที่ลงทะเบียนไว้ ไม่ได้ทดลองรันทุก metric บนทุก engine)',
  },
  en: {
    title: 'Search the metrics in the registry of GX',
    search: 'Search metric names',
    placeholder: 'for example column.max or nonnull',
    filterLabel: 'Filter',
    filters: [['all', 'All'], ['all3', 'In all three engines'], ['no-p', 'Not in pandas'], ['no-s', 'Not in SQL'], ['no-k', 'Not in Spark']],
    total: 'All metrics',
    inEngine: 'In ',
    all3: 'In all three',
    none: 'No metric matches the filter',
    cap1: 'Shows at most 60 of the ',
    cap2: ' that match. The data comes from ',
    cap3: ' of the GX ',
    cap4: ' that is installed.',
    cap5: '(It counts the registered implementations. It did not run every metric on every engine.)',
  },
};

type Filter = 'all' | 'no-p' | 'no-s' | 'no-k' | 'all3';

export default function MetricLookup({ lang = 'th' }: { lang?: Lang }) {
  const t = TEXT[lang];
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
      <div className="viz-title">{t.title} {data.version}</div>
      <div className="viz-controls">
        <input
          type="search"
          aria-label={t.search}
          placeholder={t.placeholder}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ font: 'inherit', padding: '6px 12px', borderRadius: 10, border: '2px solid var(--line-strong)', background: 'var(--surface)', color: 'var(--fg)', minWidth: 280 }}
        />
        <div className="viz-steps" role="group" aria-label={t.filterLabel}>
          {(t.filters as [Filter, string][]).map(([k, l]) => (
            <button key={k} type="button" aria-pressed={f === k} onClick={() => setF(k)}>{l}</button>
          ))}
        </div>
      </div>

      <div className="gx-status">
        <div><span>{t.total}</span><b data-on="true">{total}</b></div>
        {ENGINES.map((e) => (
          <div key={e.key}><span>{t.inEngine}{e.label}</span><b data-on="true">{count(e.bit)}</b></div>
        ))}
        <div><span>{t.all3}</span><b data-on="true">{all3}</b></div>
      </div>

      <ul className="gx-results" style={{ maxHeight: 340, overflowY: 'auto' }}>
        {rows.slice(0, 60).map((r) => (
          <li key={r.name} data-ok={r.bits === 7 ? 'true' : undefined}>
            <code>{r.name}</code>
            <span className="gx-detail">
              {ENGINES.map((e) => (r.bits & e.bit ? `✓ ${e.label}` : `✗ ${e.label}`)).join('   ')}
            </span>
          </li>
        ))}
        {rows.length === 0 && <li data-ok="true"><span className="gx-detail">{t.none}</span></li>}
      </ul>
      <p className="viz-caption">
        {t.cap1}{rows.length}{t.cap2}<code>registry._registered_metrics</code>{t.cap3}{data.version}{t.cap4} {t.cap5}
      </p>
    </figure>
  );
}
