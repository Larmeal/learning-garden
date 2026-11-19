import { useState } from 'react';
import { ClockControls, useClock, prog, smooth, mix, type Lang, type Mark } from '../spark/timeline';
import { Key, PersonGlyph, num } from './ds';

// Shows:      three people who each want to add their salary to the others' without telling anybody the number. Each person cuts their salary into three random pieces and hands one to each
//             person (one stays). Everybody then adds up only the pieces in their own hands, and the three sums are put together. You can look from the side of one person, who sees only the
//             pieces that reach them, or from all three.
// Because:    "a share tells you nothing, and the shares still add up" is hard to believe from a formula. Watching the pieces travel, and then seeing that a person holds only random numbers
//             while the total still comes out right, makes it concrete.
// Control:    the three salaries (sliders), whose side you look from (person 1, 2, 3 or all), and the clock. Every salary changes every piece, the total stays right.
// Conclusion: one person holds numbers that say nothing about anybody's salary, and the sum of the three sums is the real total of the salaries.
//
// The numbers are a small example (everything is worked out modulo 100,003, with fixed random pieces) so that a reader can follow them. Exercise 09 does the same with a modulus of 2^61 - 1,
// checks that a share is spread evenly whatever the secret is (the last digit of share 1 appears 9% to 11% of the time) and that the total is 161,000.

const M = 100_003;
const R: [number, number][] = [[73_211, 18_452], [9_137, 66_029], [40_411, 85_703]]; // the two random pieces of each owner
const mod = (x: number) => ((x % M) + M) % M;
const NAMES = ['Ann', 'Bob', 'Cat'];
const CX = [150, 440, 730];
const ORIGIN = ['var(--k1)', 'var(--k2)', 'var(--k3)'];
const DUR = 11, T_SPLIT = 1.2, T_SUM = 6.2, T_TOTAL = 8.4;

const TEXT: Record<Lang, {
  title: string; salary: string; view: string; views: string[]; all: string; secret: string; hand: string; sum: string; unknown: string; board: string; real: string; same: string;
  key: { a: string }; caption: string; marks: (v: number) => Mark[]; sees: (v: number) => string;
}> = {
  th: {
    title: 'ปรับเงินเดือนของสามคน กดเล่น แล้วดูว่าแต่ละคนตัดเงินเดือนเป็นชิ้นสุ่มแล้วส่งให้กันอย่างไร ผลรวมยังถูกทั้งที่ไม่มีใครเห็นเงินเดือนของใคร',
    salary: 'เงินเดือนของ', view: 'ดูจากมุมของ', views: ['Ann', 'Bob', 'Cat'], all: 'ทั้งสามคน', secret: 'เงินเดือน (ความลับ)', hand: 'ชิ้นที่อยู่ในมือ', sum: 'ผลรวมของชิ้นในมือ', unknown: '?', board: 'เอาผลรวมของทั้งสามคนมารวมกัน', real: 'เงินเดือนรวมจริง',
    same: 'ตรงกัน', key: { a: 'สีของชิ้น บอกว่ามาจากเงินเดือนของใคร' },
    sees: (v) => `มุมของ ${NAMES[v]}: เห็นแค่ชิ้นที่มาถึงมือตัวเอง ซึ่งเป็นเลขสุ่ม`,
    caption: 'ตัวเลขเป็นตัวอย่างเล็ก ๆ ที่คิดเศษหารด้วย 100,003 และชิ้นสุ่มกำหนดตายตัว เพื่อให้ตามได้ แบบฝึก 09 ทำกับตัวหารใหญ่ (2^61 - 1) ตรวจว่าชิ้นหนึ่งกระจายสม่ำเสมอไม่ว่าความลับจะเป็นอะไร และผลรวมได้ 161,000',
    marks: (v) => [
      { at: 0, name: 'ความลับ', title: 'สามคน สามเงินเดือนลับ', text: 'ไม่มีใครอยากบอกเงินเดือนของตัวเอง แต่ทุกคนอยากรู้ว่าเงินเดือนรวมของทั้งสามคนเป็นเท่าไร' },
      { at: T_SPLIT, name: 'ตัดเป็นชิ้น', title: 'แต่ละคนตัดเงินเดือนเป็นสามชิ้นสุ่ม', text: 'สองชิ้นแรกสุ่มมา ชิ้นที่สามคือเงินเดือนลบสองชิ้นแรก (หารเอาเศษ) แล้วส่งหนึ่งชิ้นให้ทุกคน ชิ้นเดียวไม่บอกอะไรเลย แต่ครบสามชิ้นรวมกันได้เงินเดือน' },
      { at: T_SUM, name: 'รวมชิ้นในมือ', title: 'แต่ละคนบวกชิ้นที่ได้รับ', text: v === 3 ? 'ผลรวมของแต่ละคนเป็นเลขสุ่ม ไม่ใช่เงินเดือนของใคร' : `ผลรวมของ ${NAMES[v]} เป็นเลขสุ่มที่ไม่บอกอะไรเกี่ยวกับเงินเดือนของใคร คนอื่นก็เห็นเลขของตัวเองเท่านั้น` },
      { at: T_TOTAL, name: 'รวมสามกอง', title: 'เอาสามผลรวมมาบวกกันจึงได้ผลรวมที่แท้จริง', text: 'ทุกชิ้นของเงินเดือนแต่ละคนถูกนับครบพอดี ผลรวมจึงเท่ากับเงินเดือนรวมจริง โดยไม่มีใครเห็นเงินเดือนของคนอื่น' },
    ],
  },
  en: {
    title: 'Set the three salaries, press play, and watch each person cut their salary into random pieces and hand them out, so that the total comes out right and nobody sees anybody\'s salary',
    salary: 'salary of', view: 'look from the side of', views: ['Ann', 'Bob', 'Cat'], all: 'all three', secret: 'salary (a secret)', hand: 'pieces in hand', sum: 'sum of the pieces in hand', unknown: '?', board: 'put the three sums together', real: 'the real total of the salaries',
    same: 'equal', key: { a: 'the colour of a piece shows whose salary it came from' },
    sees: (v) => `${NAMES[v]}'s side: sees only the pieces that reach their own hand, and those are random numbers`,
    caption: 'The numbers are a small example worked out modulo 100,003 with fixed random pieces so that they can be followed. Exercise 09 does it with a large modulus (2^61 - 1), checks that a piece is spread evenly whatever the secret is, and that the total comes to 161,000.',
    marks: (v) => [
      { at: 0, name: 'secrets', title: 'Three people, three secret salaries', text: 'Nobody wants to tell their salary, but everybody wants to know what the three salaries add up to.' },
      { at: T_SPLIT, name: 'cut up', title: 'Each person cuts their salary into three random pieces', text: 'The first two pieces are random. The third is the salary minus the first two (modulo). One piece goes to each person. One piece alone says nothing, but all three add up to the salary.' },
      { at: T_SUM, name: 'add up', title: 'Each person adds the pieces they received', text: v === 3 ? 'Each sum is a random number, not anybody\'s salary.' : `${NAMES[v]}'s sum is a random number that says nothing about anybody's salary. The others see only their own.` },
      { at: T_TOTAL, name: 'together', title: 'The three sums added give the real total', text: 'Every piece of every salary was counted exactly once, so the total equals the real total of the salaries, and nobody saw another person\'s salary.' },
    ],
  },
};

export default function SecretShareLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [sal, setSal] = useState([52_000, 48_000, 61_000]);
  const [view, setView] = useState(0); // 0 to 2 a person, 3 all
  const clock = useClock(DUR);
  const { t } = clock;
  // pieces[i][j] is the piece of person i's salary that goes to person j
  const pieces = sal.map((s, i) => [R[i][0], R[i][1], mod(s - R[i][0] - R[i][1])]);
  const hold = (j: number) => [0, 1, 2].map((i) => pieces[i][j]);
  const pots = [0, 1, 2].map((j) => mod(hold(j).reduce((a, b) => a + b, 0)));
  const total = mod(pots.reduce((a, b) => a + b, 0));
  const real = sal.reduce((a, b) => a + b, 0);
  const seen = (j: number) => view === 3 || view === j;
  const TY = 250, SY = 124;
  const chip = (i: number, j: number) => {
    const k = i * 3 + j;
    const p = smooth(prog(t, T_SPLIT + 0.3 * k * 0.9, T_SPLIT + 0.3 * k * 0.9 + 1.2));
    const sx = CX[i] - 70 + j * 70, sy = SY + 40;
    const tx = CX[j] - 108 + i * 72 + 33, ty = TY + 30;
    return { x: mix(sx, tx, p), y: mix(sy, ty, p), p, v: pieces[i][j] };
  };
  const potP = smooth(prog(t, T_SUM, T_SUM + 1.2));
  const totP = smooth(prog(t, T_TOTAL, T_TOTAL + 1.3));
  const setOne = (i: number, v: number) => setSal((s) => s.map((x, k) => (k === i ? v : x)));
  return (
    <figure className="viz ib-fig lg">
      <div className="viz-title">{T.title}</div>
      <div className="ib-controls" style={{ flexWrap: 'wrap', gap: 14 }}>
        {NAMES.map((n, i) => (
          <label key={n} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 15 }}>
            {T.salary} {n}: <strong style={{ minWidth: 62 }}>{num(sal[i])}</strong>
            <input type="range" min={20_000} max={90_000} step={1000} value={sal[i]} onChange={(e) => { setOne(i, Number(e.target.value)); clock.restart(); }} aria-label={`${T.salary} ${n}`} style={{ width: 150 }} />
          </label>
        ))}
      </div>
      <div className="ib-controls">
        <span className="ib-lbl">{T.view}</span>
        <span className="seg" role="group" aria-label={T.view}>
          {[...T.views, T.all].map((v, i) => <button key={v} type="button" aria-pressed={view === i} onClick={() => setView(i)}>{v}</button>)}
        </span>
      </div>
      <Key items={[{ color: ORIGIN[0], text: `${NAMES[0]}` }, { color: ORIGIN[1], text: `${NAMES[1]}` }, { color: ORIGIN[2], text: `${NAMES[2]}` }, { color: 'var(--line-strong)', text: T.key.a, faded: true }]} />
      <div className="viz-box">
        <svg viewBox="0 0 880 520" role="img" aria-label={T.title}>
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <PersonGlyph cx={CX[i]} cy={34} r={15} fill={ORIGIN[i]} />
              <text x={CX[i] + 34} y={42} className="ib-n" style={{ fontWeight: 700, fontSize: 18 }}>{NAMES[i]}</text>
              {/* the secret */}
              <rect x={CX[i] - 112} y={SY - 26} width={224} height={52} rx={10} fill="var(--surface)" stroke={ORIGIN[i]} strokeWidth={3} />
              <text x={CX[i] - 100} y={SY - 4} className="ib-s" style={{ fontSize: 13.5 }}>{T.secret}</text>
              <text x={CX[i] - 100} y={SY + 18} style={{ fontSize: 19, fontWeight: 700, fontFamily: 'var(--mono, monospace)', fill: 'var(--fg)' }}>{view === 3 || view === i ? num(sal[i]) : '???'}</text>
              {/* the tray of pieces the person holds */}
              <rect x={CX[i] - 112} y={TY - 8} width={224} height={76} rx={12} fill="var(--accent-soft)" stroke="var(--line-strong)" strokeWidth={2} strokeDasharray="6 5" />
              <text x={CX[i]} y={TY + 86} textAnchor="middle" className="ib-s" style={{ fontSize: 14 }}>{T.hand}</text>
              {/* the sum in hand */}
              <rect x={CX[i] - 112} y={TY + 112} width={224} height={52} rx={10} fill="var(--surface)" stroke="var(--line-strong)" strokeWidth={2} opacity={0.4 + 0.6 * potP} />
              <text x={CX[i] - 100} y={TY + 134} className="ib-s" style={{ fontSize: 13.5 }} opacity={potP}>{T.sum}</text>
              <text x={CX[i] - 100} y={TY + 156} style={{ fontSize: 19, fontWeight: 700, fontFamily: 'var(--mono, monospace)' }} opacity={potP}>{seen(i) || totP > 0.2 ? num(pots[i]) : T.unknown}</text>
            </g>
          ))}
          {/* the pieces */}
          {[0, 1, 2].flatMap((i) => [0, 1, 2].map((j) => {
            const c = chip(i, j);
            if (c.p <= 0) return null;
            const show = c.p < 1 ? view === 3 || view === i : seen(j);
            return (
              <g key={`${i}${j}`} opacity={Math.min(1, c.p * 3)}>
                <rect x={c.x - 33} y={c.y - 16} width={66} height={32} rx={8} fill="var(--surface)" stroke={ORIGIN[i]} strokeWidth={3} />
                <text x={c.x} y={c.y + 5} textAnchor="middle" style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--mono, monospace)' }}>{show ? num(c.v) : '?'}</text>
              </g>
            );
          }))}
          {/* the total */}
          <rect x={6} y={TY + 184} width={868} height={72} rx={12} className="ib-banner" opacity={0.4 + 0.6 * totP} />
          <text x={22} y={TY + 212} className="ib-n" style={{ fontSize: 16.5, fontWeight: 700 }} opacity={totP}>{`${T.board}:  ${num(pots[0])} + ${num(pots[1])} + ${num(pots[2])}  =  ${num(total)}  (mod ${num(M)})`}</text>
          <text x={22} y={TY + 241} className="ib-n" style={{ fontSize: 16.5, fontWeight: 700, fill: totP > 0.98 && total === mod(real) ? 'var(--accent)' : 'var(--fg)' }} opacity={totP}>{`${T.real}: ${num(real)}  mod ${num(M)} = ${num(mod(real))}  ${total === mod(real) ? `✓ ${T.same}` : '✗'}`}</text>
        </svg>
      </div>
      <ClockControls clock={clock} marks={T.marks(view)} lang={lang} />
      <p className="viz-caption" style={{ margin: '4px 0' }}>{view < 3 ? T.sees(view) : ''}</p>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
