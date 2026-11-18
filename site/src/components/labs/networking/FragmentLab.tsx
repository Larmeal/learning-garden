import { ClockControls, useClock, type Lang, type Mark } from '../spark/timeline';
import { Banner } from '../iceberg/ib';
import { Legend, ease, mix } from './nw';
import data from './routing.json';

// Shows:      one ping with 3000 bytes of data (3008 with the ICMP header) as a bar of bytes. At the client it is cut into pieces that fit an MTU of 1500, and one router
//             later every piece is cut again to fit an MTU of 1400. The pieces keep their position (offset) in the original bar, and the receiver puts them back together.
// Because:    fragmentation is about where each piece sits in the original data, and that two cuts happen at two different places. A table of offsets does not show that
//             the second cut falls inside the first pieces.
// Control:    play, the scrub bar and the jump buttons (the clock).
// Conclusion: any router on the way may cut a packet again, only the receiver puts the pieces together, and the offset in each piece says where it belongs.
//
// The pieces on the first link (1480, 1480 and 48 bytes) and on the last link (1376, 104, 1376, 104 and 48 bytes) are the real fragments captured in exercises/04_ip_routing.py.

const D = 22;
const TOTAL = 3008;
const X0 = 40;
const SCALE = 800 / TOTAL;
const ROW = { orig: 96, l1: 176, l2: 272, back: 368 };
const COLORS = ['k1', 'k2', 'k3', 'app'] as const;

type T = { title: string; caption: string; orig: string; l1: string; l2: string; back: string; offset: string; bytes: string; legendPiece: string; marks: Mark[]; banner: string[] };
const TEXT: Record<Lang, T> = {
  th: {
    title: 'กดเล่นแล้วดูข้อมูล 3008 ไบต์ถูกตัดสองรอบ รอบแรกที่ Client (MTU 1500) รอบสองที่ Router ตัวที่สาม (MTU 1400) แล้วต่อกลับที่ปลายทาง',
    caption: 'ชิ้นส่วนบนสายแรก (1480, 1480 และ 48 ไบต์) และสายสุดท้าย (1376, 104, 1376, 104 และ 48 ไบต์) เป็น Fragment ที่จับได้จริงในแบบฝึก 04 ความกว้างของแท่งเป็นสัดส่วนกับจำนวนไบต์',
    orig: 'ข้อมูลเดิม (ICMP 8 + ข้อมูล 3000)', l1: 'บนสายแรก MTU 1500', l2: 'บนสายสุดท้าย MTU 1400', back: 'ที่ปลายทาง', offset: 'ตำแหน่ง', bytes: 'ไบต์', legendPiece: 'ชิ้นที่ตัดมาจากข้อมูลก้อนเดียวกัน (IP ID เดียวกัน)',
    banner: ['ข้อมูลก้อนเดียว 3008 ไบต์ใหญ่เกินกว่าจะใส่ใน Packet เดียว', 'Client ตัดเป็น 3 ชิ้นให้พอดี MTU 1500 (ชิ้นละไม่เกิน 1480 ไบต์ข้อมูล)', 'Router ตัวที่สามเจอสายที่ MTU 1400 จึงตัดแต่ละชิ้นอีกครั้ง', 'ปลายทางรวมทุกชิ้นกลับเป็นก้อนเดิมตามตำแหน่ง'],
    marks: [
      { at: 0, name: 'ข้อมูลเดิม', title: 'ข้อมูลก้อนเดียว', text: 'Ping ขนาด 3000 ไบต์ บวก Header ของ ICMP อีก 8 ไบต์ เป็นข้อมูลก้อนเดียวยาว 3008 ไบต์ ซึ่งใหญ่เกินกว่า MTU ของทุกสายที่ผ่าน' },
      { at: 5, name: 'ตัดรอบแรก', title: 'ตัดที่ Client เป็น 3 ชิ้น', text: 'Client ตัดให้ชิ้นละไม่เกิน 1480 ไบต์ เพราะ MTU 1500 หัก IP Header 20 ได้ 1480 (และต้องเป็นผลคูณของ 8) ได้ชิ้น 1480, 1480 และ 48 ไบต์ ทุกชิ้นใช้ IP ID เดียวกัน และบอกตำแหน่งของตัวเองด้วย Offset 0, 1480 และ 2960' },
      { at: 11, name: 'ตัดรอบสอง', title: 'Router ตัดซ้ำที่สายที่เล็กกว่า', text: 'สายสุดท้ายรับได้แค่ 1400 ไบต์ ข้อมูลต่อชิ้นได้ 1376 Router ตัวที่สามจึงตัดชิ้น 1480 ทั้งสองออกเป็น 1376 กับ 104 ชิ้นสุดท้าย 48 ผ่านไปได้เลย Offset ยังนับจากข้อมูลเดิม ไม่ได้เริ่มใหม่' },
      { at: 17, name: 'ต่อกลับ', title: 'ปลายทางรวมกลับ', text: 'ปลายทางเก็บทุกชิ้นที่ IP ID เดียวกัน เรียงตาม Offset จนครบ 3008 ไบต์ ชิ้นสุดท้ายเป็นชิ้นเดียวที่ไม่มีธง More Fragments ถ้าชิ้นไหนหาย ทั้งก้อนใช้ไม่ได้ ผู้รับต้องทิ้งทั้งหมด' },
    ],
  },
  en: {
    title: 'Press play and watch 3008 bytes of data get cut twice, first at the client (MTU 1500), then at the third router (MTU 1400), and put back together at the destination',
    caption: 'The pieces on the first link (1480, 1480 and 48 bytes) and on the last link (1376, 104, 1376, 104 and 48 bytes) are the real fragments captured in exercise 04. The width of a bar is proportional to its bytes.',
    orig: 'Original data (ICMP 8 + data 3000)', l1: 'On the first link, MTU 1500', l2: 'On the last link, MTU 1400', back: 'At the destination', offset: 'offset', bytes: 'bytes', legendPiece: 'pieces cut from the same data (same IP id)',
    banner: ['One block of 3008 bytes is too big for a single packet', 'The client cuts it into 3 pieces that fit an MTU of 1500 (at most 1480 bytes of data each)', 'The third router meets a link with an MTU of 1400 and cuts each piece again', 'The destination puts every piece back where it belongs'],
    marks: [
      { at: 0, name: 'Original', title: 'One block of data', text: 'A ping of 3000 bytes plus 8 bytes of ICMP header is one block of 3008 bytes, bigger than the MTU of every link it will cross.' },
      { at: 5, name: 'First cut', title: 'Cut into 3 pieces at the client', text: 'The client cuts it into pieces of at most 1480 bytes, because an MTU of 1500 minus the 20-byte IP header leaves 1480 (and it must be a multiple of 8). The pieces are 1480, 1480 and 48 bytes, all with the same IP id, and each says where it belongs with an offset of 0, 1480 and 2960.' },
      { at: 11, name: 'Second cut', title: 'A router cuts again for the smaller link', text: 'The last link takes only 1400 bytes, which leaves 1376 of data per piece. So the third router cuts both 1480-byte pieces into 1376 and 104 bytes, and the 48-byte piece goes through. The offsets still count from the original data, they do not start again.' },
      { at: 17, name: 'Put back', title: 'The destination reassembles', text: 'The destination keeps every piece with the same IP id and orders them by offset until it has all 3008 bytes. The last piece is the only one without the More Fragments flag. If one piece is lost, the whole block is useless and the receiver has to drop everything.' },
    ],
  },
};

const bar = (x: number, w: number, y: number, cls: string, label: string, sub?: string) => (
  <g key={`${x}-${y}`}>
    <rect className={cls} x={x} y={y} width={Math.max(2, w)} height={44} rx={6} style={{ stroke: 'var(--surface)', strokeWidth: 2 }} />
    {w > 46 && <text x={x + w / 2} y={y + 28} className="nw-txt">{label}</text>}
    {sub && w > 46 && <text x={x + 4} y={y + 64} className="ib-s" style={{ fontSize: 13 }}>{sub}</text>}
  </g>
);

export default function FragmentLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const clock = useClock(D);
  const { t } = clock;
  const f1 = data.frags1 as { off: number; data: number }[];
  const f2 = data.frags as { off: number; data: number }[];
  const cut1 = ease(t, 5, 8);
  const cut2 = ease(t, 11, 14);
  const join = ease(t, 17, 20);
  const stage = t < 5 ? 0 : t < 11 ? 1 : t < 17 ? 2 : 3;
  // The offset of the ICMP header takes 8 bytes of the first piece: pieces are drawn in data bytes of the original block, with the 20-byte IP headers left out.
  const sc = (n: number) => n * SCALE;
  const gap = (g: number, i: number) => i * 6 * g;
  const color = (k: number) => `nw-${COLORS[k % 4] === 'app' ? 'app' : COLORS[k % 4] === 'k1' ? 'l3' : COLORS[k % 4] === 'k2' ? 'l4' : 'l2'}`;
  // which first-link piece each last-link piece came from
  const parent = (off: number) => f1.findIndex((p) => off >= p.off && off < p.off + p.data);

  let current = 0;
  T.marks.forEach((m, i) => { if (t >= m.at - 0.001) current = i; });

  return (
    <figure className="viz lg ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend layers={[]} lang={lang} extra={[{ cls: 'l3', text: T.legendPiece }]} />
      <div className="viz-box">
        <svg viewBox="0 0 880 482" role="img" aria-label={T.title}>
          <text x={X0} y={ROW.orig - 14} className="ib-layer">{T.orig}</text>
          {bar(X0, sc(TOTAL) * (1 - join) + sc(TOTAL) * join, ROW.orig, 'nw-app', `${TOTAL} ${T.bytes}`)}
          <text x={X0} y={ROW.l1 - 14} className="ib-layer" style={{ opacity: cut1 }}>{T.l1}</text>
          {f1.map((p, i) => cut1 > 0.02 && (
            <g key={i} style={{ opacity: cut1 * (1 - join) }}>
              {bar(X0 + sc(p.off) + gap(cut1, i), sc(p.data), ROW.l1, color(i), `${p.data}`, `${T.offset} ${p.off}`)}
            </g>
          ))}
          <text x={X0} y={ROW.l2 - 14} className="ib-layer" style={{ opacity: cut2 }}>{T.l2}</text>
          {f2.map((p, i) => cut2 > 0.02 && (
            <g key={i} style={{ opacity: cut2 * (1 - join) }}>
              {bar(X0 + sc(p.off) + gap(cut2, i), sc(p.data), ROW.l2, color(parent(p.off)), `${p.data}`, `${T.offset} ${p.off}`)}
            </g>
          ))}
          <text x={X0} y={ROW.back - 14} className="ib-layer" style={{ opacity: join }}>{T.back}</text>
          {join > 0.02 && (
            <g style={{ opacity: join }}>
              {bar(X0, sc(TOTAL), ROW.back, 'nw-app', `${TOTAL} ${T.bytes}`)}
            </g>
          )}
          <Banner y={426} text={T.banner[stage]} />
        </svg>
      </div>
      <ClockControls clock={clock} marks={T.marks} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
