import { ClockControls, useClock, type Lang, type Mark } from '../spark/timeline';
import { ease, mix } from './gl';
import data from './labData.json';

// Shows:      the 20 versions of one file as loose objects (one bar each, the size git wrote), then git gc shrinks them into a pack: the newest
//             version stays whole and the others collapse to a few bytes each because they are stored as differences from another version.
// Because:    "git does not store twenty copies" is about sizes and about which version is the base of which. A table of 20 rows says it, a row of bars
//             that collapse at the same moment shows it, and the fan of lines shows that the newest is the base everyone leans on.
// Control:    play, scrub, speed and the jump buttons. Every moment changes the bars.
// Conclusion: after gc the pack keeps the newest version whole and stores the older ones as small deltas (chains of at most 2 here), so 20 versions
//             cost about as much as one.
//
// Sizes, depths and bases are the output of git verify-pack -v in exercises/16_lab_data.py (the same repository as exercise 12, same bytes: 16613 against 4838).

const D = data.pack;
const DURATION = 11;
const BASE_Y = 285;
const SCALE = 0.31;
const X = (i: number) => 58 + i * 39;
const fmt = (n: number) => n.toLocaleString('en-US');

const TEXT: Record<Lang, {
  title: string; legend: { kind: 'node' | 'new'; text: string }[]; bytes: string; loose: string; packed: string; whole: string; delta: string;
  fan1: string; fan2: string; total: (l: string, p: string) => string; marks: Mark[]; caption: string; ver: string;
}> = {
  th: {
    title: 'ไฟล์เดียว 20 เวอร์ชัน ก่อนและหลัง git gc กดเล่นแล้วดูว่าแต่ละแท่งหดเหลือเท่าไรเมื่ออยู่ใน Pack',
    legend: [{ kind: 'node', text: 'Object หลวม (ก่อน gc) ความสูงคือไบต์ที่ Git เขียนลงดิสก์' }, { kind: 'new', text: 'อยู่ใน Pack (หลัง gc)' }],
    bytes: 'ไบต์', loose: 'Object หลวม', packed: 'Pack', whole: 'เก็บทั้งก้อน', delta: 'เก็บเป็นส่วนต่าง',
    ver: 'เวอร์ชัน',
    fan1: 'V1 ถึง V17 เก็บเป็นส่วนต่างจาก V18', fan2: 'V18 กับ V19 เก็บเป็นส่วนต่างจาก V20 ซึ่งเก็บทั้งก้อน',
    total: (l, p) => `ทั้ง 60 Object (Commit, Tree, Blob อย่างละ 20): ไฟล์หลวม ${l} ไบต์ เหลือ Pack ไฟล์เดียว ${p} ไบต์`,
    marks: [
      { at: 0, name: 'ไฟล์หลวม', title: '20 เวอร์ชัน ก็คือ 20 Object ที่หลวมอยู่', text: 'ทุกครั้งที่ Commit Git เขียน Blob ของไฟล์ลงเป็นไฟล์หนึ่ง บีบอัดด้วย zlib แล้วแต่ละเวอร์ชันยังอยู่ที่ราว 600 ถึง 670 ไบต์ ทั้งที่ไฟล์จริงยาวกว่า 13,000 ไบต์' },
      { at: 3.3, name: 'git gc', title: 'สั่ง git gc รวมทั้งหมดเป็น Pack', text: 'Git จับเวอร์ชันที่หน้าตาคล้ายกันมาเทียบ แล้วเก็บเวอร์ชันเก่าเป็นส่วนต่างจากเวอร์ชันอื่นแทนที่จะเก็บทั้งก้อน แท่งส่วนใหญ่จึงหดเหลือแค่ 23 ถึง 41 ไบต์' },
      { at: 6.4, name: 'ใครเป็นฐาน', title: 'ส่วนต่างต้องมีฐานให้เทียบ', text: 'V20 ซึ่งเป็นเวอร์ชันใหม่สุดถูกเก็บทั้งก้อน V18 กับ V19 เป็นส่วนต่างจาก V20 และ V1 ถึง V17 เป็นส่วนต่างจาก V18 สายโซ่ที่ยาวที่สุดมี 2 ข้อ (ผู้เขียนเดาว่า Git เก็บเวอร์ชันใหม่ไว้ทั้งก้อนเพราะเป็นเวอร์ชันที่เราอ่านบ่อยที่สุด)' },
      { at: 9.0, name: 'ผลรวม', title: 'ผลของทั้งหมด', text: 'ตัวเลขข้างล่างคือผลของทั้ง 60 Object ก่อนและหลัง gc Pack เล็กกว่าหนึ่งในสามของไฟล์หลวมทั้งหมด' },
    ],
    caption: 'ขนาดของแต่ละแท่งเป็นผลของ git verify-pack -v ในแบบฝึก 16 (Repository เดียวกับแบบฝึก 12 ผลเท่ากันทุกไบต์) แท่งของ V1 ถึง V19 ในรูปแบบ Pack คือขนาดที่ Pack ใช้เก็บเวอร์ชันนั้น ซึ่งเป็นส่วนต่าง ไม่ใช่ไฟล์เต็ม',
  },
  en: {
    title: 'One file, 20 versions, before and after git gc. Press play and watch how small each bar becomes inside a pack',
    legend: [{ kind: 'node', text: 'a loose object (before gc): the height is the bytes git wrote to disk' }, { kind: 'new', text: 'inside the pack (after gc)' }],
    bytes: 'bytes', loose: 'loose objects', packed: 'pack', whole: 'stored whole', delta: 'stored as a difference',
    ver: 'version',
    fan1: 'V1 to V17 are stored as differences from V18', fan2: 'V18 and V19 are stored as differences from V20, which is stored whole',
    total: (l, p) => `All 60 objects (20 commits, 20 trees, 20 blobs): ${l} bytes loose become one pack of ${p} bytes`,
    marks: [
      { at: 0, name: 'loose', title: '20 versions are 20 loose objects', text: 'At every commit Git writes the blob of the file as one file, compressed with zlib. Each version is still about 600 to 670 bytes, although the real file is more than 13,000 bytes long.' },
      { at: 3.3, name: 'git gc', title: 'git gc packs everything', text: 'Git compares versions that look alike and stores the older ones as a difference from another version instead of whole. Most bars shrink to just 23 to 41 bytes.' },
      { at: 6.4, name: 'who is the base', title: 'A difference needs a base', text: 'V20, the newest, is stored whole. V18 and V19 are differences from V20, and V1 to V17 are differences from V18. The longest chain is 2 links long (the author guesses Git keeps the newest whole because it is the one we read most).' },
      { at: 9.0, name: 'total', title: 'The whole result', text: 'The numbers below are for all 60 objects before and after gc. The pack is smaller than a third of the loose files.' },
    ],
    caption: 'Every bar is the output of git verify-pack -v in exercise 16 (the same repository as exercise 12, the same bytes). The pack bars of V1 to V19 show the size the pack uses for that version, which is a difference and not the full file.',
  },
};

export default function PackLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const clock = useClock(DURATION);
  const { t } = clock;
  const squeeze = ease(t, 3.4, 5.2);
  const fan = ease(t, 6.4, 8.2);
  const total = ease(t, 9.0, 9.8);
  const blobs = D.blobs;
  const xOf = (v: number) => X(v - 1);
  const topOf = (h: number) => BASE_Y - h;
  const fanTo = (to: number) => ({ x: xOf(to), y: BASE_Y + 56 });
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <div className="ib-legend" aria-label="legend">
        <span><i />{T.legend[0].text}</span>
        <span><i className="new" />{T.legend[1].text}</span>
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 472" role="img" aria-label={T.title}>
          <line x1={30} y1={BASE_Y} x2={850} y2={BASE_Y} className="ib-line" />
          <text x={30} y={34} className="ib-s">{`${T.bytes}: ${T.loose} → ${T.packed}`}</text>
          {blobs.map((b, i) => {
            const grow = ease(t, 0.3 + i * 0.07, 1.4 + i * 0.07);
            const loose = b.loose * SCALE;
            const packed = Math.max(6, b.in_pack * SCALE);
            const h = mix(loose, packed, squeeze) * grow;
            const isPack = squeeze > 0.5;
            return (
              <g key={b.version}>
                <rect className={isPack ? 'ib-new' : 'ib-node'} x={xOf(b.version) - 13} y={topOf(h)} width={26} height={h} rx={4} />
                <text x={xOf(b.version)} y={BASE_Y + 20} textAnchor="middle" className="ib-s">{`V${b.version}`}</text>
                <text x={xOf(b.version)} y={topOf(h) - 7} textAnchor="middle" className="ib-m" style={{ fontSize: 12.5 }}>{fmt(Math.round(mix(b.loose, b.in_pack, squeeze)))}</text>
              </g>
            );
          })}
          {/* the fan of differences */}
          {blobs.filter((b) => b.depth > 0).map((b) => {
            const to = b.depth === 2 ? 18 : 20;
            const f = fanTo(to);
            return (
              <path key={b.version} className="ib-line" d={`M${xOf(b.version)},${BASE_Y + 34} L${mix(xOf(b.version), f.x, fan)},${mix(BASE_Y + 34, f.y, fan)}`} style={{ stroke: 'var(--accent)', strokeWidth: b.depth === 1 ? 2.5 : 1.5, opacity: 0.8 }} />
            );
          })}
          {fan > 0.6 && (
            <g style={{ opacity: ease(t, 7.4, 8.4) }}>
              <text x={xOf(18)} y={BASE_Y + 82} textAnchor="middle" className="ib-s">{T.fan1}</text>
              <text x={xOf(20)} y={BASE_Y + 104} textAnchor="end" className="ib-s">{T.fan2}</text>
            </g>
          )}
          <g style={{ opacity: total }}>
            <rect className="ib-banner" x={12} y={414} width={856} height={44} rx={10} />
            <text x={26} y={442} className="ib-n">{T.total(fmt(D.loose_total), fmt(D.pack_total))}</text>
          </g>
        </svg>
      </div>
      <ClockControls clock={clock} marks={T.marks} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
