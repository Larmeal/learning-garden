import { useMemo, useState, type ReactNode } from 'react';
import { ClockControls, mix, prog, smooth, useClock, type Lang, type Mark } from './timeline';

// Sort-merge join versus broadcast hash join drawn as moving rows. Three executors, a big table of 24 rows (circles)
// and a small table of 3 or 9 rows (squares), keys A, B and C. The picture counts how many rows cross the network.
// Source for the strategies: JoinSelection, BroadcastHashJoinExec, SortMergeJoinExec (Spark 4.2.0, lesson 7). The row
// counts are a toy: in real data the big table is millions of times larger than a dot, the point is how each
// strategy's cost grows.

type Mode = 'smj' | 'bhj';
const TEXT: Record<Lang, {
  smjStart: { name: string; title: string; text: string };
  smjShuffle: { name: string; title: string; text: (cross: number, total: number, big: number, small: number) => string };
  smjMerge: { name: string; title: string; text: string };
  bhjStart: { name: string; title: string; text: string };
  bhjDriver: { name: string; title: string; text: (n: number) => string };
  bhjBroadcast: { name: string; title: string; text: (n: number, ex: number) => string };
  bhjLocal: { name: string; title: string; text: string };
  title: string;
  strategyGroup: string;
  smallBtn: (n: number) => string;
  smallGroup: string;
  svgLabel: (mode: Mode) => string;
  bigLegend: string;
  smallLegend: string;
  driver: string;
  receives: (key: string) => string;
  bigTable: string;
  smallTable: string;
  crossing: (landed: number, total: number) => string;
  smjSummary: (big: number, small: number, total: number, bhj: number) => string;
  bhjSummary: (small: number, total: number, smj: number) => string;
  caption: ReactNode;
}> = {
  th: {
    smjStart: { name: 'ตั้งต้น', title: 'สองตารางกระจายอยู่บน 3 Executor', text: 'แถว Key เดียวกันของสองฝั่งอยู่คนละคอมพิวเตอร์ ซึ่งจะ Join กันได้ก็ต่อเมื่อมาอยู่คอมพิวเตอร์เครื่องเดียวกัน' },
    smjShuffle: { name: 'Shuffle ทั้งสองฝั่ง', title: 'ทุกแถวของทั้งสองตารางถูกส่งไปหา Executor ที่รับผิดชอบ Key นั้น', text: (cross, total, big, small) => `สองฝั่งใช้ Hash ของ Key แบบเดียวกัน จึงมาเจอกันได้ แถวที่ต้องข้ามคอมพิวเตอร์ในภาพมี ${cross} จาก ${total} แถว (ตารางใหญ่ ${big} + ตารางเล็ก ${small}) ส่วนของจริงคือข้อมูลหลายล้านแถวทั้งสองฝั่ง` },
    smjMerge: { name: 'Sort และ Merge', title: 'แต่ละคอมพิวเตอร์เรียงตาม Key แล้ว Merge', text: 'Sort-merge join จะเรียงทั้งสองฝั่งแล้วไล่จับคู่กัน จึงทำงานได้กับตารางขนาดใหญ่ทั้งคู่ เพราะไม่ต้องเก็บตารางไหนทั้งก้อนไว้ใน Memory (แต่ต้องจ่ายค่า Shuffle และ Sort)' },
    bhjStart: { name: 'ตั้งต้น', title: 'ตารางเล็กกระจายอยู่ ตารางใหญ่ก็กระจายอยู่', text: 'Broadcast hash join ไม่แตะตารางใหญ่เลย แถวของมันอยู่ที่เดิมตลอด' },
    bhjDriver: { name: 'รวมที่ Driver', title: 'ตารางเล็กถูกรวมไปที่ Driver ก่อน', text: (n) => `Executor ส่งแถวของตารางเล็กทั้งหมดไปที่ Driver (${n} แถวในภาพ) เพื่อสร้างเป็นก้อนเดียว` },
    bhjBroadcast: { name: 'Broadcast', title: 'ก้อนนั้นถูกส่งไปให้ทุก Executor', text: (n, ex) => `ทุกคอมพิวเตอร์ได้สำเนาครบทั้งตาราง จึงมีสำเนา ${n} x ${ex} = ${n * ex} ชุดเดินทางผ่านเครือข่าย ยิ่งตารางเล็กโตขึ้น ราคานี้ก็โตตามไปด้วย (และคอมพิวเตอร์ต้องมี Memory พอเก็บทั้งก้อน)` },
    bhjLocal: { name: 'Join ในคอมพิวเตอร์', title: 'แต่ละคอมพิวเตอร์ Join แถวของตัวเองกับสำเนาได้เลย', text: 'ไม่ต้อง Shuffle และไม่ต้อง Sort ตารางใหญ่ ถ้าตารางเล็กเล็กจริง ๆ นี่คือกลยุทธ์ที่ถูกที่สุด' },
    title: 'Join สองตารางต้องเอาแถว Key เดียวกันมาเจอกัน มีอยู่สองวิธี',
    strategyGroup: 'กลยุทธ์ Join',
    smallBtn: (n) => `ตารางเล็ก ${n} แถว`,
    smallGroup: 'ขนาดตารางเล็ก',
    svgLabel: (mode) => `ภาพเคลื่อนไหวของ ${mode === 'smj' ? 'sort-merge join' : 'broadcast hash join'}`,
    bigLegend: 'ตารางใหญ่ (orders)',
    smallLegend: 'ตารางเล็ก (customers)',
    driver: 'Driver',
    receives: (key) => `รับ Key ${key}`,
    bigTable: 'ตารางใหญ่',
    smallTable: 'ตารางเล็ก',
    crossing: (landed, total) => `แถวที่ข้ามคอมพิวเตอร์: ${landed} / ${total}`,
    smjSummary: (big, small, total, bhj) => `ตารางใหญ่ ${big} + ตารางเล็ก ${small} = ${total} ครั้ง (เทียบกับ Broadcast: ${bhj})`,
    bhjSummary: (small, total, smj) => `ตารางใหญ่ 0 (ไม่ขยับเลย) + สำเนาตารางเล็ก ${small} ครั้ง = ${total} (เทียบกับ Sort-merge: ${smj})`,
    caption: <>นี่คือภาพจำลองเล็ก ๆ ที่ช่วยให้เห็นว่าราคาของแต่ละวิธีโตตามอะไร ลองสลับตารางเล็กจาก 3 เป็น 9 แถวแล้วดูตัวเลข ส่วนตัวเลือกจริงของ Spark จะตัดสินจากขนาดที่ประมาณได้และค่า <code>autoBroadcastJoinThreshold</code> ถ้าอยากดูผลที่วัดจริง 80 กรณี ให้ดู JoinPickerLab ด้านล่าง</>,
  },
  en: {
    smjStart: { name: 'start', title: 'Two tables are spread over 3 executors', text: 'Rows with the same key from the two sides are on different machines. They can be joined only when they are on the same machine.' },
    smjShuffle: { name: 'shuffle both sides', title: 'Every row of both tables is sent to the executor in charge of its key', text: (cross, total, big, small) => `Both sides use the same hash of the key, so they meet. Rows that must cross machines in the picture: ${cross} of ${total} (big table ${big} + small table ${small}). In real life both sides are millions of rows.` },
    smjMerge: { name: 'sort and merge', title: 'Each machine sorts by key and then merges', text: 'Sort-merge join sorts both sides and walks through them in pairs. It works when both tables are large, because neither table has to fit in memory as a whole (but you pay for the shuffle and the sort).' },
    bhjStart: { name: 'start', title: 'The small table is spread out, and so is the big table', text: 'Broadcast hash join never touches the big table. Its rows stay where they are.' },
    bhjDriver: { name: 'collect at driver', title: 'The small table is first collected at the driver', text: (n) => `The executors send all rows of the small table to the driver (${n} rows in the picture) to build one block.` },
    bhjBroadcast: { name: 'broadcast', title: 'That block is sent to every executor', text: (n, ex) => `Every machine gets a copy of the whole table, so ${n} x ${ex} = ${n * ex} copies travel over the network. The bigger the small table, the bigger this cost (and each machine needs enough memory for the whole block).` },
    bhjLocal: { name: 'join locally', title: 'Each machine joins its own rows with the copy', text: 'No shuffle and no sort of the big table. If the small table is really small, this is the cheapest strategy.' },
    title: 'Joining two tables means bringing rows with the same key together: two ways',
    strategyGroup: 'Join strategy',
    smallBtn: (n) => `Small table ${n} rows`,
    smallGroup: 'Size of the small table',
    svgLabel: (mode) => `Animation of ${mode === 'smj' ? 'sort-merge join' : 'broadcast hash join'}`,
    bigLegend: 'big table (orders)',
    smallLegend: 'small table (customers)',
    driver: 'driver',
    receives: (key) => `gets key ${key}`,
    bigTable: 'big table',
    smallTable: 'small table',
    crossing: (landed, total) => `Rows crossing machines: ${landed} / ${total}`,
    smjSummary: (big, small, total, bhj) => `big table ${big} + small table ${small} = ${total} (compare broadcast: ${bhj})`,
    bhjSummary: (small, total, smj) => `big table 0 (does not move) + copies of the small table ${small} = ${total} (compare sort-merge: ${smj})`,
    caption: <>This is a small simulation to show what the cost of each way grows with. Switch the small table from 3 to 9 rows and watch the numbers. Spark's real choice depends on the estimated size and on <code>autoBroadcastJoinThreshold</code>. See JoinPickerLab below for 80 measured cases.</>,
  },
};

const KEYS = ['A', 'B', 'C'];
const EXEC = 3;
const BIG = 8; // big rows per executor
const DURATION = 9;
const EX_W = 272;
const exX = (e: number) => 22 + e * (EX_W + 8);
const BIG_Y = 150;
const SMALL_Y = 292;
const DRIVER: [number, number] = [440, 66];

interface Row {
  id: string;
  side: 'big' | 'small';
  key: number;
  from: number; // executor that holds the row at the start
  to: number; // executor that needs it
  slotFrom: number;
  slotTo: number;
  copy?: boolean;
}

function build(smallN: number): { rows: Row[]; slotsSmall: number[] } {
  const rows: Row[] = [];
  const toSlot = [0, 0, 0];
  for (let e = 0; e < EXEC; e++) {
    for (let i = 0; i < BIG; i++) {
      const key = (i * 2 + e + (i >> 1)) % 3;
      rows.push({ id: `b${e}-${i}`, side: 'big', key, from: e, to: key, slotFrom: i, slotTo: toSlot[key]++ });
    }
  }
  const smallTo = [0, 0, 0];
  const smallFrom = [0, 0, 0];
  for (let j = 0; j < smallN; j++) {
    const key = j % 3;
    const from = (key + 1 + Math.floor(j / 3)) % 3;
    rows.push({ id: `s${j}`, side: 'small', key, from, to: key, slotFrom: smallFrom[from]++, slotTo: smallTo[key]++ });
  }
  return { rows, slotsSmall: smallTo };
}

const bigPos = (e: number, slot: number): [number, number] => [exX(e) + 22 + (slot % 8) * 29, BIG_Y + Math.floor(slot / 8) * 26];
const smallPos = (e: number, slot: number): [number, number] => [exX(e) + 22 + (slot % 12) * 21, SMALL_Y + Math.floor(slot / 12) * 22];

function Mark1({ side, k }: { side: 'big' | 'small'; k: number }) {
  return side === 'big' ? (
    <>
      <circle r="9.5" className={`k${k + 1}`} />
      <text className="dl" y="4">{KEYS[k]}</text>
    </>
  ) : (
    <>
      <rect x="-8.5" y="-8.5" width="17" height="17" rx="3" className={`k${k + 1}`} />
      <text className="dl" y="4">{KEYS[k]}</text>
    </>
  );
}

export default function JoinFlowLab({ lang = 'th' }: { lang?: Lang }) {
  const L = TEXT[lang];
  const [mode, setMode] = useState<Mode>('smj');
  const [smallN, setSmallN] = useState(3);
  const clock = useClock(DURATION);
  const { t } = clock;
  const { rows } = useMemo(() => build(smallN), [smallN]);
  const restart = () => clock.restart();

  const bigRows = rows.filter((r) => r.side === 'big');
  const smallRows = rows.filter((r) => r.side === 'small');

  // movement windows
  const moveA = prog(t, 1.2, 3.6); // SMJ: shuffle both sides. BHJ: small rows to the driver
  const moveB = prog(t, 3.8, 6); // BHJ: copies to every executor
  const matchP = prog(t, mode === 'smj' ? 5 : 6.4, mode === 'smj' ? 6.6 : 8);

  const smjCross = rows.filter((r) => r.from !== r.to).length;
  const bhjCross = smallN + smallN * EXEC;
  const total = mode === 'smj' ? smjCross : bhjCross;
  const landed =
    mode === 'smj'
      ? rows.filter((r) => r.from !== r.to && moveA >= 0.999).length
      : Math.round(smallN * smooth(moveA)) + Math.round(smallN * EXEC * smooth(moveB));
  const bigCross = mode === 'smj' ? bigRows.filter((r) => r.from !== r.to).length : 0;
  const smallCross = total - bigCross;

  const marks: Mark[] = mode === 'smj'
    ? [
        { at: 0, ...L.smjStart },
        { at: 1.2, name: L.smjShuffle.name, title: L.smjShuffle.title, text: L.smjShuffle.text(smjCross, rows.length, bigCross, smjCross - bigCross) },
        { at: 4.6, ...L.smjMerge },
      ]
    : [
        { at: 0, ...L.bhjStart },
        { at: 1.2, name: L.bhjDriver.name, title: L.bhjDriver.title, text: L.bhjDriver.text(smallN) },
        { at: 3.8, name: L.bhjBroadcast.name, title: L.bhjBroadcast.title, text: L.bhjBroadcast.text(smallN, EXEC) },
        { at: 6.4, ...L.bhjLocal },
      ];

  return (
    <figure className="viz lg">
      <div className="viz-title">{L.title}</div>
      <div className="viz-steps" role="group" aria-label={L.strategyGroup}>
        <button type="button" aria-pressed={mode === 'smj'} onClick={() => { setMode('smj'); restart(); }}>Sort-merge join</button>
        <button type="button" aria-pressed={mode === 'bhj'} onClick={() => { setMode('bhj'); restart(); }}>Broadcast hash join</button>
      </div>
      <div className="viz-steps" role="group" aria-label={L.smallGroup}>
        <button type="button" aria-pressed={smallN === 3} onClick={() => { setSmallN(3); restart(); }}>{L.smallBtn(3)}</button>
        <button type="button" aria-pressed={smallN === 9} onClick={() => { setSmallN(9); restart(); }}>{L.smallBtn(9)}</button>
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 410" role="img" aria-label={L.svgLabel(mode)}>
          <rect className="band" x="10" y="10" width="860" height="390" rx="12" />
          <g transform="translate(28 30)">
            <circle r="7" className="k1" /><text className="s" x="14" y="4">{L.bigLegend}</text>
          </g>
          <g transform="translate(200 30)">
            <rect x="-7" y="-7" width="14" height="14" rx="3" className="k1" /><text className="s" x="14" y="4">{L.smallLegend}</text>
          </g>
          <text className="s m" x="440" y="34" textAnchor="middle">{mode === 'bhj' ? L.driver : ''}</text>
          {mode === 'bhj' && <rect className={moveA > 0 && moveB < 1 ? 'fx-hot' : 'box'} x={DRIVER[0] - 30} y={DRIVER[1] - 18} width="60" height="36" rx="8" />}

          {Array.from({ length: EXEC }, (_, e) => (
            <g key={e}>
              <rect className="box" x={exX(e)} y="96" width={EX_W} height="290" rx="10" />
              <text className="b" x={exX(e) + 12} y="116">executor {e + 1}</text>
              {mode === 'smj' && <text className="s" x={exX(e) + EX_W - 12} y="116" textAnchor="end">{L.receives(KEYS[e])}</text>}
              <text className="s" x={exX(e) + 12} y={BIG_Y + 62}>{L.bigTable}</text>
              <text className="s" x={exX(e) + 12} y={SMALL_Y - 22}>{L.smallTable}</text>
            </g>
          ))}

          {/* match lines */}
          {matchP > 0 &&
            bigRows.map((r) => {
              const e = mode === 'smj' ? r.to : r.from;
              const [bx, by] = bigPos(e, mode === 'smj' ? r.slotTo : r.slotFrom);
              const idx = smallRows.find((s) => s.key === r.key);
              if (!idx) return null;
              const [sx, sy] = smallPos(e, mode === 'smj' ? idx.slotTo : smallRows.indexOf(idx));
              return <line key={r.id} x1={bx} y1={by + 10} x2={sx} y2={sy - 9} className={`path s${r.key + 1}`} opacity={matchP * 0.35} strokeWidth="1.5" />;
            })}

          {/* big rows */}
          {bigRows.map((r) => {
            const a = mode === 'smj' ? smooth(moveA) : 0;
            const [x0, y0] = bigPos(r.from, r.slotFrom);
            const [x1, y1] = bigPos(r.to, r.slotTo);
            const x = mix(x0, x1, a);
            const y = mix(y0, y1, a);
            return (
              <g key={r.id} transform={`translate(${x} ${y})`}>
                <Mark1 side="big" k={r.key} />
                {matchP > 0.6 && <circle r="13" className="fx-ring" opacity={Math.min(1, (matchP - 0.6) * 3)} />}
              </g>
            );
          })}

          {/* small rows */}
          {mode === 'smj' &&
            smallRows.map((r) => {
              const a = smooth(moveA);
              const [x0, y0] = smallPos(r.from, r.slotFrom);
              const [x1, y1] = smallPos(r.to, r.slotTo);
              return (
                <g key={r.id} transform={`translate(${mix(x0, x1, a)} ${mix(y0, y1, a)})`}>
                  <Mark1 side="small" k={r.key} />
                </g>
              );
            })}
          {mode === 'bhj' && (
            <>
              {smallRows.map((r) => {
                const a = smooth(moveA);
                const [x0, y0] = smallPos(r.from, r.slotFrom);
                if (moveB > 0) return null;
                return (
                  <g key={r.id} transform={`translate(${mix(x0, DRIVER[0] + ((r.key - 1) * 16), a)} ${mix(y0, DRIVER[1], a)})`}>
                    <Mark1 side="small" k={r.key} />
                  </g>
                );
              })}
              {moveB > 0 &&
                smallRows.flatMap((r, j) =>
                  Array.from({ length: EXEC }, (_, e) => {
                    const a = smooth(prog(t, 3.8 + j * 0.05, 6 - (smallRows.length - j) * 0.02));
                    const [x1, y1] = smallPos(e, j);
                    return (
                      <g key={`${r.id}-${e}`} transform={`translate(${mix(DRIVER[0] + ((r.key - 1) * 16), x1, a)} ${mix(DRIVER[1], y1, a)})`}>
                        <Mark1 side="small" k={r.key} />
                      </g>
                    );
                  }),
                )}
            </>
          )}
        </svg>
      </div>
      <div className="viz-now" aria-live="off">
        <strong>{L.crossing(landed, total)}</strong>
        <span>
          {mode === 'smj' ? L.smjSummary(bigCross, smallCross, total, bhjCross) : L.bhjSummary(smallCross, total, smjCross)}
        </span>
      </div>
      <ClockControls clock={clock} marks={marks} lang={lang} />
      <figcaption className="viz-caption">{L.caption}</figcaption>
    </figure>
  );
}
