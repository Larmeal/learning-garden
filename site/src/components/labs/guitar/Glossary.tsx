import { useMemo, useState } from 'react';
import { GROUPS, LESSONS, TERMS, type Group } from './glossaryData';

// Searchable glossary. Typing filters by the English term, its Thai reading and the Thai meaning.
// Each entry links to the lesson that teaches the word.

const base = import.meta.env.BASE_URL.replace(/\/$/, '');
const ORDER = Object.keys(GROUPS) as Group[];

export default function Glossary() {
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<Group | 'all'>('all');

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return TERMS.filter((t) => (group === 'all' || t.group === group) && (!q || `${t.term} ${t.say ?? ''} ${t.mean}`.toLowerCase().includes(q))).sort((a, b) =>
      a.term.toLowerCase().localeCompare(b.term.toLowerCase()),
    );
  }, [query, group]);

  return (
    <figure className="viz">
      <div className="viz-title">Glossary: {TERMS.length} คำ</div>
      <div className="viz-controls">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ค้นหา เช่น fret, capo, เบนด์"
          aria-label="ค้นหาคำศัพท์"
          style={{ flex: '1 1 240px', maxWidth: 360, padding: '9px 14px', borderRadius: 12, border: '2px solid var(--line-strong)', background: 'var(--surface)', color: 'var(--fg)', font: 'inherit' }}
        />
      </div>
      <div className="viz-steps" role="group" aria-label="หมวด">
        <button type="button" aria-pressed={group === 'all'} onClick={() => setGroup('all')}>ทั้งหมด</button>
        {ORDER.map((g) => (
          <button key={g} type="button" aria-pressed={group === g} onClick={() => setGroup(g)}>{GROUPS[g]}</button>
        ))}
      </div>
      <span className="gx-detail" aria-live="polite">พบ {shown.length} คำ</span>
      <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10, margin: 0 }}>
        {shown.map((t) => (
          <div key={t.term} style={{ padding: '12px 14px', border: '2px solid var(--line)', borderRadius: 14, background: 'var(--surface)' }}>
            <dt style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 8 }}>
              <b style={{ fontFamily: 'var(--display)', fontSize: 17 }}>{t.term}</b>
              {t.say && <span className="gx-detail">{t.say}</span>}
              <span className="gx-tag" style={{ marginLeft: 'auto' }}>{GROUPS[t.group]}</span>
            </dt>
            <dd style={{ margin: '6px 0 0', fontSize: 15, lineHeight: 1.6 }}>
              {t.mean}
              {t.see && (
                <>
                  {' '}
                  <a href={`${base}/${t.see}/`} className="gx-detail" style={{ color: 'var(--accent)' }}>
                    เรียนใน "{LESSONS[t.see]}"
                  </a>
                </>
              )}
            </dd>
          </div>
        ))}
      </dl>
      {shown.length === 0 && <p className="viz-caption">ไม่พบคำนี้ ลองค้นด้วยภาษาอังกฤษหรือสะกดสั้นลง</p>}
    </figure>
  );
}
