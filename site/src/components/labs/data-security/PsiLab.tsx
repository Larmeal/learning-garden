import { StepControls, useStepper, type Lang } from '../spark/stepper';
import { Key } from './ds';
import data from './securecomp.json';

// Shows:      two companies that want to know which customers they share without handing over their lists. Every customer is a box. Each company puts its own padlock on boxes and sends them on,
//             and a box that has both padlocks on it looks the same whichever company locked it first. After four steps A holds two piles of doubly locked boxes, and the boxes with the same
//             number are the customers both have.
// Because:    "match without revealing" is a trick of algebra (raising to a power commutes) that is easier to believe as two padlocks that can go on in either order.
// Control:    the step player (Next, or Autoplay). Each step moves boxes from one company to the other and adds a padlock.
// Conclusion: a customer in both lists ends up as the same number in both piles. A customer in only one list gives a number the other side cannot read.
//
// The small example (p = 1019, keys 3 and 7, four hash values) is computed by exercises/09_secure_computation.py --write (securecomp.json). The same exercise runs it with a 127 bit prime on 300
// e-mails each, 120 in common, and checks that the intersection is exact. The padlock is the picture for "raise to my secret power": the numbers under the boxes are the real values.

const P = data.psi;
const A_NAMES = P.A as string[], B_NAMES = P.B as string[];
const S1 = P.step1 as Record<string, number>, S2 = P.step2 as Record<string, number>, S3 = P.step3 as Record<string, number>, S4 = P.step4 as Record<string, number>;
const LA = 'var(--k1)', LB = 'var(--k2)';

const TEXT: Record<Lang, {
  title: string; a: string; b: string; own: string; secret: string; steps: { name: string; title: string; text: string }[]; move: string[]; boxesA: string; boxesB: string; hidden: string;
  match: string; common: string; key: { a: string; b: string }; caption: string; unreadable: string;
}> = {
  th: {
    title: 'กดถัดไปทีละขั้น ดูว่าสองบริษัทใส่กุญแจให้กล่องลูกค้าอย่างไร แล้วรู้ว่ามีลูกค้าร่วมกันกี่คนโดยไม่เปิดรายชื่อ',
    a: 'บริษัท A', b: 'บริษัท B', own: 'รายชื่อลูกค้า (ลับ)', secret: 'กุญแจลับ = เลข', unreadable: 'อ่านไม่ออก',
    steps: [
      { name: 'A ใส่กุญแจ', title: '1. A ใส่กุญแจของตัวเองให้กล่องลูกค้าทุกใบ แล้วส่งให้ B', text: 'B ได้กล่องที่ล็อกด้วยกุญแจของ A และเห็นแค่ตัวเลขใต้กล่อง B เปิดไม่ได้ จึงไม่รู้ว่าข้างในคือใคร' },
      { name: 'B ใส่ซ้ำ', title: '2. B ใส่กุญแจของตัวเองเพิ่ม แล้วส่งกลับให้ A', text: 'ตอนนี้กล่องของ A มีสองกุญแจ (ของ A และของ B) A รู้ว่ากล่องไหนคือลูกค้าคนไหนเพราะส่งไปตามลำดับเดิม' },
      { name: 'B ส่งของตัวเอง', title: '3. B ใส่กุญแจของตัวเองให้ลูกค้าของ B แล้วส่งให้ A', text: 'A ได้กล่องล็อกด้วยกุญแจของ B ที่ A เปิดไม่ได้ และเห็นแค่ตัวเลข' },
      { name: 'A ใส่ซ้ำ แล้วเทียบ', title: '4. A ใส่กุญแจของตัวเองให้กล่องของ B แล้วเทียบเลขกับกล่องที่ได้ในขั้นที่ 2', text: 'กุญแจสองดอกใส่สลับลำดับกันก็ได้กล่องหน้าตาเดียวกัน (เลขเท่ากัน) กล่องที่เลขเท่ากันคือลูกค้าที่ทั้งสองบริษัทมี กล่องที่ไม่มีคู่ A อ่านไม่ออก' },
    ],
    move: ['A ส่งให้ B', 'B ส่งกลับให้ A', 'B ส่งให้ A', ''], boxesA: 'กล่องของ A ที่มีกุญแจสองดอก', boxesB: 'กล่องของ B ที่มีกุญแจสองดอก', hidden: '?', match: 'เลขเท่ากัน คือลูกค้าร่วม', common: 'ลูกค้าที่ทั้งสองบริษัทมี',
    key: { a: 'กุญแจของ A', b: 'กุญแจของ B' },
    caption: 'ตัวอย่างเล็ก (p เท่ากับ 1019, กุญแจลับ 3 กับ 7) คำนวณในแบบฝึก 09 ซึ่งทำจริงด้วยจำนวนเฉพาะ 127 บิตกับอีเมล 300 รายการต่อฝั่ง ได้ลูกค้าร่วม 120 คนพอดี และทั้งสองฝั่งรู้ขนาดรายชื่อของอีกฝั่งกับขนาดส่วนที่ตรงกัน กุญแจในภาพคือภาพแทนของ "ยกกำลังด้วยเลขลับของตัวเอง" ตัวเลขใต้กล่องเป็นค่าจริง',
  },
  en: {
    title: 'Press Next one step at a time, and see how two companies put padlocks on customer boxes and learn how many customers they share without opening the lists',
    a: 'Company A', b: 'Company B', own: 'customer list (secret)', secret: 'secret key = number', unreadable: 'unreadable',
    steps: [
      { name: 'A locks', title: '1. A puts its own padlock on every customer box and sends them to B', text: 'B gets boxes locked with the padlock of A and sees only the number under each box. It cannot open them, so it does not know who is inside.' },
      { name: 'B locks again', title: '2. B puts its own padlock on top and sends them back to A', text: 'The boxes of A now carry two padlocks (A\'s and B\'s). A knows which box is which customer because they come back in the order it sent them.' },
      { name: 'B sends its own', title: '3. B puts its padlock on its own customers and sends them to A', text: 'A gets boxes locked with B\'s padlock, which A cannot open, and sees only a number.' },
      { name: 'A locks, compares', title: '4. A puts its padlock on B\'s boxes and compares the numbers with the boxes from step 2', text: 'Two padlocks put on in either order give the same box (the same number). Boxes with equal numbers are customers that both companies have. A box without a partner is unreadable to A.' },
    ],
    move: ['A sends to B', 'B sends back to A', 'B sends to A', ''], boxesA: 'A\'s boxes, with two padlocks', boxesB: 'B\'s boxes, with two padlocks', hidden: '?', match: 'equal numbers: a shared customer', common: 'customers both companies have',
    key: { a: 'padlock of A', b: 'padlock of B' },
    caption: 'A small example (p is 1019, secret keys 3 and 7) computed in exercise 09, which does it for real with a 127 bit prime and 300 e-mails on each side, finds exactly the 120 customers in common, and shows that each side learns the size of the other\'s list and of the overlap. The padlock stands for "raise to my own secret power". The numbers under the boxes are the real values.',
  },
};

function Padlock({ x, y, color, s = 1 }: { x: number; y: number; color: string; s?: number }) {
  return (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      <path d="M -7 -4 V -11 A 7 7 0 0 1 7 -11 V -4" fill="none" stroke={color} strokeWidth={3} />
      <rect x={-10} y={-4} width={20} height={15} rx={3} fill={color} />
    </g>
  );
}

// a customer box: a label (a name or ?), the number under it, and its padlocks
function Box({ x, y, label, num, locks, mark, w = 124 }: { x: number; y: number; label: string; num?: number; locks: string[]; mark?: boolean; w?: number }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={52} rx={10} fill={mark ? 'color-mix(in srgb, var(--accent) 14%, var(--surface))' : 'var(--surface)'} stroke={mark ? 'var(--accent)' : 'var(--line-strong)'} strokeWidth={mark ? 3.5 : 2} />
      <text x={x + 12} y={y + 22} className="ib-n" style={{ fontWeight: 700, fontSize: 16 }}>{label}</text>
      {num !== undefined ? <text x={x + 12} y={y + 43} style={{ fontFamily: 'var(--mono, monospace)', fontSize: 14.5, fill: 'var(--muted)' }}>{num}</text> : null}
      {locks.map((c, i) => <Padlock key={i} x={x + w - 20 - i * 26} y={y + 20} color={c} />)}
    </g>
  );
}

export default function PsiLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const { step, go, playing, toggle } = useStepper(4, 4200);
  const s = step;
  const shared = (P.common as string[]);
  const sentNums: number[] = s === 0 ? A_NAMES.map((n) => S1[n]) : s === 1 ? A_NAMES.map((n) => S2[n]) : s === 2 ? B_NAMES.map((n) => S3[n]) : [];
  const sentLocks = s === 0 ? [LA] : s === 1 ? [LA, LB] : [LB];
  const arrowRight = s === 0;
  const aTable = A_NAMES.map((n) => ({ n, v: S2[n] }));
  const bTable = B_NAMES.map((n) => ({ n, v: S4[n] }));
  const aSet = new Set(aTable.map((r) => r.v));
  const bSet = new Set(bTable.map((r) => r.v));
  return (
    <figure className="viz ib-fig lg">
      <div className="viz-title">{T.title}</div>
      <Key items={[{ color: LA, text: T.key.a }, { color: LB, text: T.key.b }]} />
      <div className="viz-box">
        <svg viewBox="0 0 880 462" role="img" aria-label={T.title}>
          {/* the two companies and their secret lists */}
          {[['a', 8, A_NAMES, LA, P.ka], ['b', 448, B_NAMES, LB, P.kb]].map(([who, x0, names, col, k]) => (
            <g key={String(who)}>
              <rect x={Number(x0)} y={6} width={424} height={96} rx={14} fill="var(--surface)" stroke={String(col)} strokeWidth={3} />
              <text x={Number(x0) + 14} y={30} className="ib-n" style={{ fontWeight: 700, fontSize: 17 }}>{who === 'a' ? T.a : T.b}</text>
              <text x={Number(x0) + 410} y={30} textAnchor="end" className="ib-s" style={{ fontSize: 13.5 }}>{`${T.secret} ${k}`}</text>
              <text x={Number(x0) + 14} y={50} className="ib-s" style={{ fontSize: 13.5 }}>{T.own}</text>
              {(names as string[]).map((n, i) => (
                <g key={n}>
                  <rect x={Number(x0) + 14 + i * 132} y={58} width={120} height={34} rx={17} fill="var(--accent-soft)" stroke="var(--line-strong)" strokeWidth={1.5} />
                  <text x={Number(x0) + 14 + i * 132 + 60} y={81} textAnchor="middle" style={{ fontSize: 16, fontWeight: 700 }}>{n}</text>
                </g>
              ))}
            </g>
          ))}
          {/* the shipment */}
          {s < 3 ? (
            <g>
              <rect x={8} y={122} width={864} height={118} rx={14} fill="var(--surface)" stroke="var(--line)" strokeWidth={1.5} strokeDasharray="6 5" />
              <text x={440} y={146} textAnchor="middle" className="ib-n" style={{ fontWeight: 700, fontSize: 17, fill: 'var(--accent)' }}>{arrowRight ? '' : '← '}{T.move[s]}{arrowRight ? ' →' : ''}</text>
              {sentNums.map((v, i) => <Box key={i} x={152 + i * 200} y={168} label={T.hidden} num={v} locks={sentLocks} w={150} />)}
            </g>
          ) : (
            <g>
              <rect x={8} y={122} width={864} height={118} rx={14} fill="var(--surface)" stroke="var(--line)" strokeWidth={1.5} strokeDasharray="6 5" />
              <text x={440} y={156} textAnchor="middle" className="ib-n" style={{ fontWeight: 700, fontSize: 17 }}>{T.steps[3].title.replace(/^4\.\s*/, '')}</text>
            </g>
          )}
          {/* what A holds */}
          {s >= 1 ? (
            <g>
              <text x={14} y={274} className="ib-n" style={{ fontWeight: 700, fontSize: 16 }}>{T.boxesA}</text>
              {aTable.map((r, i) => <Box key={r.n} x={14 + i * 140} y={286} label={r.n} num={r.v} locks={[LA, LB]} mark={s === 3 && bSet.has(r.v)} w={128} />)}
            </g>
          ) : null}
          {s >= 3 ? (
            <g>
              <text x={448} y={274} className="ib-n" style={{ fontWeight: 700, fontSize: 16 }}>{T.boxesB}</text>
              {bTable.map((r, i) => <Box key={r.n} x={448 + i * 140} y={286} label={aSet.has(r.v) ? r.n : T.hidden} num={r.v} locks={[LB, LA]} mark={aSet.has(r.v)} w={128} />)}
            </g>
          ) : null}
          {/* the answer */}
          {s === 3 ? (
            <g>
              <rect x={8} y={364} width={864} height={80} rx={12} className="ib-banner" />
              <text x={22} y={394} className="ib-n" style={{ fontWeight: 700, fontSize: 17, fill: 'var(--accent)' }}>{`✓ ${T.common}: ${shared.join(', ')}`}</text>
              <text x={22} y={424} className="ib-n" style={{ fontSize: 15 }}>{shared.map((n) => `${n}: ${S2[n]} = ${S4[n]}`).join('    ·    ')}    ·    {T.match}</text>
            </g>
          ) : null}
        </svg>
      </div>
      <StepControls steps={T.steps} step={step} playing={playing} go={go} toggle={toggle} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
