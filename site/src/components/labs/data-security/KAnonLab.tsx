import { useMemo, useState } from 'react';
import { Key, num } from './ds';
import type { Lang } from '../spark/stepper';
import { DIA, DIAG, N, ROWS, kGroups, packGroups } from './peopleLib';

// Shows:      all 2,000 people as squares, packed into blocks. One block is one group of people who look the same in the released table (same zip prefix, same birth year band, same sex).
//             Groups smaller than k are red: those people would be cut out. A block with a dark outline is a group in which everybody has the same diagnosis.
// Because:    "hide in a crowd of k" is a statement about group sizes. You believe how much detail has to go only when you see the red dust turn into solid blocks as the
//             age band widens and the zip shortens, and then see that a solid block can still give everything away.
// Control:    the age band (1, 5, 10, 20 years), the zip digits kept (5, 4, 3, 2) and k (2, 3, 5, 10). Every control repacks the blocks.
// Conclusion: coarser values make bigger groups, fewer red squares and less detail. But a group of any size where everybody has the same diagnosis still exposes that diagnosis.
//
// The people are the real 2,000 (labPeople.json) and the groups are made in the browser. For 10 year bands, a 3 digit zip and k = 5 it shows 10 people cut out and 5 groups of
// one diagnosis (62 people), as exercise 04 asserts. The clinic area that makes some groups homogeneous is an assumption of the author, put into the made-up data.

const BANDS = [1, 5, 10, 20];
const ZIPD = [5, 4, 3, 2];
const KS = [2, 3, 5, 10];

const TEXT: Record<Lang, {
  title: string; band: string; bandUnit: string; zip: string; zipUnit: string; k: string; key: { small: string; ok: string; same: string }; cut: (n: number, p: string) => string; groups: string; smallest: string; people: string;
  same: (g: number, p: number) => string; noSame: string; example: (zip: string, band: string, sex: string, diag: string, n: number) => string; sexes: string[]; caption: string; all: string;
}> = {
  th: {
    title: 'เลือกความละเอียดของอายุและ Zip แล้วดูว่าฝูงคน 2,000 คนแบ่งเป็นกลุ่มอย่างไร กลุ่มเล็กกว่า k จะเป็นสีแดงและต้องตัดทิ้ง',
    band: 'ช่วงอายุ', bandUnit: 'ปี', zip: 'Zip', zipUnit: 'หลัก', k: 'ค่า k (ทุกกลุ่มต้องมีอย่างน้อย)',
    key: { small: 'อยู่ในกลุ่มเล็กกว่า k ต้องตัดออก', ok: 'อยู่ในกลุ่มที่มีอย่างน้อย k คน', same: 'กรอบเข้ม: ทุกคนในกลุ่มมีผลวินิจฉัยเดียวกัน' },
    cut: (n, p) => `ต้องตัดออก ${num(n)} คน (${p})`, groups: 'กลุ่มทั้งหมด', smallest: 'กลุ่มเล็กสุด', people: 'คน',
    same: (g, p) => `กลุ่มที่ทุกคนมีผลวินิจฉัยเดียวกัน ${num(g)} กลุ่ม (${num(p)} คน)`, noSame: 'ไม่มีกลุ่มที่ทุกคนมีผลวินิจฉัยเดียวกัน', example: (z, b, s, d, n) => `Zip ${z}… · ${b} · ${s}: ทุกคนใน ${n} คน เป็น ${d}`, sexes: ['ชาย', 'หญิง'], all: 'ทุกคน',
    caption: 'ทุกช่องคือคนจริงหนึ่งคนของตารางสังเคราะห์ 2,000 คน กลุ่มแบ่งสดในเบราว์เซอร์ เมื่อใช้ช่วงอายุ 10 ปี Zip 3 หลัก และ k = 5 จะตัด 10 คนและเหลือ 5 กลุ่มที่ผลวินิจฉัยเดียวกันหมด (62 คน) ตรงกับแบบฝึก 04 พื้นที่คลินิกเฉพาะทางที่ทำให้บางกลุ่มเหมือนกันหมดเป็นข้อสมมติของผู้เขียนที่ใส่ในข้อมูลสังเคราะห์',
  },
  en: {
    title: 'Choose how exact the age and the zip are, and see how the 2,000 people split into groups. A group smaller than k is red and has to be cut out',
    band: 'age band', bandUnit: 'years', zip: 'zip', zipUnit: 'digits', k: 'k (every group needs at least)',
    key: { small: 'in a group smaller than k, cut out', ok: 'in a group of at least k', same: 'dark outline: everybody in the group has the same diagnosis' },
    cut: (n, p) => `${num(n)} people cut out (${p})`, groups: 'groups', smallest: 'smallest group', people: 'people',
    same: (g, p) => `${num(g)} ${g === 1 ? 'group' : 'groups'} where everybody has the same diagnosis (${num(p)} people)`, noSame: 'no group where everybody has the same diagnosis', example: (z, b, s, d, n) => `zip ${z}… · ${b} · ${s}: all ${n} people have ${d}`, sexes: ['male', 'female'], all: 'all',
    caption: 'Every square is one real person of the synthetic table of 2,000. The groups are made live in the browser. With 10 year bands, a 3 digit zip and k = 5, 10 people are cut and 5 groups have one diagnosis only (62 people), as exercise 04 asserts. The specialist clinic area that makes some groups identical is an assumption of the author, put into the made-up data.',
  },
};

export default function KAnonLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [band, setBand] = useState(10);
  const [zd, setZd] = useState(3);
  const [k, setK] = useState(5);
  const groups = useMemo(() => kGroups(band, zd), [band, zd]);
  const layout = useMemo(() => {
    for (const cell of [11, 9, 8, 7, 6, 5]) {
      const p = packGroups(groups, cell, 4, 868);
      if (p.height <= 330 || cell === 5) return { ...p, cell };
    }
    return { placed: [], height: 0, cell: 5 };
  }, [groups]);
  const kept = groups.filter((g) => g.members.length >= k);
  const cut = groups.filter((g) => g.members.length < k).reduce((s, g) => s + g.members.length, 0);
  const same = kept.filter((g) => g.homogeneous);
  const samePeople = same.reduce((s, g) => s + g.members.length, 0);
  const smallest = Math.min(...groups.map((g) => g.members.length));
  const bigSame = [...same].sort((a, b) => b.members.length - a.members.length).slice(0, 2);
  const bandLabel = (start: number) => (band === 1 ? String(start) : `${start}-${start + band - 1}`);
  const pctCut = `${((cut / N) * 100).toFixed(cut / N < 0.1 && cut > 0 ? 1 : 0)}%`;
  return (
    <figure className="viz ib-fig lg">
      <div className="viz-title">{T.title}</div>
      <div className="ib-controls" style={{ flexWrap: 'wrap', gap: 12 }}>
        <span className="ib-lbl">{T.band}</span>
        <span className="seg" role="group" aria-label={T.band}>{BANDS.map((b) => <button key={b} type="button" aria-pressed={band === b} onClick={() => setBand(b)}>{b} {T.bandUnit}</button>)}</span>
        <span className="ib-lbl">{T.zip}</span>
        <span className="seg" role="group" aria-label={T.zip}>{ZIPD.map((z) => <button key={z} type="button" aria-pressed={zd === z} onClick={() => setZd(z)}>{z} {T.zipUnit}</button>)}</span>
        <span className="ib-lbl">{T.k}</span>
        <span className="seg" role="group" aria-label={T.k}>{KS.map((x) => <button key={x} type="button" aria-pressed={k === x} onClick={() => setK(x)}>{x}</button>)}</span>
      </div>
      <Key items={[{ color: 'var(--ib-bad)', text: T.key.small }, { color: 'var(--accent)', text: T.key.ok }, { color: 'var(--fg)', text: T.key.same, ring: true }]} />
      <div className="viz-box">
        <svg viewBox="0 0 880 468" role="img" aria-label={T.title}>
          <g transform="translate(6,8)">
            {layout.placed.map(({ g, x, y, w, h, cols }) => {
              const small = g.members.length < k;
              const homo = !small && g.homogeneous;
              const c = layout.cell;
              return (
                <g key={g.key}>
                  <rect x={x - 1} y={y - 1} width={w + 2} height={h + 2} rx={2} fill="none" stroke={homo ? 'var(--fg)' : 'var(--line)'} strokeWidth={homo ? 2.5 : 0.8} />
                  {g.members.map((m, j) => (
                    <rect key={m} x={x + (j % cols) * c + 0.8} y={y + Math.floor(j / cols) * c + 0.8} width={c - 1.6} height={c - 1.6} rx={1.5} style={{ fill: small ? 'var(--ib-bad)' : 'var(--accent)' }} />
                  ))}
                </g>
              );
            })}
          </g>
          <rect x={6} y={352} width={868} height={108} rx={12} className="ib-banner" />
          <text x={22} y={382} style={{ fontSize: 18, fontWeight: 700, fill: cut > 0 ? 'var(--ib-bad)' : 'var(--accent)' }}>{cut > 0 ? '✗ ' : '✓ '}{T.cut(cut, pctCut)}</text>
          <text x={22} y={408} className="ib-n" style={{ fontSize: 15.5 }}>{`${T.groups}: ${num(groups.length)}   ·   ${T.smallest}: ${smallest} ${T.people}`}</text>
          <text x={22} y={434} className="ib-n" style={{ fontSize: 15.5, fontWeight: 700 }}>{same.length ? T.same(same.length, samePeople) : T.noSame}</text>
          {bigSame.length ? (
            <text x={22} y={453} className="ib-s" style={{ fontSize: 14 }}>
              {bigSame.map((g) => { const [z, b, s] = g.key.split('|'); return T.example(z, bandLabel(Number(b)), T.sexes[Number(s)], DIAG[ROWS[g.members[0]][DIA]], g.members.length); }).slice(0, 1).join('')}
            </text>
          ) : null}
        </svg>
      </div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
