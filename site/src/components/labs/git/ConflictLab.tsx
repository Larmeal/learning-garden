import { useState } from 'react';
import { ClockControls, useClock, type Lang, type Mark } from '../spark/timeline';
import { Lines } from '../iceberg/ib';
import data from './labData.json';

// Shows:      how a three-way merge decides, line by line, from three versions of one file (the common ancestor, ours, theirs). A highlight walks
//             down the lines, says what it decided and writes the result. With a conflict the result holds markers, and the reader picks the way out.
// Because:    the rule "take the side that changed, and stop if both changed it differently" is about three columns and one row at a time.
//             It cannot be a sentence: the reader has to see the base column to know which side changed.
// Control:    the two scenarios (changes on different lines, changes on the same line) change the file; the three resolve buttons (only a
//             conflict has them) change the result and the commit that follows; the clock walks down the lines.
// Conclusion: Git compares each side with the ancestor, not the two sides with each other. Different lines merge alone; the same line stops it.
//
// The texts and the markers come from exercises/16_lab_data.py (the same files as exercise 04). The "edit yourself" result is the one exercise 04 commits.

type Case = 'apart' | 'same';
type Pick = 'none' | 'ours' | 'theirs' | 'both';
const D = data.merge.cases;
const DURATION = 8.5;
const split = (s: string) => s.replace(/\n$/, '').split('\n');
const BOTH = 'salad with egg and tuna';

const TEXT: Record<Lang, {
  title: string; scenario: string; scenarios: Record<Case, string>; resolve: string; picks: Record<Pick, string>;
  base: string; ours: string; theirs: string; result: string; line: string;
  verdict: { same: string; ours: string; theirs: string; conflict: string };
  done: { apart: string; same: string }; after: (pick: Pick) => string; marks: Mark[]; caption: string; legendChanged: string; legendSame: string; legendConflict: string;
}> = {
  th: {
    title: 'Git ดูทีละบรรทัดว่าฝั่งไหนเปลี่ยนจากต้นฉบับ เลือกว่าสองฝั่งแก้คนละบรรทัดหรือบรรทัดเดียวกัน แล้วกดเล่น',
    scenario: 'สองฝั่งแก้',
    scenarios: { apart: 'คนละบรรทัด', same: 'บรรทัดเดียวกัน' },
    resolve: 'ทางออกของ Conflict',
    picks: { none: 'ยังไม่เลือก', ours: 'เก็บของเรา', theirs: 'เก็บของเขา', both: 'เขียนเองให้รวมกัน' },
    base: 'ต้นฉบับร่วม', ours: 'ของเรา (main)', theirs: 'ของเขา', result: 'ผลที่ได้', line: 'บรรทัด',
    verdict: { same: 'ทั้งสองฝั่งเหมือนต้นฉบับ ไม่ต้องทำอะไร', ours: 'มีแค่ฝั่งเราที่เปลี่ยน เก็บของเรา', theirs: 'มีแค่ฝั่งเขาที่เปลี่ยน เก็บของเขา', conflict: 'สองฝั่งเปลี่ยนไม่เหมือนกัน Git ตัดสินเองไม่ได้ จึงหยุดแล้วใส่เครื่องหมายไว้ในไฟล์' },
    done: { apart: 'Git รวมให้เองครบ ได้ Merge Commit ที่มีสอง Parent โดยเราไม่ต้องทำอะไร', same: 'Git หยุดที่ Conflict ไฟล์อยู่ในสถานะ UU จนกว่าเราจะแก้แล้วสั่ง git add' },
    after: (p) => (p === 'none' ? '' : 'git add menu.txt แล้ว git commit ได้ Merge Commit ที่มีสอง Parent เหมือนกรณีที่รวมได้เอง'),
    marks: [
      { at: 0, name: 'สามเวอร์ชัน', title: 'Git เก็บสามเวอร์ชันของไฟล์', text: 'ต้นฉบับร่วมคือ Commit ที่สองฝั่งแยกกันมา ของเราคือเวอร์ชันบน main และของเขาคือเวอร์ชันบน Branch ที่กำลังรวม Git จะไม่เทียบสองฝั่งกันเอง มันเทียบแต่ละฝั่งกับต้นฉบับ' },
      { at: 1.2, name: 'ทีละบรรทัด', title: 'ไล่ดูทีละบรรทัด', text: 'ไล่จากบนลงล่าง ถ้าฝั่งเดียวเปลี่ยน ก็เก็บของฝั่งนั้น ถ้าสองฝั่งเปลี่ยนเป็นข้อความเดียวกัน ก็เก็บอันนั้น ถ้าสองฝั่งเปลี่ยนไม่เหมือนกัน คือ Conflict' },
      { at: 6.6, name: 'ผลที่ได้', title: 'ผลของการรวม', text: 'ถ้าแก้คนละบรรทัดจะรวมได้เอง ถ้าแก้บรรทัดเดียวกัน Git ใส่ทั้งสองเวอร์ชันไว้ระหว่างเครื่องหมาย แล้วให้เราตัดสินใจ' },
    ],
    caption: 'ข้อความและเครื่องหมายมาจากแบบฝึก 16 ที่รัน git merge จริงกับไฟล์เดียวกันสองแบบ ปุ่ม "เขียนเองให้รวมกัน" ใช้ข้อความ salad with egg and tuna ตามที่แบบฝึก 04 บันทึกเป็น Commit',
    legendChanged: 'บรรทัดที่ฝั่งนี้แก้', legendSame: 'เหมือนต้นฉบับ', legendConflict: 'Conflict',
  },
  en: {
    title: 'Git checks line by line which side changed from the original. Choose whether the two sides changed different lines or the same line, then press play',
    scenario: 'Both sides changed',
    scenarios: { apart: 'different lines', same: 'the same line' },
    resolve: 'Way out of the conflict',
    picks: { none: 'not chosen', ours: 'keep ours', theirs: 'keep theirs', both: 'write one that combines them' },
    base: 'common ancestor', ours: 'ours (main)', theirs: 'theirs', result: 'result', line: 'line',
    verdict: { same: 'Both sides equal the ancestor, nothing to do', ours: 'Only our side changed, so keep ours', theirs: 'Only their side changed, so keep theirs', conflict: 'The two sides changed it differently. Git cannot decide, so it stops and puts markers in the file' },
    done: { apart: 'Git combined everything by itself. The result is a merge commit with two parents, and we did nothing', same: 'Git stopped at a conflict. The file stays in the UU state until we fix it and run git add' },
    after: (p) => (p === 'none' ? '' : 'git add menu.txt, then git commit, gives a merge commit with two parents, the same as when Git could merge by itself'),
    marks: [
      { at: 0, name: 'three versions', title: 'Git holds three versions of the file', text: 'The common ancestor is the commit the two sides split from. Ours is the version on main and theirs is the version on the branch being merged. Git does not compare the two sides with each other. It compares each side with the ancestor.' },
      { at: 1.2, name: 'line by line', title: 'Walk down the lines', text: 'From top to bottom: if only one side changed, keep that side. If both changed to the same text, keep it. If both changed it differently, that is a conflict.' },
      { at: 6.6, name: 'result', title: 'The result of the merge', text: 'Different lines merge by themselves. The same line makes Git put both versions between markers and leave the decision to us.' },
    ],
    caption: 'The texts and markers come from exercise 16, which runs git merge for real on the same file in two ways. The button "write one that combines them" uses the text salad with egg and tuna, the one exercise 04 commits.',
    legendChanged: 'a line this side changed', legendSame: 'same as the ancestor', legendConflict: 'conflict',
  },
};

export default function ConflictLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [which, setWhich] = useState<Case>('apart');
  const [pick, setPick] = useState<Pick>('none');
  const clock = useClock(DURATION);
  const c = D[which];
  const base = split(c.base), ours = split(c.ours), theirs = split(c.theirs);
  const n = base.length;
  const verdict = base.map((b, i) => (ours[i] === theirs[i] ? (ours[i] === b ? 'same' : 'ours') : ours[i] === b ? 'theirs' : theirs[i] === b ? 'ours' : 'conflict') as 'same' | 'ours' | 'theirs' | 'conflict');
  // ours === theirs but changed counts as "both changed to the same text": show it as "ours" (keep it). The two scenarios here never hit that case.
  const t = clock.t;
  const rowAt = (i: number) => 1.6 + i * 1.6;
  const current = Math.min(n - 1, Math.max(0, Math.floor((t - 1.6) / 1.6)));
  const walking = t >= 1.2 && t < 6.6;
  const X = { base: 16, ours: 216, theirs: 416, res: 620 };
  const CW = 186, RW = 248, y0 = 94, rh = 44;

  // The result column, laid out first so that the zone behind it can be as tall as it needs to be.
  type RL = { text: string; kind: 'plain' | 'new' | 'bad'; row: number; y: number; h: number };
  const resultLines: RL[] = [];
  let yy = y0;
  base.forEach((b, i) => {
    if (verdict[i] === 'conflict' && !(which === 'same' && pick !== 'none')) {
      ['<<<<<<< HEAD', ours[i], '=======', theirs[i], '>>>>>>> theirs'].forEach((m) => {
        resultLines.push({ text: m, kind: 'bad', row: i, y: yy, h: 26 });
        yy += 30;
      });
    } else {
      const text = verdict[i] === 'conflict' ? (pick === 'ours' ? ours[i] : pick === 'theirs' ? theirs[i] : BOTH) : verdict[i] === 'theirs' ? theirs[i] : ours[i];
      resultLines.push({ text, kind: verdict[i] === 'same' ? 'plain' : 'new', row: i, y: yy, h: rh - 8 });
      yy += rh;
    }
  });
  const zoneH = Math.max(n * rh, yy - y0) + 24;
  const shown = (row: number) => t >= rowAt(row) + 0.9;
  const cell = (x: number, w: number, i: number, text: string, changed: boolean, key: string) => (
    <g key={key}>
      <rect className={changed ? 'ib-new' : 'ib-node'} x={x} y={y0 + i * rh} width={w} height={rh - 8} rx={8} />
      <text x={x + 12} y={y0 + i * rh + 27} className="ib-m" style={{ fill: 'var(--fg)', fontSize: 15 }}>{text}</text>
    </g>
  );
  const hl = walking ? current : -1;
  const finished = t >= rowAt(n - 1) + 0.9;
  const banner = walking ? `${T.line} ${current + 1}: ${T.verdict[verdict[current]]}` : finished ? (pick !== 'none' && which === 'same' ? T.after(pick) : T.done[which]) : '';
  const bannerY = 76 + zoneH + 18;
  const H = bannerY + 64 + 14;

  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <div className="ib-controls">
        <span className="ib-lbl">{T.scenario}</span>
        <div className="seg" role="group" aria-label={T.scenario}>
          {(['apart', 'same'] as Case[]).map((k) => (
            <button key={k} type="button" aria-pressed={which === k} onClick={() => { setWhich(k); setPick('none'); clock.restart(); }}>{T.scenarios[k]}</button>
          ))}
        </div>
        {which === 'same' && (
          <>
            <span className="ib-lbl">{T.resolve}</span>
            <div className="seg" role="group" aria-label={T.resolve}>
              {(['none', 'ours', 'theirs', 'both'] as Pick[]).map((k) => (
                <button key={k} type="button" aria-pressed={pick === k} onClick={() => setPick(k)}>{T.picks[k]}</button>
              ))}
            </div>
          </>
        )}
      </div>
      <div className="ib-legend" aria-label="legend">
        <span><i className="new" />{T.legendChanged}</span>
        <span><i />{T.legendSame}</span>
        <span><i style={{ borderColor: 'var(--ib-bad)' }} />{T.legendConflict}</span>
      </div>
      <div className="viz-box">
        <svg viewBox={`0 0 880 ${H}`} role="img" aria-label={T.title}>
          {[['base', X.base, CW, T.base], ['ours', X.ours, CW, T.ours], ['theirs', X.theirs, CW, T.theirs], ['res', X.res, RW, T.result]].map(([k, x, w, label]) => (
            <g key={k as string}>
              <text x={(x as number) + 4} y={32} className="ib-t">{label as string}</text>
              <text x={(x as number) + 4} y={56} className="ib-m">menu.txt</text>
              <rect x={(x as number) - 6} y={76} width={(w as number) + 12} height={k === 'res' ? zoneH : n * rh + 24} rx={12} className="ib-zone" style={{ opacity: 0.55 }} />
            </g>
          ))}
          {base.map((b, i) => cell(X.base, CW, i, b, false, `b${i}`))}
          {ours.map((o, i) => cell(X.ours, CW, i, o, o !== base[i], `o${i}`))}
          {theirs.map((o, i) => cell(X.theirs, CW, i, o, o !== base[i], `t${i}`))}
          {hl >= 0 && (
            <rect x={X.base - 10} y={y0 + hl * rh - 4} width={X.theirs + CW - X.base + 20} height={rh} rx={10} className="ib-use" style={{ fill: 'none', strokeWidth: 3.5 }} />
          )}
          {resultLines.map((l, k) => {
            if (!shown(l.row)) return null;
            const bad = l.kind === 'bad';
            return (
              <g key={k}>
                <rect className={l.kind === 'new' ? 'ib-new' : 'ib-node'} x={X.res} y={l.y} width={RW} height={l.h} rx={bad ? 6 : 8} style={bad ? { stroke: 'var(--ib-bad)', strokeWidth: 2.5 } : undefined} />
                <text x={X.res + 10} y={l.y + (bad ? 18 : 27)} className="ib-m" style={{ fill: bad ? 'var(--ib-bad)' : 'var(--fg)', fontSize: bad ? 14 : 15, fontWeight: bad ? 700 : 400 }}>{l.text}</text>
              </g>
            );
          })}
          {banner && (
            <g>
              <rect className="ib-banner" x={12} y={bannerY} width={856} height={64} rx={10} />
              <Lines x={26} y={bannerY + 26} text={banner} max={lang === 'th' ? 80 : 92} lh={22} className="ib-n" />
            </g>
          )}
        </svg>
      </div>
      <ClockControls clock={clock} marks={T.marks} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
