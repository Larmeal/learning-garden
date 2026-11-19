import { ClockControls, useClock, type Lang, type Mark } from '../spark/timeline';
import { Banner } from '../iceberg/ib';
import { Legend, mix, prog } from './nw';
import data from './cidr.json';

// Shows:      the 32 bits of 10.0.1.2 and a boundary that slides from /8 to /30. Bits left of the boundary are the "network" part, bits right of it are the "host" part.
//             Under it, three destinations are compared with us bit by bit, and the first bit that differs inside the network part decides "send straight" or "send to the router".
// Because:    "a prefix length decides who is a neighbour" is a statement about where a boundary falls in a row of bits. A table of masks does not show why 10.0.2.2 is a
//             neighbour at /22 and a stranger at /23.
// Control:    play, the scrub bar and the jump buttons: they move the prefix length.
// Conclusion: the prefix length is the only thing that decides whether a destination is on our own network or behind the router, and each extra bit halves the network.
//
// The verdicts "direct" and "via router" for /8, /16, /22, /23, /24, /25, /26 and /30 are the kernel's own answers (ip route get) of exercises/02_ip_addresses.py (cidr.json);
// the picture checks the arithmetic against them and prints a tick when they agree. For the other prefix lengths the picture only does the arithmetic.

const D = 24;
const P0 = 8, P1 = 30;
const tOf = (p: number) => 1 + ((p - P0) / (P1 - P0)) * 20;
const MY = '10.0.1.2';
const DESTS = ['10.0.1.77', '10.0.2.2', '10.1.0.5'];

const bitsOf = (ip: string): number[] => ip.split('.').flatMap((o) => { const n = Number(o); return Array.from({ length: 8 }, (_, i) => (n >> (7 - i)) & 1); });
const num = (ip: string) => ip.split('.').reduce((a, o) => a * 256 + Number(o), 0);
const dotted = (n: number) => [24, 16, 8, 0].map((s) => Math.floor(n / 2 ** s) % 256).join('.');

type T = { title: string; caption: string; netPart: string; hostPart: string; me: string; direct: string; router: string; net: string; bc: string; hosts: string; kernelOk: string; arith: string; legendNet: string; legendSame: string; legendBad: string; marks: Mark[] };

const TEXT: Record<Lang, T> = {
  th: {
    title: 'กดเล่นแล้วดูเส้นแบ่ง Prefix เลื่อนจาก /8 ไป /30 ว่าทำให้ใครเป็นเพื่อนบ้านของ 10.0.1.2 บ้าง',
    caption: 'คำตอบ "ส่งตรง" กับ "ผ่าน Router" ของ Prefix /8, /16, /22, /23, /24, /25, /26 และ /30 เป็นคำตอบจริงของ Kernel (ip route get) จากแบบฝึก 02 ภาพนี้คำนวณซ้ำและขึ้นเครื่องหมายถูกเมื่อตรงกัน ส่วน Prefix อื่นเป็นการคำนวณอย่างเดียว',
    netPart: 'ส่วน Network', hostPart: 'ส่วน Host', me: 'เรา', direct: 'ส่งตรง', router: 'ผ่าน Router',
    net: 'Network Address', bc: 'Broadcast', hosts: 'Host ที่ใช้ได้', kernelOk: '✓ Kernel ตอบตรงกัน', arith: 'คำนวณจากบิต',
    legendNet: 'ส่วน Network ของเรา', legendSame: 'บิตตรงกับของเรา', legendBad: 'บิตแรกที่ต่าง (อยู่นอกเครือข่ายเรา)',
    marks: [
      { at: tOf(8), name: '/8', title: '/8 คือ 10.x.x.x ทั้งหมดเป็นเพื่อนบ้าน', text: '8 บิตแรกเป็นส่วน Network ที่เหลือ 24 บิตเป็น Host รวมกัน 16,777,214 ตัว ปลายทางสามตัวนี้ขึ้นต้นด้วย 10 เหมือนเรา ทุกตัวจึงถูกส่งตรง' },
      { at: tOf(16), name: '/16', title: '/16 ตัดออกไปหนึ่งตัว', text: '16 บิตแรกต้องตรงกัน 10.1.0.5 ต่างจากเราที่บิตของ Octet ที่สอง จึงไม่ใช่เพื่อนบ้านแล้ว ต้องผ่าน Router' },
      { at: tOf(22), name: '/22', title: '/22 ยังเก็บ 10.0.2.2 ไว้ในเครือข่าย', text: '/22 ครอบ 10.0.0.0 ถึง 10.0.3.255 (1,022 Host) 10.0.2.2 จึงเป็นเพื่อนบ้านที่ส่งตรงได้ แต่ถ้าขยับเป็น /23 มันจะหลุดไปทันที' },
      { at: tOf(24), name: '/24', title: '/24 คือที่เราใช้ในแบบฝึก', text: 'ส่วน Network ยาว 24 บิต มี Host ได้ 254 ตัว 10.0.1.77 เป็นเพื่อนบ้าน ส่วน 10.0.2.2 ต่างจากเราที่บิตท้ายสุดของ Octet ที่สาม จึงต้องผ่าน Router ซึ่งตรงกับที่เราเห็นใน ARP' },
      { at: tOf(26), name: '/26', title: '/26 เหลือ Host แค่ 62 ตัว', text: 'แม้ 10.0.1.77 จะอยู่ใน 10.0.1.x เหมือนเดิม แต่ /26 ตัดเครือข่ายออกเป็นก้อนละ 64 ตัว (10.0.1.0 ถึง 10.0.1.63 เป็นของเรา) 10.0.1.77 อยู่ก้อนถัดไป จึงต้องผ่าน Router' },
      { at: tOf(30), name: '/30', title: '/30 พอสำหรับสองปลายสาย', text: '/30 มี Host ได้แค่ 2 ตัว เหมาะกับสายที่เชื่อม Router สองตัว ทุกปลายทางในภาพต้องผ่าน Router หมด' },
    ],
  },
  en: {
    title: 'Press play and watch the prefix boundary slide from /8 to /30 to see who is a neighbour of 10.0.1.2',
    caption: 'The answers "direct" and "via router" for prefixes /8, /16, /22, /23, /24, /25, /26 and /30 are the kernel\'s own (ip route get) from exercise 02. The picture recomputes them and shows a tick when they agree. Other prefixes are arithmetic only.',
    netPart: 'network part', hostPart: 'host part', me: 'us', direct: 'direct', router: 'via router',
    net: 'Network address', bc: 'Broadcast', hosts: 'Usable hosts', kernelOk: '✓ the kernel agrees', arith: 'from the bits',
    legendNet: 'our network part', legendSame: 'bit equal to ours', legendBad: 'first bit that differs (outside our network)',
    marks: [
      { at: tOf(8), name: '/8', title: '/8 means all of 10.x.x.x is a neighbour', text: 'The first 8 bits are the network and the other 24 are the host, 16,777,214 hosts in all. All three destinations start with 10 like us, so all are sent directly.' },
      { at: tOf(16), name: '/16', title: '/16 drops one destination', text: 'The first 16 bits must match. 10.1.0.5 differs from us in the second octet, so it is no longer a neighbour and goes through the router.' },
      { at: tOf(22), name: '/22', title: '/22 still keeps 10.0.2.2 inside', text: '/22 covers 10.0.0.0 to 10.0.3.255 (1,022 hosts), so 10.0.2.2 is a neighbour that can be reached directly. At /23 it would fall out at once.' },
      { at: tOf(24), name: '/24', title: '/24 is what the exercise uses', text: 'The network part is 24 bits and holds 254 hosts. 10.0.1.77 is a neighbour, while 10.0.2.2 differs in the last bit of the third octet, so it goes through the router, which matches the ARP we saw.' },
      { at: tOf(26), name: '/26', title: '/26 leaves only 62 hosts', text: 'Even though 10.0.1.77 is still inside 10.0.1.x, /26 cuts the network into blocks of 64 (10.0.1.0 to 10.0.1.63 is ours). 10.0.1.77 is in the next block, so it goes through the router.' },
      { at: tOf(30), name: '/30', title: '/30 is enough for the two ends of a cable', text: '/30 holds only 2 hosts, the size of a link between two routers. Every destination in the picture now goes through the router.' },
    ],
  },
};

export default function CidrLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const clock = useClock(D);
  const { t } = clock;
  const p = Math.round(mix(P0, P1, prog(t, 1, 21)));
  const mine = bitsOf(MY);
  const mask = p === 0 ? 0 : (0xffffffff << (32 - p)) >>> 0;
  const net = (num(MY) & mask) >>> 0;
  const bc = (net | (~mask >>> 0)) >>> 0;
  const hosts = 2 ** (32 - p) - 2;
  const kernel = (data.kernel as Record<string, Record<string, boolean>>)[String(p)];

  const X0 = 14, PITCH = 21, OCT = 10;
  const cx = (i: number) => X0 + i * PITCH + Math.floor(i / 8) * OCT;
  const bx = cx(p) - 2 - (p % 8 === 0 && p > 0 ? OCT / 2 - 1 : 0);
  const Row = ({ y, bits, ref }: { y: number; bits: number[]; ref?: number[] }) => (
    <g>
      {bits.map((b, i) => {
        let cls = 'nw-cell';
        if (!ref) cls = i < p ? 'nw-cell on' : 'nw-cell';
        else if (i < p) {
          const firstBad = ref.findIndex((r, j) => r !== bits[j]);
          cls = firstBad !== -1 && i >= firstBad ? (i === firstBad ? 'nw-cell bad' : 'nw-cell') : 'nw-cell ok';
        }
        return (
          <g key={i} style={{ opacity: ref && i >= p ? 0.45 : 1 }}>
            <rect className={cls} x={cx(i)} y={y} width={PITCH - 2} height={28} rx={4} />
            <text x={cx(i) + (PITCH - 2) / 2} y={y + 20} textAnchor="middle" className="ib-m" style={{ fill: 'var(--fg)', fontWeight: 700, fontSize: 16 }}>{b}</text>
          </g>
        );
      })}
    </g>
  );

  let current = 0;
  T.marks.forEach((m, i) => { if (t >= m.at - 0.001) current = i; });

  return (
    <figure className="viz lg ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend layers={[]} lang={lang} extra={[{ cls: 'chg', text: T.legendNet }, { cls: 'same', text: T.legendSame }, { cls: 'bad', text: T.legendBad }]} />
      <div className="viz-box">
        <svg viewBox="0 0 880 546" role="img" aria-label={T.title}>
          <text x={X0} y={26} className="ib-layer">{T.netPart} ({p} bit)</text>
          <text x={cx(Math.min(p, 31))} y={26} className="ib-layer" style={{ opacity: p < 26 ? 1 : 0 }}>{T.hostPart} ({32 - p} bit)</text>
          <Row y={38} bits={mine} />
          <text x={730} y={58} className="ib-n">{MY}/{p}</text>
          <text x={730} y={78} className="ib-s">{T.me}</text>
          {DESTS.map((d, k) => {
            const y = 98 + k * 42;
            const db = bitsOf(d);
            const inside = db.slice(0, p).every((b, i) => b === mine[i]);
            const ok = kernel ? kernel[d] === inside : undefined;
            return (
              <g key={d}>
                <Row y={y} bits={db} ref={mine} />
                <text x={730} y={y + 18} className="ib-n">{d}</text>
                <text x={730} y={y + 38} className="ib-n" style={{ fill: inside ? 'var(--k2)' : 'var(--ib-bad)' }}>{inside ? T.direct : T.router}{ok ? ' ✓' : ''}</text>
              </g>
            );
          })}
          <path d={`M${bx},30 L${bx},${98 + 3 * 42 - 14}`} className="ib-arrow" style={{ strokeDasharray: '7 5', strokeWidth: 3 }} />
          {(() => {
            const inside = DESTS.filter((d) => bitsOf(d).slice(0, p).every((b, i) => b === mine[i]));
            const outside = DESTS.filter((d) => !inside.includes(d));
            const chip = (x: number, y: number, label: string, sub: string | null, tone: string) => (
              <g key={label + x}>
                <rect className={`nw-cell ${tone}`} x={x} y={y} width={190} height={44} rx={10} />
                <text x={x + 12} y={y + 20} className="ib-n">{label}</text>
                {sub && <text x={x + 12} y={y + 38} className="ib-s">{sub}</text>}
              </g>
            );
            return (
              <g>
                <rect className="ib-zone-solid" x={14} y={246} width={420} height={142} rx={14} />
                <rect className="ib-zone-dash" x={446} y={246} width={420} height={142} rx={14} />
                <text x={28} y={270} className="ib-n" style={{ fill: 'var(--brand)' }}>{T.direct} ({lang === 'th' ? 'สายเดียวกัน' : 'same cable'})</text>
                <text x={460} y={270} className="ib-n" style={{ fill: 'var(--ib-bad)' }}>{T.router}</text>
                {chip(28, 284, MY, T.me, 'on')}
                {inside.map((d, i) => chip(28 + ((i + 1) % 2) * 200, 284 + Math.floor((i + 1) / 2) * 50, d, null, 'ok'))}
                {outside.map((d, i) => chip(460 + (i % 2) * 200, 284 + Math.floor(i / 2) * 50, d, null, 'bad'))}
              </g>
            );
          })()}
          <g>
            {[
              [T.net, dotted(net), 14],
              [T.bc, dotted(bc), 304],
              [T.hosts, hosts.toLocaleString('en-US'), 594],
            ].map(([label, value, x]) => (
              <g key={String(label)}>
                <rect className="nw-cell" x={Number(x)} y={402} width={272} height={72} rx={12} />
                <text x={Number(x) + 14} y={426} className="ib-s">{label}</text>
                <text x={Number(x) + 14} y={460} className="ib-n" style={{ fontSize: 26 }}>{value}</text>
              </g>
            ))}
          </g>
          <Banner y={488} text={`${T.marks[current].title}${kernel ? `  ·  ${T.kernelOk}` : `  ·  ${T.arith}`}`} />
        </svg>
      </div>
      <ClockControls clock={clock} marks={T.marks} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
