import { useState } from 'react';
import { ClockControls, mix, prog, smooth, useClock, type Lang, type Mark } from './timeline';

// Shows:      where the rows go when we call repartition(n), repartition(n, "key") or coalesce(n) on a table of 4 partitions
// Because:    the difference between the three is about movement and sizes (every row goes through a shuffle, or no row does;
//             balanced sizes, or sizes that follow the keys, or sizes that follow the old partitions), and a table of plans
//             cannot show that
// Control:    the command and n; each one changes where the dots land and whether an Exchange is drawn
// Conclusion: repartition shuffles everything and balances (or follows the key); coalesce shuffles nothing, only joins
//             neighbours, so it is cheaper but can be uneven, and it cannot add partitions
//
// Sources: the plans in the table of the lesson were read from explain() in exercises/07_performance_tuning.py. The coalesce
// grouping is read from CoalescedRDD.scala (Spark 4.2.0): without locality information, coalesce(n) cuts the list of the old
// partitions into n runs of neighbours, and it never returns more partitions than there were. For repartition the destination
// of every row is what Spark gave when it was run on this table (SPARK_PLACEMENT, asserted in exercise 07), because it is not
// "row r goes to r % n": ShuffleExchangeExec sorts the rows of each partition first (sortBeforeRepartition), then deals them
// one by one from a start position taken from the partition number, and repartition(n, "key") uses the hash of the key.

type Cmd = 'rr' | 'key' | 'co';
const KEYS = ['A', 'B', 'C'];
const TONE = ['var(--k1)', 'var(--k2)', 'var(--k3)'];
// 12 rows in 4 partitions of 5, 3, 1 and 3 rows; the letter is the value of the column used as the key
const INPUT: number[][] = [
  [0, 0, 1, 0, 2],
  [1, 2, 1],
  [0],
  [2, 1, 2],
];
const NS = [2, 3, 8];
const INPUT_N = INPUT.length;
const TOTAL = INPUT.reduce((a, p) => a + p.length, 0);

const IX = 40;
const IW = 260;
const OX = 600;
const OW = 240;
const TOP = 62;
const AREA = 316;
const STEP_AT = 0.14;
const START = 0.8;
const FLY = 0.9;

interface Plan {
  out: number; // number of output partitions
  shuffle: boolean;
  // for every row (in input order): input partition, slot in it, output partition, slot in it
  rows: { key: number; ip: number; is: number; op: number; os: number; order: number }[];
  sizes: number[];
}

// Where Spark 4.2.0 really put each of the 12 rows (in the order of INPUT) when this table was built as a DataFrame of
// (partition, slot, key) with the key as the string A, B, C, and df.repartition(n) / df.repartition(n, "key") ran on it
// (AQE off, local[4]). Same result in repeated runs: the round-robin start comes from the partition number, not from a
// fresh random number. Checked by exercises/07_performance_tuning.py (lab_placements), which asserts these lists.
const SPARK_PLACEMENT: Record<'rr' | 'key', Record<number, number[]>> = {
  rr: {
    2: [1, 1, 1, 0, 0, 1, 0, 1, 0, 1, 0, 0],
    3: [1, 2, 0, 0, 1, 0, 2, 1, 2, 1, 0, 2],
    8: [6, 4, 2, 5, 3, 4, 3, 2, 0, 7, 6, 0],
  },
  key: {
    2: [0, 0, 1, 0, 1, 1, 1, 1, 0, 1, 1, 1],
    3: [2, 2, 0, 2, 1, 0, 1, 0, 2, 1, 0, 1],
    8: [2, 2, 1, 2, 1, 1, 1, 1, 2, 1, 1, 1],
  },
};

function planOf(cmd: Cmd, n: number): Plan {
  let out = n;
  const to: number[] = [];
  const groupOf = (ip: number) => {
    // coalesce without locality: n runs of neighbours (CoalescedRDD)
    for (let j = 0; j < n; j++) if (ip >= Math.floor((j * INPUT_N) / n) && ip < Math.floor(((j + 1) * INPUT_N) / n)) return j;
    return ip;
  };
  if (cmd === 'co' && n >= INPUT_N) out = INPUT_N;
  INPUT.forEach((part, ip) =>
    part.forEach(() => {
      if (cmd === 'co') to.push(n >= INPUT_N ? ip : groupOf(ip));
    }),
  );
  if (cmd !== 'co') to.push(...SPARK_PLACEMENT[cmd][n]);
  const fill = Array(out).fill(0);
  const rows: Plan['rows'] = [];
  let r = 0;
  INPUT.forEach((part, ip) =>
    part.forEach((key, is) => {
      const op = to[r];
      rows.push({ key, ip, is, op, os: fill[op]++, order: r });
      r++;
    }),
  );
  return { out, shuffle: cmd !== 'co', rows, sizes: fill };
}

const TEXT: Record<Lang, {
  title: string; cmdLabel: string; nLabel: string; cmds: Record<Cmd, string>;
  inHead: string; outHead: (n: number) => string; part: (i: number) => string; exchange: string; none: string;
  shuffleLbl: string; yes: string; no: string; gotLbl: string; sizesLbl: string; rowsUnit: string; run: string;
  start: Omit<Mark, 'at'>; move: Record<Cmd, Omit<Mark, 'at'>>; moveStay: Omit<Mark, 'at'>;
  result: Record<Cmd, string>; resultStay: string; resultTitle: (out: number, sizes: string) => string; caption: string; svgLabel: string;
}> = {
  th: {
    title: 'เลือกคำสั่งกับค่า n แล้วดูว่าแถวไปอยู่ Partition ไหน และต้อง Shuffle หรือเปล่า',
    cmdLabel: 'คำสั่ง',
    nLabel: 'ค่า n',
    cmds: { rr: 'repartition(n)', key: 'repartition(n, "key")', co: 'coalesce(n)' },
    inHead: 'ตารางที่มีอยู่ (4 Partition)',
    outHead: (n) => `ผลลัพธ์ (${n} Partition)`,
    part: (i) => `Partition ${i}`,
    exchange: 'Exchange (Shuffle)',
    none: 'ไม่มี Exchange',
    shuffleLbl: 'Shuffle',
    yes: 'มี',
    no: 'ไม่มี',
    gotLbl: 'ได้ Partition',
    sizesLbl: 'ขนาด (แถว)',
    rowsUnit: 'แถว',
    run: 'คำสั่งที่รัน',
    start: { name: 'เริ่ม', title: 'ตารางมี 4 Partition ขนาดไม่เท่ากัน', text: 'จุดหนึ่งจุดคือหนึ่งแถว และสีกับตัวอักษรคือค่าของ Column key ตัวอย่างนี้มี 12 แถวกระจายอยู่ใน 4 Partition (5, 3, 1 และ 3 แถว)' },
    move: {
      rr: { name: 'ย้ายแถว', title: 'repartition(n) สับแถวทั้งหมดใหม่', text: 'Spark ใส่ Exchange เข้ามา ทุกแถวต้องผ่าน Shuffle ในแต่ละ Partition เดิม Spark จะเรียงแถวก่อน แล้วแจกทีละแถวสลับกันไปทุก Partition ปลายทาง (Round-robin) โดยเริ่มแจกจากตำแหน่งที่ต่างกันไปตามเลข Partition ตำแหน่งของแต่ละแถวในภาพคือผลที่ Spark ให้จริงกับข้อมูลชุดนี้ เส้นที่ไขว้กันคือแถวที่ข้ามจาก Partition หนึ่งไปอีกอัน' },
      key: { name: 'ย้ายแถว', title: 'repartition(n, "key") แจกแถวตามค่า Key', text: 'ยังมี Exchange เหมือนกัน แต่แถวที่ Key เดียวกันจะไปอยู่ Partition เดียวกัน เพราะ Spark เลือก Partition จากค่า Hash ของ Key ตำแหน่งในภาพคือผลที่ Spark ให้จริงกับข้อมูลชุดนี้ ซึ่ง Key สองตัวอาจชนกันไปอยู่ Partition เดียวกันได้' },
      co: { name: 'ย้ายแถว', title: 'coalesce(n) ต่อ Partition ที่อยู่ติดกันเข้าด้วยกัน', text: 'ไม่มี Exchange แถวไม่ต้องไปข้าม Partition ที่ไกล แต่ละ Partition ปลายทางคือ Partition เดิมที่อยู่ติดกันมาต่อกันเป็นกลุ่ม' },
    },
    moveStay: { name: 'ย้ายแถว', title: 'coalesce เพิ่มจำนวน Partition ไม่ได้', text: 'ตารางมี 4 Partition อยู่แล้ว ต่อให้ขอ n ที่มากกว่านั้นก็ยังเป็น 4 เหมือนเดิม ถ้าอยากได้จำนวนที่มากขึ้น ต้องใช้ repartition' },
    result: {
      rr: 'ขนาดของแต่ละ Partition ใกล้เคียงกัน เพราะแจกทีละแถวสลับกัน แต่ต้องจ่ายค่า Shuffle ของทุกแถว ขนาดไม่ได้เท่ากันเป๊ะเสมอไป เพราะแต่ละ Partition เดิมเริ่มแจกจากตำแหน่งของตัวเอง ลองเลือก n = 8 จะเห็น Partition ที่ว่างอยู่หนึ่งอัน ถ้าแต่ละ Partition เดิมมีแถวเยอะ ความต่างจะเหลือน้อยมาก เพราะแต่ละอันแจกได้ต่างกันไม่เกิน 1 แถว',
      key: 'ขนาดของแต่ละ Partition ขึ้นกับจำนวนแถวของ Key ที่ไปตกอยู่ที่นั่น ถ้า Key หนึ่งมีแถวเยอะ Partition นั้นก็ใหญ่ ลองเปลี่ยน n แล้วดูว่า Partition ว่างเกิดตอนไหน',
      co: 'ถูกกว่าเพราะไม่ต้อง Shuffle แต่ขนาดตามผลรวมของ Partition เดิมที่ถูกรวมกัน จึงอาจไม่เท่ากัน',
    },
    resultStay: 'ไม่มีอะไรเปลี่ยน ตารางยังเป็น 4 Partition และไม่มี Exchange',
    resultTitle: (out, sizes) => `ได้ ${out} Partition ขนาด ${sizes} แถว`,
    caption: 'ภาพนี้ใช้ข้อมูลตัวอย่าง 12 แถว ปลายทางของ repartition ทุกแถวคือผลที่ Spark 4.2.0 ให้จริงเมื่อรันกับข้อมูลชุดนี้ (exercises/07_performance_tuning.py เช็กค่าเหล่านี้ไว้) ส่วนการรวมของ coalesce อ่านจาก CoalescedRDD ใน Source ของ Spark เหมือนกัน และให้ผลตรงกับที่รันจริง (ถ้าไม่มีข้อมูลตำแหน่งของไฟล์ coalesce จะต่อ Partition ที่อยู่ติดกันตามลำดับ) แผนของแต่ละคำสั่งในตารางด้านล่างอ่านจาก explain() ที่รันจริงในไฟล์เดียวกัน',
    svgLabel: 'แถวของตารางย้ายจาก 4 Partition เดิมไปเป็น Partition ใหม่ตามคำสั่งที่เลือก',
  },
  en: {
    title: 'Pick a command and n and see which partition each row lands in, and whether it needs a shuffle',
    cmdLabel: 'Command',
    nLabel: 'Value of n',
    cmds: { rr: 'repartition(n)', key: 'repartition(n, "key")', co: 'coalesce(n)' },
    inHead: 'The table we have (4 partitions)',
    outHead: (n) => `Result (${n} partitions)`,
    part: (i) => `Partition ${i}`,
    exchange: 'Exchange (shuffle)',
    none: 'No Exchange',
    shuffleLbl: 'Shuffle',
    yes: 'yes',
    no: 'no',
    gotLbl: 'Partitions we get',
    sizesLbl: 'Sizes (rows)',
    rowsUnit: 'rows',
    run: 'Command that runs',
    start: { name: 'Start', title: 'The table has 4 partitions of different sizes', text: 'One dot is one row, and the color and the letter are the value of the key column. The example has 12 rows in 4 partitions (5, 3, 1 and 3 rows).' },
    move: {
      rr: { name: 'Move rows', title: 'repartition(n) deals all the rows out again', text: 'Spark adds an Exchange. Every row goes through the shuffle. Inside each old partition Spark sorts the rows first, then deals them out one at a time to the output partitions in turn (round-robin), starting at a position that depends on the number of the partition. Where each row lands in the picture is what Spark really gave for this table. The lines that cross are rows that go from one partition to another.' },
      key: { name: 'Move rows', title: 'repartition(n, "key") deals the rows out by the value of the key', text: 'There is still an Exchange, but the rows with the same key land in the same partition, because Spark picks the partition from the hash of the key. The places in the picture are what Spark really gave for this table, and two keys can collide and share a partition.' },
      co: { name: 'Move rows', title: 'coalesce(n) joins partitions that sit next to each other', text: 'There is no Exchange. No row has to travel to a far partition. Each output partition is a group of old neighbours put together.' },
    },
    moveStay: { name: 'Move rows', title: 'coalesce cannot add partitions', text: 'The table already has 4 partitions. Even if we ask for a bigger n, it stays at 4. To get more partitions we have to use repartition.' },
    result: {
      rr: 'The partitions have similar sizes because the rows are dealt out one at a time, but every row pays for the shuffle. The sizes are not always exactly equal, because every old partition starts dealing at its own position. Pick n = 8 and one partition stays empty. When the old partitions have many rows the difference gets very small, because each one deals out its rows with a difference of at most 1.',
      key: 'The size of each partition follows the number of rows of the keys that land there. A key with many rows makes a big partition. Change n and see when an empty partition appears.',
      co: 'It is cheaper because it does not shuffle, but the sizes follow the sum of the old partitions that were joined, so they can be uneven.',
    },
    resultStay: 'Nothing changes. The table is still 4 partitions and there is no Exchange.',
    resultTitle: (out, sizes) => `We get ${out} partitions of ${sizes} rows`,
    caption: 'The picture uses 12 example rows. The destination of every row under repartition is what Spark 4.2.0 really gave when it ran on this table (exercises/07_performance_tuning.py checks these values). The grouping of coalesce is read from CoalescedRDD in the Spark source and matches the real run (without locality information, coalesce joins neighbouring partitions in order). The plans of the commands in the table below are read from explain() in the same file, which was run.',
    svgLabel: 'The rows of a table move from 4 old partitions to the new partitions of the chosen command',
  },
};

export default function RepartitionLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [cmd, setCmd] = useState<Cmd>('rr');
  const [n, setN] = useState(2);
  const plan = planOf(cmd, n);
  const stays = cmd === 'co' && n >= INPUT_N;
  const doneAt = START + (TOTAL - 1) * STEP_AT + FLY;
  const clock = useClock(doneAt + 2.2);
  const { t } = clock;
  const restart = () => clock.restart();

  const boxH = Math.min(70, (AREA - 8 * (plan.out - 1)) / plan.out);
  const outY = (q: number) => TOP + q * (AREA / plan.out) + (AREA / plan.out - boxH) / 2;
  const inY = (i: number) => TOP + i * (AREA / INPUT_N) + (AREA / INPUT_N - 70) / 2;
  const dotIn = (ip: number, is: number): [number, number] => [IX + 20 + is * 26, inY(ip) + 46];
  const dotOut = (op: number, os: number): [number, number] => [OX + 20 + os * 26, outY(op) + boxH / 2 + (boxH > 50 ? 10 : 0)];

  const lines = new Set(plan.rows.map((r) => `${r.ip}-${r.op}`));
  const sizesText = plan.sizes.join(', ');
  const marks: Mark[] = [
    { at: 0, ...T.start },
    { at: START, ...(stays ? T.moveStay : T.move[cmd]) },
    { at: doneAt, name: lang === 'th' ? 'ผลลัพธ์' : 'Result', title: T.resultTitle(plan.out, sizesText), text: stays ? T.resultStay : T.result[cmd] },
  ];
  const cmdText = `df.${cmd === 'rr' ? `repartition(${n})` : cmd === 'key' ? `repartition(${n}, "key")` : `coalesce(${n})`}`;
  const flow = smooth(prog(t, START - 0.2, START + 0.4));

  return (
    <figure className="viz lg">
      <div className="viz-title">{T.title}</div>
      <div className="lab-controls">
        <span className="lab-label" style={{ margin: 0 }}>{T.cmdLabel}</span>
        <div className="viz-steps" role="group" aria-label={T.cmdLabel}>
          {(Object.keys(T.cmds) as Cmd[]).map((c) => <button key={c} type="button" aria-pressed={cmd === c} onClick={() => { setCmd(c); restart(); }}>{T.cmds[c]}</button>)}
        </div>
      </div>
      <div className="lab-controls">
        <span className="lab-label" style={{ margin: 0 }}>{T.nLabel}</span>
        <div className="viz-steps" role="group" aria-label={T.nLabel}>
          {NS.map((v) => <button key={v} type="button" aria-pressed={n === v} onClick={() => { setN(v); restart(); }}>n = {v}</button>)}
        </div>
      </div>

      <div className="viz-box">
        <svg viewBox="0 0 880 400" role="img" aria-label={T.svgLabel}>
          <rect className="band" x="10" y="10" width="860" height="380" rx="12" />
          <text className="b" x={IX} y="40" style={{ fontSize: 13.5 }}>{T.inHead}</text>
          <text className="b" x={OX} y="40" style={{ fontSize: 13.5 }}>{T.outHead(plan.out)}</text>
          <text className="b" x="440" y="40" textAnchor="middle" style={{ fontSize: 13.5, fill: plan.shuffle ? 'var(--accent)' : 'var(--k2)', opacity: flow }}>
            {plan.shuffle ? T.exchange : T.none}
          </text>

          {/* which input partition sends something to which output partition */}
          {[...lines].map((k) => {
            const [ip, op] = k.split('-').map(Number);
            return (
              <line key={k} x1={IX + IW} y1={inY(ip) + 35} x2={OX} y2={outY(op) + boxH / 2} stroke={plan.shuffle ? 'var(--accent)' : 'var(--k2)'} strokeWidth="1.6" opacity={0.28 * flow} />
            );
          })}

          {INPUT.map((_, ip) => (
            <g key={ip}>
              <rect className="box" x={IX} y={inY(ip)} width={IW} height="70" rx="10" />
              <text className="s b" x={IX + 12} y={inY(ip) + 20}>{T.part(ip)}</text>
            </g>
          ))}
          {Array.from({ length: plan.out }, (_, q) => (
            <g key={q}>
              <rect className="box" x={OX} y={outY(q)} width={OW} height={boxH} rx={boxH < 40 ? 7 : 10} />
              <text className="s b" x={OX - 8} y={outY(q) + boxH / 2 + 4} textAnchor="end">P{q}</text>
              {boxH > 50 && <text className="s" x={OX + 12} y={outY(q) + 20}>{plan.sizes[q]} {T.rowsUnit}</text>}
            </g>
          ))}

          {/* the rows keep a faint outline where they started, so the table before and after can be compared */}
          {plan.rows.map((r) => {
            const [gx, gy] = dotIn(r.ip, r.is);
            return <circle key={'g' + r.order} cx={gx} cy={gy} r="9" fill="none" strokeWidth="1.5" strokeDasharray="3 3" style={{ stroke: TONE[r.key] }} opacity="0.45" />;
          })}

          {plan.rows.map((r) => {
            const f = smooth(prog(t, START + r.order * STEP_AT, START + r.order * STEP_AT + FLY));
            const [x0, y0] = dotIn(r.ip, r.is);
            const [x1, y1] = dotOut(r.op, r.os);
            const x = mix(x0, x1, f);
            const y = mix(y0, y1, f);
            return (
              <g key={r.order} transform={`translate(${x} ${y})`}>
                <circle r="9" style={{ fill: TONE[r.key] }} />
                <text className="dl" y="4" style={{ fontSize: 10 }}>{KEYS[r.key]}</text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="readout" aria-live="off">
        <span>{T.run} <code>{cmdText}</code></span>
        <span>{T.shuffleLbl}: <b>{plan.shuffle ? T.yes : T.no}</b></span>
        <span>{T.gotLbl} <b>{plan.out}</b></span>
        <span>{T.sizesLbl} <b>{sizesText}</b></span>
      </div>
      <ClockControls clock={clock} marks={marks} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
