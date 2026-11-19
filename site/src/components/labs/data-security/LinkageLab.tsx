import { useMemo, useState } from 'react';
import { Key, num } from './ds';
import type { Lang } from '../spark/stepper';
import { DIAG, N, NAMES, ROWS, ZIPS, SEX, ZIP, YEAR, MONTH, DAY, DIA, VOTER, candidates, link, type Birth } from './peopleLib';

// Shows:      six rows of a medical table that has no names, and next to each row the people on a public voter list who share its zip, birth date and sex. Choose how exactly the
//             birth date and the zip are kept. When only one voter fits, the row gets a name (and so does its diagnosis). When many fit, the names pile up and the row stays anonymous.
// Because:    "we took the names out" is believed until you see the name come back through a join. The pile of candidate names shrinking to one is the whole attack.
// Control:    the detail of the birth date (day, month, year), of the zip (5 digits, 3 digits, none) and whether sex is used. Every choice changes the candidates of every row.
// Conclusion: a name comes back for the people whose combination of values is rare. Coarser values keep the candidates many, and the more exact they are the more rows are named.
//
// The rows are the real people of the exercises (labPeople.json) and the voter list is the real list of 1,413. The "whole table" count under the picture is computed live from all
// 2,000 rows and equals exercise 03 (1,410 rows named by the join with the exact values, 1,409 of them right). One row of the six is not on the voter list, on purpose.

const COUNT = 6;
const TEXT: Record<Lang, {
  title: string; join: string; birth: string; births: Record<Birth, string>; zip: string; zips: Record<string, string>; sex: string; sexOn: string; sexOff: string;
  medical: string; noName: string; voters: string; sexes: string[]; none: string; named: string; many: (n: number) => string; more: (n: number) => string; notOn: string; wrongName: string;
  whole: (named: number, right: number) => string; key: { named: string; many: string }; caption: string; hasDx: string; sub: string;
}> = {
  th: {
    title: 'เลือกว่าเก็บวันเกิดกับ Zip ละเอียดแค่ไหน แล้วดูว่าแต่ละแถวของตารางที่ไม่มีชื่อ ได้ชื่อกลับมาหรือไม่',
    join: 'Join ด้วย', birth: 'วันเกิด', births: { day: 'วัน เดือน ปี', month: 'เดือน และปี', year: 'ปีเท่านั้น', none: 'ไม่ใช้' }, zip: 'Zip', zips: { '5': '5 หลัก', '3': '3 หลัก', '0': 'ไม่ใช้' }, sex: 'เพศ', sexOn: 'ใช้', sexOff: 'ไม่ใช้',
    medical: 'ตารางโรงพยาบาล (ไม่มีชื่อ)', noName: 'ไม่มีชื่อ', voters: 'ผู้มีสิทธิ์เลือกตั้งที่ตรงกัน (ข้อมูลสาธารณะ)', sexes: ['ชาย', 'หญิง'], none: 'ไม่มีใครในรายชื่อตรงกัน',
    named: 'ได้ชื่อกลับมา', many: (n) => `มี ${num(n)} คนตรงกัน แยกไม่ออก`, more: (n) => `อีก ${num(n)} คน`, notOn: 'คนนี้ไม่อยู่ในรายชื่อ จึงไม่ได้ชื่อกลับมา', wrongName: 'ได้ชื่อผิดคน',
    whole: (n, r) => `ทั้งตาราง 2,000 แถว: ได้ชื่อกลับมา ${num(n)} แถว ชื่อถูกต้อง ${num(r)} แถว`, key: { named: 'ได้ชื่อและโรคกลับมา', many: 'ยังแยกไม่ออก' }, hasDx: 'โรคที่โผล่', sub: 'เพศ · Zip · วันเกิด',
    caption: 'แถวในภาพเป็นคนจริงของตารางสังเคราะห์ 2,000 คน และรายชื่อผู้มีสิทธิ์เลือกตั้งคือรายการจริง 1,413 คน (หนึ่งในหกแถวไม่อยู่ในรายชื่อ ตั้งใจให้เห็นว่าคนที่ไม่อยู่ในรายชื่อก็รอดได้) ตัวเลขทั้งตารางนับสดจาก 2,000 แถว และเท่ากับแบบฝึก 03 (1,410 แถว ถูก 1,409 เมื่อใช้ค่าละเอียดสุด)',
  },
  en: {
    title: 'Choose how exactly the birth date and the zip are kept, and see which rows of the table without names get their name back',
    join: 'Join on', birth: 'birth date', births: { day: 'day, month, year', month: 'month and year', year: 'year only', none: 'not used' }, zip: 'zip', zips: { '5': '5 digits', '3': '3 digits', '0': 'not used' }, sex: 'sex', sexOn: 'used', sexOff: 'not used',
    medical: 'hospital table (no names)', noName: 'no name', voters: 'voters who match (public data)', sexes: ['male', 'female'], none: 'nobody on the list matches',
    named: 'name got back', many: (n) => `${num(n)} people match, cannot tell which`, more: (n) => `${num(n)} more`, notOn: 'this person is not on the list, so no name comes back', wrongName: 'the wrong name',
    whole: (n, r) => `Whole table, 2,000 rows: ${num(n)} rows got a name back, ${num(r)} of them correct`, key: { named: 'name and diagnosis got back', many: 'still cannot tell' }, hasDx: 'diagnosis exposed', sub: 'sex · zip · birth date',
    caption: 'The rows are real people of the synthetic table of 2,000 and the voter list is the real list of 1,413 (one of the six rows is not on it, on purpose, to show that someone who is not on the list can slip through). The whole table count is computed live from all 2,000 rows and equals exercise 03 (1,410 rows named, 1,409 right, with the exact values).',
  },
};

export default function LinkageLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [birth, setBirth] = useState<Birth>('day');
  const [zip, setZip] = useState('5');
  const [sex, setSex] = useState(true);
  // the six rows: the first five people on the voter list, and the first person who is not on it
  const sample = useMemo(() => {
    const on = ROWS.map((r, i) => (r[VOTER] ? i : -1)).filter((i) => i >= 0).slice(0, COUNT - 1);
    const off = ROWS.findIndex((r) => !r[VOTER]);
    return [...on.slice(0, 2), off, ...on.slice(2)];
  }, []);
  const zd = Number(zip);
  const whole = useMemo(() => link(birth, zd, sex), [birth, zd, sex]);
  const rowH = 62, y0 = 92;
  return (
    <figure className="viz ib-fig lg">
      <div className="viz-title">{T.title}</div>
      <div className="ib-controls" style={{ flexWrap: 'wrap', gap: 14 }}>
        <span className="ib-lbl">{T.join}</span>
        <span className="ib-lbl">{T.birth}</span>
        <span className="seg" role="group" aria-label={T.birth} style={{ flexWrap: 'wrap' }}>
          {(['day', 'month', 'year', 'none'] as Birth[]).map((b) => <button key={b} type="button" aria-pressed={birth === b} onClick={() => setBirth(b)}>{T.births[b]}</button>)}
        </span>
        <span className="ib-lbl">{T.zip}</span>
        <span className="seg" role="group" aria-label={T.zip} style={{ flexWrap: 'wrap' }}>
          {Object.keys(T.zips).map((z) => <button key={z} type="button" aria-pressed={zip === z} onClick={() => setZip(z)}>{T.zips[z]}</button>)}
        </span>
        <span className="ib-lbl">{T.sex}</span>
        <span className="seg" role="group" aria-label={T.sex}>
          <button type="button" aria-pressed={sex} onClick={() => setSex(true)}>{T.sexOn}</button>
          <button type="button" aria-pressed={!sex} onClick={() => setSex(false)}>{T.sexOff}</button>
        </span>
      </div>
      <Key items={[{ color: 'var(--ib-bad)', text: T.key.named }, { color: 'var(--line-strong)', text: T.key.many, faded: true }]} />
      <div className="viz-box">
        <svg viewBox="0 0 880 560" role="img" aria-label={T.title}>
          <text x={10} y={30} className="ib-n" style={{ fontWeight: 700, fontSize: 17 }}>{T.medical}</text>
          <text x={10} y={52} className="ib-s" style={{ fontSize: 14 }}>{T.sub}</text>
          <text x={400} y={30} className="ib-n" style={{ fontWeight: 700, fontSize: 17 }}>{T.voters}</text>
          {sample.map((i, k) => {
            const r = ROWS[i];
            const cands = candidates(i, birth, zd, sex);
            const one = cands.length === 1;
            const y = y0 + k * rowH;
            const wrongOne = one && NAMES[cands[0]] !== NAMES[i];
            const dx = DIAG[r[DIA]];
            const bad = one;
            return (
              <g key={i}>
                {/* the anonymous medical row */}
                <rect x={8} y={y - 22} width={368} height={52} rx={10} fill="var(--surface)" stroke={bad ? 'var(--ib-bad)' : 'var(--line-strong)'} strokeWidth={bad ? 3.5 : 2} style={{ transition: 'stroke .3s' }} />
                <text x={20} y={y - 1} style={{ fontFamily: 'var(--mono, monospace)', fontSize: 14.5 }}>{`${T.sexes[r[SEX]]} · ${ZIPS[r[ZIP]]} · ${r[YEAR]}-${String(r[MONTH]).padStart(2, '0')}-${String(r[DAY]).padStart(2, '0')}`}</text>
                <text x={20} y={y + 20} style={{ fontSize: 15, fontWeight: 700, fill: bad ? 'var(--ib-bad)' : 'var(--muted)' }}>{bad ? `${T.hasDx}: ${dx}` : `${T.noName}  ·  ${dx}`}</text>
                {/* the line to the candidates */}
                <line x1={376} y1={y + 4} x2={398} y2={y + 4} stroke={bad ? 'var(--ib-bad)' : 'var(--line-strong)'} strokeWidth={bad ? 4 : 2} />
                {/* candidates */}
                {cands.length === 0 ? (
                  <text x={408} y={y + 8} style={{ fontSize: 15, fill: 'var(--muted)' }}>{r[VOTER] ? T.none : T.notOn}</text>
                ) : one ? (
                  <g>
                    <rect x={404} y={y - 14} width={Math.min(460, 40 + NAMES[cands[0]].length * 10 + 140)} height={38} rx={19} fill="color-mix(in srgb, var(--ib-bad) 14%, var(--surface))" stroke="var(--ib-bad)" strokeWidth={3} />
                    <text x={422} y={y + 10} style={{ fontSize: 17, fontWeight: 700, fill: 'var(--ib-bad)' }}>{`✗ ${NAMES[cands[0]]}`}</text>
                    <text x={422 + NAMES[cands[0]].length * 10.5 + 18} y={y + 10} style={{ fontSize: 15, fill: 'var(--ib-bad)' }}>{wrongOne ? T.wrongName : T.named}</text>
                  </g>
                ) : (
                  <g>
                    {cands.slice(0, 3).map((c, j) => (
                      <g key={c}>
                        <rect x={404 + j * 132} y={y - 12} width={124} height={34} rx={17} fill="var(--accent-soft)" stroke="var(--line-strong)" strokeWidth={1.5} opacity={0.9} />
                        <text x={404 + j * 132 + 62} y={y + 10} textAnchor="middle" style={{ fontSize: 14.5 }}>{NAMES[c]}</text>
                      </g>
                    ))}
                    <text x={404 + Math.min(3, cands.length) * 132 + 4} y={y + 10} style={{ fontSize: 14.5, fill: 'var(--muted)' }}>{cands.length > 3 ? `+ ${T.more(cands.length - 3)}` : ''}</text>
                    <text x={408} y={y + 38} style={{ fontSize: 14, fill: 'var(--muted)' }}>{T.many(cands.length)}</text>
                  </g>
                )}
              </g>
            );
          })}
          {/* the whole table */}
          <rect x={8} y={y0 + COUNT * rowH + 4} width={864} height={60} rx={12} className="ib-banner" />
          <text x={24} y={y0 + COUNT * rowH + 32} className="ib-n" style={{ fontWeight: 700, fontSize: 16.5 }}>{T.whole(whole.named, whole.right)}</text>
          <rect x={24} y={y0 + COUNT * rowH + 42} width={820} height={10} rx={5} fill="var(--accent-soft)" stroke="var(--line-strong)" />
          <rect x={24} y={y0 + COUNT * rowH + 42} width={Math.max(4, (820 * whole.right) / N)} height={10} rx={5} fill="var(--ib-bad)" style={{ transition: 'width .4s' }} />
        </svg>
      </div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
