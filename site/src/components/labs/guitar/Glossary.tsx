import { useMemo, useState } from 'react';
import * as TH from './glossaryData';
import * as EN from './glossaryData.en';
import type { Group } from './glossaryData';

// Searchable glossary. Typing filters by the English term, its Thai reading (Thai page only) and the meaning.
// Each entry links to the lesson that teaches the word. The data comes in two files, one per language.

type Lang = 'th' | 'en';

const TEXT: Record<Lang, { title: (n: number) => string; placeholder: string; searchLabel: string; groupLabel: string; all: string; found: (n: number) => string; learnIn: string; none: string }> = {
  th: {
    title: (n) => `Glossary: ${n} คำ`,
    placeholder: 'ค้นหา เช่น fret, capo, เบนด์',
    searchLabel: 'ค้นหาคำศัพท์',
    groupLabel: 'หมวด',
    all: 'ทั้งหมด',
    found: (n) => `พบ ${n} คำ`,
    learnIn: 'เรียนใน',
    none: 'ไม่พบคำนี้ ลองค้นด้วยภาษาอังกฤษหรือสะกดสั้นลง',
  },
  en: {
    title: (n) => `Glossary: ${n} terms`,
    placeholder: 'Search, for example fret, capo, bend',
    searchLabel: 'Search the glossary',
    groupLabel: 'Category',
    all: 'All',
    found: (n) => `${n} found`,
    learnIn: 'Learn it in',
    none: 'No term found. Try a shorter spelling.',
  },
};

const base = import.meta.env.BASE_URL.replace(/\/$/, '');
const ORDER = Object.keys(TH.GROUPS) as Group[];

export default function Glossary({ lang = 'th' }: { lang?: Lang }) {
  const { GROUPS, LESSONS, TERMS } = lang === 'en' ? EN : TH;
  const t = TEXT[lang];
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<Group | 'all'>('all');

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return TERMS.filter((x) => (group === 'all' || x.group === group) && (!q || `${x.term} ${('say' in x && x.say) || ''} ${x.mean}`.toLowerCase().includes(q))).sort((a, b) =>
      a.term.toLowerCase().localeCompare(b.term.toLowerCase()),
    );
  }, [query, group, TERMS]);

  return (
    <figure className="viz">
      <div className="viz-title">{t.title(TERMS.length)}</div>
      <div className="viz-controls">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.placeholder}
          aria-label={t.searchLabel}
          style={{ flex: '1 1 240px', maxWidth: 360, padding: '9px 14px', borderRadius: 12, border: '2px solid var(--line-strong)', background: 'var(--surface)', color: 'var(--fg)', font: 'inherit' }}
        />
      </div>
      <div className="viz-steps" role="group" aria-label={t.groupLabel}>
        <button type="button" aria-pressed={group === 'all'} onClick={() => setGroup('all')}>{t.all}</button>
        {ORDER.map((g) => (
          <button key={g} type="button" aria-pressed={group === g} onClick={() => setGroup(g)}>{GROUPS[g]}</button>
        ))}
      </div>
      <span className="gx-detail" aria-live="polite">{t.found(shown.length)}</span>
      <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10, margin: 0 }}>
        {shown.map((x) => (
          <div key={x.term} style={{ padding: '12px 14px', border: '2px solid var(--line)', borderRadius: 14, background: 'var(--surface)' }}>
            <dt style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 8 }}>
              <b style={{ fontFamily: 'var(--display)', fontSize: 17 }}>{x.term}</b>
              {'say' in x && x.say && <span className="gx-detail">{x.say}</span>}
              <span className="gx-tag" style={{ marginLeft: 'auto' }}>{GROUPS[x.group]}</span>
            </dt>
            <dd style={{ margin: '6px 0 0', fontSize: 15, lineHeight: 1.6 }}>
              {x.mean}
              {x.see && (
                <>
                  {' '}
                  <a href={`${base}${lang === 'en' ? '/en' : ''}/${x.see}/`} className="gx-detail" style={{ color: 'var(--accent)' }}>
                    {t.learnIn} "{LESSONS[x.see]}"
                  </a>
                </>
              )}
            </dd>
          </div>
        ))}
      </dl>
      {shown.length === 0 && <p className="viz-caption">{t.none}</p>}
    </figure>
  );
}
