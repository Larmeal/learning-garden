import { useMemo, useState } from 'react';
import data from './support.json';

type Lang = 'th' | 'en';

const TEXT: Record<Lang, {
  title: string; filterLabel: string; filterPlaceholder: string; listed: string; supports: (s: string) => string; unlisted: string; badge: string;
  none: (s: string) => string; caption1: string; caption2: string; caption3: string;
}> = {
  th: {
    title: 'Expectation ที่ GX ระบุว่ารองรับ Backend ของคุณ',
    filterLabel: 'กรองชื่อ Expectation',
    filterPlaceholder: 'กรองชื่อที่ไม่รองรับ',
    listed: 'Expectation ในรายการ',
    supports: (s) => `ระบุว่ารองรับ ${s}`,
    unlisted: 'ไม่ได้ระบุ',
    badge: 'ไม่ระบุ',
    none: (s) => `ไม่มี Expectation ที่ขาด ${s} ตามตัวกรองนี้`,
    caption1: 'รายการมาจากตัวแปร ',
    caption2: ' ในไฟล์ของแต่ละ Expectation ของ GX ',
    caption3: ' ซึ่งใช้สร้างเอกสาร เราไม่ได้ทดลองรันทุกตัวบนทุก Backend',
  },
  en: {
    title: 'Expectations that GX says support your backend',
    filterLabel: 'Filter expectation names',
    filterPlaceholder: 'Filter the unsupported names',
    listed: 'Expectations in the list',
    supports: (s) => `Listed as supporting ${s}`,
    unlisted: 'Not listed',
    badge: 'not listed',
    none: (s) => `No expectation without ${s} matches this filter`,
    caption1: 'The list comes from the variable ',
    caption2: ' in the file of each expectation in GX ',
    caption3: '. It is used to build the documentation. Not every expectation was run on every backend.',
  },
};

// Reads support.json, written by code/30_sql_where_support.py. Each expectation module of GX lists
// SUPPORTED_DATA_SOURCES (the docstring is built from it). It is documentation metadata: whether a backend really
// works depends on the metric providers (see the metric registry page).

export default function SupportLookup({ lang = 'th' }: { lang?: Lang }) {
  const t = TEXT[lang];
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
      <div className="viz-title">{t.title}</div>
      <div className="viz-controls">
        <label className="gx-select">
          <span className="lab-label">backend</span>
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            {sources.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <input
          type="search"
          aria-label={t.filterLabel}
          placeholder={t.filterPlaceholder}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ font: 'inherit', padding: '6px 12px', borderRadius: 10, border: '2px solid var(--line-strong)', background: 'var(--surface)', color: 'var(--fg)', minWidth: 260 }}
        />
      </div>

      <div className="gx-status">
        <div><span>{t.listed}</span><b data-on="true">{names.length}</b></div>
        <div><span>{t.supports(source)}</span><b data-on="true">{have}</b></div>
        <div><span>{t.unlisted}</span><b data-on={have === names.length ? 'true' : 'false'}>{names.length - have}</b></div>
      </div>

      <ul className="gx-results" style={{ maxHeight: 300, overflowY: 'auto' }}>
        {missing.map((n) => (
          <li key={n} data-ok="false"><span className="gx-badge">{t.badge}</span><code>{n}</code></li>
        ))}
        {missing.length === 0 && <li data-ok="true"><span className="gx-detail">{t.none(source)}</span></li>}
      </ul>
      <p className="viz-caption">
        {t.caption1}<code>SUPPORTED_DATA_SOURCES</code>{t.caption2}{data.version}{t.caption3}
      </p>
    </figure>
  );
}
