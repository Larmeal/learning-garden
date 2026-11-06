import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useReducedMotion } from 'motion/react';
import type { Lang } from './stepper';

// One table, stored two ways. The learner picks the columns a query needs, then sees how much of each file
// has to be read from disk: CSV keeps a row together (so every row must be read), Parquet keeps a column together
// (so only the needed columns are read). The play button reads both files cell by cell at the same speed.
const COLS = ['id', 'country', 'city', 'sales'];
const ROWS: (string | number | null)[][] = [
  [1, 'th', 'bkk', 120],
  [2, 'th', 'cnx', 80],
  [3, 'jp', 'tyo', 200],
  [4, 'jp', 'osa', null],
  [5, 'sg', 'sin', 90],
];
const COLOR = ['var(--k1)', 'var(--k2)', 'var(--k3)', 'var(--accent)'];
const TOTAL = ROWS.length * COLS.length;
const TICK_MS = 130;

const TEXT: Record<Lang, {
  title: string;
  pick: string;
  pickHint: string;
  table: string;
  csvName: string;
  csvHow: string;
  parquetName: string;
  parquetHow: string;
  row: (n: number) => string;
  legendUse: string;
  legendWaste: string;
  legendSkip: string;
  play: string;
  replay: string;
  playing: string;
  read: (n: number, total: number) => ReactNode;
  equiv: string;
  result: (needed: number, total: number) => string;
  note: string;
}> = {
  th: {
    title: 'เลือกคอลัมน์ที่ query ต้องใช้ แล้วเทียบว่า CSV กับ Parquet ต้องอ่านจาก disk เท่าไร',
    pick: 'คอลัมน์ที่ query ต้องใช้',
    pickHint: 'กดเลือกได้หลายคอลัมน์',
    table: 'ตารางเดียวกัน (1 ช่อง = 1 ค่าในตาราง)',
    csvName: 'CSV',
    csvHow: 'เก็บทีละแถว: ค่าของแถวเดียวกันอยู่ติดกัน',
    parquetName: 'Parquet',
    parquetHow: 'เก็บทีละคอลัมน์: ค่าของคอลัมน์เดียวกันอยู่ติดกัน',
    row: (n) => `แถว ${n}`,
    legendUse: 'อ่านและใช้จริง',
    legendWaste: 'อ่านมาแต่ไม่ได้ใช้',
    legendSkip: 'ไม่ต้องอ่าน',
    play: 'เล่นการอ่านจาก disk',
    replay: 'เล่นอีกครั้ง',
    playing: 'กำลังอ่าน...',
    read: (n, total) => <>อ่าน <b>{n}</b> จาก {total} ช่อง</>,
    equiv: 'คำสั่งที่เทียบเท่า',
    result: (needed, total) =>
      `ค่าที่ query ใช้จริงมี ${needed} ช่องเท่ากัน แต่ CSV ต้องอ่านทั้ง ${total} ช่อง (อ่านมาแล้วทิ้ง ${total - needed}) ส่วน Parquet อ่านแค่ ${needed} ช่อง ความเร็วในการอ่านเท่ากัน Parquet จึงอ่านเสร็จก่อน`,
    note: 'ภาพนี้ไม่ได้วาดส่วน footer ที่ Parquet ต้องอ่านเสมอ (มีขนาดเล็กมาก)',
  },
  en: {
    title: 'Pick the columns your query needs, then compare how much CSV and Parquet must read from disk',
    pick: 'Columns the query needs',
    pickHint: 'You can pick several',
    table: 'The same table (1 cell = 1 value in the table)',
    csvName: 'CSV',
    csvHow: 'Stored row by row: the values of one row sit next to each other',
    parquetName: 'Parquet',
    parquetHow: 'Stored column by column: the values of one column sit next to each other',
    row: (n) => `Row ${n}`,
    legendUse: 'Read and used',
    legendWaste: 'Read but not used',
    legendSkip: 'Not read',
    play: 'Play the read from disk',
    replay: 'Play again',
    playing: 'Reading...',
    read: (n, total) => <>Read <b>{n}</b> of {total} cells</>,
    equiv: 'Equivalent command',
    result: (needed, total) =>
      `The query uses the same ${needed} cells either way, but CSV must read all ${total} cells (${total - needed} are read and thrown away), while Parquet reads only ${needed}. Both read at the same speed, so Parquet finishes first.`,
    note: 'The picture leaves out the footer that Parquet always reads (it is very small).',
  },
};

type CellState = 'use' | 'waste' | 'skip' | 'wait';

export default function FormatLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const reduce = useReducedMotion();
  const [picked, setPicked] = useState<number[]>([3]);
  // how many cells each file has read so far; TOTAL means the finished picture
  const [tick, setTick] = useState(TOTAL);
  const [playing, setPlaying] = useState(false);
  const [played, setPlayed] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setTick((t) => {
        if (t >= TOTAL) {
          setPlaying(false);
          return TOTAL;
        }
        return t + 1;
      });
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [playing]);

  const toggle = (c: number) => {
    setPlaying(false);
    setTick(TOTAL);
    setPicked((p) => (p.includes(c) ? (p.length > 1 ? p.filter((x) => x !== c) : p) : [...p, c].sort()));
  };
  const play = () => {
    if (reduce) return;
    setTick(0);
    setPlayed(true);
    setPlaying(true);
  };

  const needs = (c: number) => picked.includes(c);
  const neededCells = ROWS.length * picked.length;

  // CSV: a row at a time. Parquet: a column at a time, and only the picked ones are read.
  const csvGroups = ROWS.map((_, r) => ({
    label: T.row(r + 1),
    cells: COLS.map((__, c) => ({ c, key: `${r}-${c}` })),
  }));
  const parquetGroups = COLS.map((name, c) => ({
    label: name,
    cells: ROWS.map((__, r) => ({ c, key: `${r}-${c}` })),
  }));

  // position of every cell in the order it sits on disk
  let n = 0;
  const csvState = new Map<string, CellState>();
  for (const g of csvGroups) for (const cell of g.cells) csvState.set(cell.key, n++ < tick ? (needs(cell.c) ? 'use' : 'waste') : 'wait');
  let rank = 0;
  const parquetState = new Map<string, CellState>();
  for (const g of parquetGroups) for (const cell of g.cells) {
    if (!needs(cell.c)) parquetState.set(cell.key, 'skip');
    else parquetState.set(cell.key, rank++ < tick ? 'use' : 'wait');
  }
  const csvRead = Math.min(tick, TOTAL);
  const parquetRead = Math.min(tick, neededCells);
  const finished = tick >= TOTAL && !playing;

  const panel = (name: string, how: string, groups: typeof csvGroups, state: Map<string, CellState>, read: number) => (
    <div className="fl-panel">
      <div className="fl-head">
        <strong>{name}</strong>
        <span>{how}</span>
      </div>
      <div className="fl-groups" aria-hidden="true">
        {groups.map((g) => (
          <div className="fl-group" key={g.label}>
            <div className="fl-cells">
              {g.cells.map((cell) => (
                <span key={cell.key} className="fl-cell" data-s={state.get(cell.key)} style={{ ['--c' as string]: COLOR[cell.c] }} />
              ))}
            </div>
            <div className="fl-glabel">{g.label}</div>
          </div>
        ))}
      </div>
      <div className="readout" aria-live={finished ? 'polite' : 'off'}>
        <span>{T.read(read, TOTAL)}</span>
      </div>
    </div>
  );

  return (
    <figure className="viz fl">
      <div className="viz-title">{T.title}</div>

      <div className="lab-controls">
        <div className="lab-label" style={{ margin: 0 }}>{T.pick}</div>
        <div className="seg" role="group" aria-label={T.pick}>
          {COLS.map((c, i) => (
            <button key={c} type="button" aria-pressed={needs(i)} onClick={() => toggle(i)}>
              {c}
            </button>
          ))}
        </div>
        <span className="fl-hint">{T.pickHint}</span>
      </div>

      <div className="viz-box" style={{ padding: 16 }}>
        <div className="stack" style={{ gap: 18 }}>
          <div>
            <div className="lab-label">{T.table}</div>
            <div className="tbl-wrap">
              <table className="mini-tbl">
                <thead>
                  <tr>
                    {COLS.map((c, i) => (
                      <th key={c} data-sel={needs(i) || undefined}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((row, r) => (
                    <tr key={r}>
                      {row.map((v, c) => (
                        <td key={c} data-read={needs(c) || undefined} className={v === null ? 'is-null' : undefined}>
                          {v === null ? 'NULL' : v}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="fl-legend" aria-hidden="true">
            <span><i className="fl-cell" data-s="use" style={{ ['--c' as string]: 'var(--accent)' }} /> {T.legendUse}</span>
            <span><i className="fl-cell" data-s="waste" style={{ ['--c' as string]: 'var(--accent)' }} /> {T.legendWaste}</span>
            <span><i className="fl-cell" data-s="skip" /> {T.legendSkip}</span>
          </div>

          <div className="fl-panels">
            {panel(T.csvName, T.csvHow, csvGroups, csvState, csvRead)}
            {panel(T.parquetName, T.parquetHow, parquetGroups, parquetState, parquetRead)}
          </div>
        </div>
      </div>

      <div className="lab-controls" style={{ marginTop: 12 }}>
        <button type="button" className="btn sm primary" onClick={play} disabled={playing || !!reduce}>
          {playing ? T.playing : played ? T.replay : T.play}
        </button>
        <span className="fl-equiv">
          {T.equiv} <code>df.select({picked.map((c) => `"${COLS[c]}"`).join(', ')})</code>
        </span>
      </div>
      <p className="viz-caption">{T.result(neededCells, TOTAL)} {T.note}</p>
    </figure>
  );
}
