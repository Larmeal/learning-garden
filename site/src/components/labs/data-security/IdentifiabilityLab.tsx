import { useState } from 'react';
import { StepControls, useStepper, type Lang, type StepInfo } from '../spark/stepper';
import { Key, PersonGlyph, num } from './ds';
import { FEATURED, NAMES, N, ROWS, ZIPS, SEX, ZIP, YEAR, MONTH, DAY, factKey, groupSizes } from './peopleLib';

// Shows:      a crowd of 2,000 dots (the people of the table, with the names taken out) and one person we are looking for. We learn one ordinary fact about them at a time
//             (sex, zip, birth year, month, day). Every dot that does not match the facts we know fades, and the number of people who still could be them is written under the crowd.
// Because:    "no column identifies anybody, but a few together do" is something you only believe after watching the crowd empty out until one dot is left.
// Control:    who we look for (three real people of the table) and the step buttons that add one fact. Every step fades some dots and changes the number.
// Conclusion: sex, zip and a birth date are harmless one by one, and together they point at one person. Taking the name out of a table is not anonymization.
//
// The rows are the real 2,000 people of the exercises (labPeople.json). The count under the crowd, and the table-wide count in the last line, are computed from those rows
// in the browser, and exercises/12_lab_people.py and verify_labs.mts check them against exercise 01 (0, 0, 450, 1,757, 1,992 people alone).

const COLS = 80, GAP = 7.2, X0 = 296, Y0 = 70;
const MONTHS = { th: ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'], en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] };

const TEXT: Record<Lang, {
  title: string; who: string; facts: string[]; unknown: string; sexes: string[]; target: string; crowd: string; stillMatch: string; stillOne: string; of: string; found: string; keyMatch: string; keyOut: string; keyTarget: string;
  names: string[]; tableWide: (alone: number) => string; caption: string; step: (d: number, who: string, n: number, fact: string) => { title: string; text: string };
}> = {
  th: {
    title: 'เลือกคนที่เราตามหา แล้วกดเพิ่มข้อมูลธรรมดาของเขาทีละอย่าง ดูว่าฝูงชน 2,000 คนเหลือกี่คน',
    who: 'คนที่เราตามหา', facts: ['เพศ', 'รหัสไปรษณีย์', 'ปีเกิด', 'เดือนเกิด', 'วันที่เกิด'], unknown: 'ยังไม่รู้', sexes: ['ชาย', 'หญิง'], target: 'เป้าหมาย',
    crowd: 'ตารางทั้งตาราง 2,000 คน (ชื่อถูกเอาออกแล้ว)', stillMatch: 'คนที่ยังตรงกับข้อมูลที่รู้', stillOne: 'คน และเป็นเขาคนเดียว', of: 'จาก', found: 'เจอตัวแล้ว มีคนเดียวในตารางที่ตรง',
    keyMatch: 'ยังตรงกับข้อมูลที่รู้', keyOut: 'ไม่ตรงแล้ว', keyTarget: 'คนที่เราตามหา',
    names: ['เริ่ม', 'เพศ', 'Zip', 'ปีเกิด', 'เดือนเกิด', 'วันเกิด'],
    tableWide: (a) => `ทั้งตารางด้วยข้อมูลเท่านี้ มี ${num(a)} คนที่อยู่ตัวคนเดียว`,
    caption: 'ทุกจุดคือคนหนึ่งคนของตารางสังเคราะห์ 2,000 คนที่ใช้ทุกบท จำนวนที่ตรงกับข้อมูลที่รู้ และจำนวนคนที่อยู่ตัวคนเดียวทั้งตาราง นับสดจากแถวจริงเหล่านี้ และเท่ากับที่แบบฝึก 01 นับได้ (0, 0, 450, 1,757 และ 1,992 คน)',
    step: (d, who, n, fact) => d === 0
      ? { title: 'ตารางไม่มีชื่อ แต่ยังมีคอลัมน์ธรรมดา', text: `ตารางนี้ถูกเอาชื่อ อีเมล และเบอร์โทรออกหมดแล้ว เรากำลังตามหา ${who} ซึ่งอาจเป็นใครก็ได้ใน 2,000 คนนี้ ตอนนี้เรายังไม่รู้อะไรเกี่ยวกับเขา` }
      : n === 1
        ? { title: `รู้${fact}แล้ว เหลือคนเดียว`, text: `ข้อมูลที่เรารู้ตอนนี้ตรงกับ ${who} คนเดียวในตารางทั้งตาราง แถวนั้นก็คือเขา และทุกคอลัมน์ที่เหลือ รวมถึงผลวินิจฉัย ก็เป็นของเขาด้วย` }
        : { title: `รู้${fact}แล้ว เหลือ ${num(n)} คน`, text: `คนที่ตรงกับทุกข้อที่เรารู้ มีอยู่ ${num(n)} คน ส่วนที่เหลือ ${num(N - n)} คนไม่ใช่เขาแน่ ๆ จึงจางลง` },
  },
  en: {
    title: 'Pick the person we look for, then add one ordinary fact about them at a time and watch the crowd of 2,000 shrink',
    who: 'the person we look for', facts: ['sex', 'zip code', 'birth year', 'birth month', 'birth day'], unknown: 'not known yet', sexes: ['male', 'female'], target: 'target',
    crowd: 'the whole table, 2,000 people (names already removed)', stillMatch: 'people who still match what we know', stillOne: 'person matches, and it is them', of: 'of', found: 'found them: only one person in the table matches',
    keyMatch: 'still matches what we know', keyOut: 'no longer matches', keyTarget: 'the person we look for',
    names: ['start', 'sex', 'zip', 'birth year', 'birth month', 'birth day'],
    tableWide: (a) => `In the whole table, ${num(a)} people are alone with this much information`,
    caption: 'Every dot is one person of the synthetic table of 2,000 that every lesson uses. The number that match, and the number of people who are alone in the whole table, are counted live from these real rows, and equal what exercise 01 counts (0, 0, 450, 1,757 and 1,992 people).',
    step: (d, who, n, fact) => d === 0
      ? { title: 'The table has no names, but it still has ordinary columns', text: `Names, e-mails and phone numbers were taken out of this table. We are looking for ${who}, who could be any of these 2,000 people. So far we know nothing about them.` }
      : n === 1
        ? { title: `Knowing the ${fact}, one person is left`, text: `What we know now matches ${who} and nobody else in the table. That row is them, and every other column of it, the diagnosis included, belongs to them.` }
        : { title: `Knowing the ${fact}, ${num(n)} people are left`, text: `${num(n)} people match everything we know. The other ${num(N - n)} cannot be them, so they fade.` },
  },
};

export default function IdentifiabilityLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [who, setWho] = useState(0);
  const { step, go, playing, toggle } = useStepper(6, 3400);
  const me = FEATURED[who];
  const r = ROWS[me];
  const depth = step;
  const match = ROWS.map((x) => (depth === 0 ? true : factKey(x, depth) === factKey(r, depth)));
  const n = match.filter(Boolean).length;
  const alone = groupSizes(depth || 1).filter((s) => s === 1).length;
  const aloneAll = depth === 0 ? 0 : alone;
  const values = [T.sexes[r[SEX]], ZIPS[r[ZIP]], String(r[YEAR]), MONTHS[lang][r[MONTH] - 1], String(r[DAY])];
  const steps: StepInfo[] = T.names.map((name) => ({ name, title: '', text: '' }));
  steps[depth] = { name: T.names[depth], ...T.step(depth, NAMES[me], n, T.facts[depth - 1] ?? '') };
  const dotX = (i: number) => X0 + (i % COLS) * GAP, dotY = (i: number) => Y0 + Math.floor(i / COLS) * GAP;
  const barW = 480;
  return (
    <figure className="viz ib-fig lg">
      <div className="viz-title">{T.title}</div>
      <div className="ib-controls">
        <span className="ib-lbl">{T.who}</span>
        <span className="seg" role="group" aria-label={T.who}>
          {FEATURED.map((f, k) => <button key={f} type="button" aria-pressed={who === k} onClick={() => { setWho(k); go(0); }}>{NAMES[f]}</button>)}
        </span>
      </div>
      <Key items={[{ color: 'var(--accent)', text: T.keyMatch }, { color: 'var(--line-strong)', text: T.keyOut, faded: true }, { color: 'var(--ib-bad)', text: T.keyTarget, ring: true }]} />
      <div className="viz-box">
        <svg viewBox="0 0 880 400" role="img" aria-label={T.title}>
          {/* the person we look for */}
          <rect x={6} y={10} width={262} height={380} rx={14} fill="var(--surface)" stroke="var(--line-strong)" strokeWidth={2} />
          <PersonGlyph cx={137} cy={52} r={20} fill="var(--accent-soft)" ring={depth > 0 && n === 1 ? 'var(--ib-bad)' : undefined} />
          <text x={137} y={124} textAnchor="middle" className="ib-n" style={{ fontWeight: 700, fontSize: 18 }}>{NAMES[me]}</text>
          <text x={137} y={146} textAnchor="middle" className="ib-s" style={{ fontSize: 14 }}>{T.who}</text>
          {T.facts.map((label, i) => {
            const known = i < depth;
            const y = 176 + i * 42;
            return (
              <g key={label} opacity={known ? 1 : 0.55} style={{ transition: 'opacity .5s' }}>
                <text x={24} y={y} className="ib-s" style={{ fontSize: 14 }}>{label}</text>
                <text x={24} y={y + 20} className="ib-n" style={{ fontWeight: 700, fontSize: 17, fill: known ? 'var(--fg)' : 'var(--muted)' }}>{known ? values[i] : T.unknown}</text>
                {known && i === depth - 1 ? <text x={254} y={y + 20} textAnchor="end" style={{ fill: 'var(--accent)', fontWeight: 700, fontSize: 15 }}>+</text> : null}
              </g>
            );
          })}
          {/* the crowd */}
          <text x={X0} y={34} className="ib-n" style={{ fontWeight: 700, fontSize: 16 }}>{T.crowd}</text>
          {ROWS.map((_, i) => {
            const mine = i === me;
            const on = match[i];
            return (
              <circle key={i} cx={dotX(i)} cy={dotY(i)} r={mine ? 4.2 : on ? 2.7 : 2.1}
                style={{ fill: mine ? 'var(--ib-bad)' : on ? 'var(--accent)' : 'var(--line-strong)', opacity: mine ? 1 : on ? 1 : 0.28, transition: 'opacity .6s, fill .6s' }} />
            );
          })}
          <circle cx={dotX(me)} cy={dotY(me)} r={9} fill="none" stroke="var(--ib-bad)" strokeWidth={2.5} />
          {/* the count */}
          <text x={X0} y={290} style={{ fontWeight: 700, fontSize: 44, fill: n === 1 && depth > 0 ? 'var(--ib-bad)' : 'var(--fg)' }}>{num(n)}</text>
          <text x={X0 + (n >= 1000 ? 124 : n >= 100 ? 92 : n >= 10 ? 66 : 44)} y={288} className="ib-n" style={{ fontSize: 17 }}>{n === 1 && depth > 0 ? T.stillOne : T.stillMatch}</text>
          <rect x={X0} y={304} width={barW} height={14} rx={7} fill="var(--accent-soft)" stroke="var(--line-strong)" />
          <rect x={X0} y={304} width={Math.max(6, (barW * n) / N)} height={14} rx={7} fill={n === 1 && depth > 0 ? 'var(--ib-bad)' : 'var(--accent)'} style={{ transition: 'width .6s' }} />
          <text x={X0 + barW + 10} y={317} className="ib-s" style={{ fontSize: 14 }}>{T.of} {num(N)}</text>
          <rect x={X0} y={338} width={574} height={42} rx={10} className="ib-banner" />
          <text x={X0 + 14} y={365} className="ib-n" style={{ fontWeight: 700, fontSize: 16 }}>{n === 1 && depth > 0 ? T.found : T.tableWide(aloneAll)}</text>
        </svg>
      </div>
      <StepControls steps={steps} step={step} playing={playing} go={go} toggle={toggle} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
