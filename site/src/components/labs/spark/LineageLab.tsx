import { useState } from 'react';
import type { Lang } from './timeline';

// Shows:      how the lineage of a DataFrame is used to get back one lost partition: which partitions of the earlier steps it
//             depends on, and so what Spark has to run again
// Because:    "Spark remembers the recipe" says nothing about how much of the recipe is redone, and that depends on whether a
//             step reads one partition of its parent (narrow) or all of them (shuffle), and on whether the shuffle files survive
// Control:    the recipe (no shuffle, groupBy, join), which partition of the result is lost, and whether the shuffle files are
//             still there
// Conclusion: a narrow chain redoes one line of cells; a shuffle makes the lost partition depend on every partition before
//             it, but the shuffle files saved by the earlier Action are read instead of redoing them, unless they are gone too
//
// Measured (Spark 4.2.0, exercises/07_performance_tuning.py `cache_lineage` and `cache_dataframe`, and 07b_jvm_limits.py
// `lost_shuffle` for the deleted files): the block of one partition
// removed: only that partition runs its steps again in a narrow chain; after a groupBy or a join the part before the shuffle
// does not run (a Python UDF in it counted 0 rows) while the shuffle files exist, and runs completely (4000 of 4000 rows)
// after the shuffle files were deleted. The files were deleted by the test: an executor that died was not tried, and a
// broadcast join (which does not shuffle the small side) was not drawn.

type Recipe = 'narrow' | 'shuffle' | 'join';
type Kind = 'need' | 'files' | 'idle';

interface Node { id: string; col: number; row: number; x: number; y: number; h: number }
interface Edge { from: string; to: string; shuffle: boolean }

const RECIPES: Recipe[] = ['narrow', 'shuffle', 'join'];
const COLX = [50, 260, 470, 680];
const W = 120;

function build(recipe: Recipe): { nodes: Node[]; edges: Edge[]; cols: number } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  if (recipe === 'join') {
    for (let r = 0; r < 8; r++) nodes.push({ id: `0-${r}`, col: 0, row: r, x: COLX[0], y: 100 + r * 30, h: 24 });
    for (let col = 1; col <= 2; col++) for (let r = 0; r < 4; r++) nodes.push({ id: `${col}-${r}`, col, row: r, x: COLX[col], y: 104 + r * 70, h: 26 });
    for (let a = 0; a < 8; a++) for (let r = 0; r < 4; r++) edges.push({ from: `0-${a}`, to: `1-${r}`, shuffle: true });
    for (let r = 0; r < 4; r++) edges.push({ from: `1-${r}`, to: `2-${r}`, shuffle: false });
    return { nodes, edges, cols: 3 };
  }
  for (let col = 0; col < 4; col++) for (let r = 0; r < 4; r++) nodes.push({ id: `${col}-${r}`, col, row: r, x: COLX[col], y: 100 + r * 52, h: 26 });
  for (let col = 0; col < 3; col++) {
    const wide = recipe === 'shuffle' && col === 1;
    for (let a = 0; a < 4; a++) for (let r = 0; r < 4; r++) if (wide || a === r) edges.push({ from: `${col}-${a}`, to: `${col + 1}-${r}`, shuffle: wide });
  }
  return { nodes, edges, cols: 4 };
}

// what has to run again to get the lost cell back; the shuffle files, when they exist, stand in for what is before the shuffle
function plan(recipe: Recipe, lost: number, files: boolean) {
  const { nodes, edges, cols } = build(recipe);
  const need = new Set<string>();
  const read = new Set<string>();
  const walk = (id: string) => {
    if (need.has(id)) return;
    need.add(id);
    for (const e of edges) {
      if (e.to !== id) continue;
      if (e.shuffle && files) read.add(e.from);
      else walk(e.from);
    }
  };
  walk(`${cols - 1}-${lost}`);
  const kind = (id: string): Kind => (need.has(id) ? 'need' : read.has(id) ? 'files' : 'idle');
  return { nodes, edges, cols, need, read, kind };
}

const TEXT: Record<Lang, {
  title: string; recipeLabel: string; recipes: Record<Recipe, string>; lostLabel: string; filesLabel: string; filesOn: string; filesOff: string;
  steps: Record<Recipe, string[]>; legend: string[]; lostTag: string; readout: (n: number, of: number, r: number) => string;
  note: (r: Recipe, files: boolean, p: number) => { title: string; text: string };
  caption: string; svgLabel: string; cell: string;
}> = {
  th: {
    title: 'ทำให้ Partition ของผลลัพธ์หายไปตัวหนึ่ง แล้วดูว่า Spark ต้องย้อนกลับไปทำอะไรบ้าง',
    recipeLabel: 'สายของ DataFrame',
    recipes: { narrow: 'ไม่มี Shuffle', shuffle: 'มี groupBy', join: 'มี Join' },
    lostLabel: 'Partition ที่หาย',
    filesLabel: 'ไฟล์ Shuffle',
    filesOn: 'ยังอยู่',
    filesOff: 'หายไปด้วย',
    steps: {
      narrow: ['อ่านไฟล์', 'filter', 'withColumn', 'select'],
      shuffle: ['อ่านไฟล์', 'filter', 'groupBy + sum', 'select'],
      join: ['อ่านตาราง A (บน) และ B (ล่าง)', 'Join', 'select'],
    },
    legend: ['ต้องทำใหม่', 'อ่านจากไฟล์ Shuffle', 'ไม่ต้องแตะ', 'ที่หาย'],
    lostTag: 'หาย',
    readout: (n, of, r) => `ต้องทำใหม่ ${n} ขั้นย่อย จากทั้งหมด ${of}${r ? ` และอ่านไฟล์ Shuffle แทนอีก ${r} ขั้นย่อย` : ''}`,
    note: (r, files, p) => {
      if (r === 'narrow') return {
        title: 'ย้อนกลับแค่สายเดียว',
        text: `Partition ของแต่ละขั้นใช้ผลของ Partition หมายเลขเดียวกันในขั้นก่อนหน้าเท่านั้น (Narrow Dependency) Spark จึงทำใหม่เฉพาะสายของ P${p} ตั้งแต่อ่านไฟล์จนถึงขั้นสุดท้าย ส่วน Partition อื่นไม่ต้องทำอะไร`,
      };
      const what = r === 'join' ? 'Join ของตารางใหญ่สองตารางทำให้ทั้งสองฝั่งถูก Shuffle' : 'groupBy ทำให้ข้อมูลถูก Shuffle';
      const need = r === 'join' ? 'ทุก Partition ของทั้งตาราง A และ B' : 'ทุก Partition ของขั้นก่อนหน้า';
      return files
        ? {
          title: 'ย้อนไปถึง Shuffle แล้วอ่านไฟล์แทน',
          text: `${what} P${p} จึงต้องการข้อมูลจาก${need} (Wide Dependency) แต่ตอน Action ก่อนหน้า Spark เขียนผลของฝั่งก่อน Shuffle เก็บไว้เป็นไฟล์ Shuffle แล้ว มันจึงอ่านไฟล์เหล่านั้นแทนการทำใหม่ และทำเฉพาะ ${r === 'join' ? 'Join' : 'groupBy'} กับ select ของ P${p}`,
        }
        : {
          title: 'ต้องทำฝั่งก่อน Shuffle ใหม่ทั้งหมด',
          text: `${what} P${p} จึงต้องการข้อมูลจาก${need} (Wide Dependency) และไฟล์ Shuffle หายไปด้วย (เช่น ไฟล์อยู่บน Executor ที่ล้ม) Spark เลยต้องทำทุก Partition ของฝั่งก่อน Shuffle ใหม่ แล้วค่อยทำ ${r === 'join' ? 'Join' : 'groupBy'} กับ select ของ P${p} ทั้งที่หายไปแค่ Partition เดียว`,
        };
    },
    caption: 'ภาพนี้วัดจริงด้วยการทำให้ Block ของ Partition หายและลบไฟล์ Shuffle บน DataFrame ที่มี UDF นับแถวที่ผ่านขั้นก่อน Shuffle (cache_lineage และ cache_dataframe ใน exercises/07_performance_tuning.py กับ lost_shuffle ใน exercises/07b_jvm_limits.py) ไฟล์ Shuffle ถูกลบเองในการทดสอบ ยังไม่ได้ลองกับ Executor ที่ล้มจริง และไม่ได้วาด Join แบบ Broadcast ที่ไม่ Shuffle ฝั่งที่เล็ก',
    svgLabel: 'Partition ของแต่ละขั้นของ DataFrame พร้อมเส้นที่บอกว่าแต่ละตัวใช้ผลจาก Partition ไหนของขั้นก่อน และตัวที่ต้องทำใหม่เมื่อ Partition ท้ายสายหาย',
    cell: 'P',
  },
  en: {
    title: 'Make one partition of the result disappear and see what Spark has to go back and do',
    recipeLabel: 'DataFrame recipe',
    recipes: { narrow: 'No shuffle', shuffle: 'With a groupBy', join: 'With a join' },
    lostLabel: 'Lost partition',
    filesLabel: 'Shuffle files',
    filesOn: 'still there',
    filesOff: 'gone too',
    steps: {
      narrow: ['read file', 'filter', 'withColumn', 'select'],
      shuffle: ['read file', 'filter', 'groupBy + sum', 'select'],
      join: ['read tables A, B', 'join', 'select'],
    },
    legend: ['runs again', 'read from shuffle files', 'not touched', 'lost'],
    lostTag: 'lost',
    readout: (n, of, r) => `${n} partition-steps run again, of ${of}${r ? `, and ${r} read from shuffle files instead` : ''}`,
    note: (r, files, p) => {
      if (r === 'narrow') return {
        title: 'Only one line is walked back',
        text: `A partition of each step uses only the partition with the same number in the step before (a narrow dependency). So Spark runs again only the line of P${p}, from reading the file to the last step, and the other partitions do nothing.`,
      };
      const what = r === 'join' ? 'A join of two big tables shuffles both sides' : 'A groupBy shuffles the data';
      const need = r === 'join' ? 'every partition of both table A and table B' : 'every partition of the step before';
      return files
        ? {
          title: 'Back to the shuffle, then read the files instead',
          text: `${what}, so P${p} needs data from ${need} (a wide dependency). But the earlier Action already saved the result of the part before the shuffle as shuffle files, so Spark reads those files instead of running that part again, and only runs the ${r === 'join' ? 'join' : 'groupBy'} and select of P${p}.`,
        }
        : {
          title: 'The whole part before the shuffle runs again',
          text: `${what}, so P${p} needs data from ${need} (a wide dependency), and the shuffle files are gone too (for example they were on the executor that died). Spark has to run every partition before the shuffle again, and then the ${r === 'join' ? 'join' : 'groupBy'} and select of P${p}, although only one partition was lost.`,
        };
    },
    caption: 'This was measured by removing the block of a partition and by deleting the shuffle files, on a DataFrame with a UDF that counts the rows that pass the part before the shuffle (cache_lineage and cache_dataframe in exercises/07_performance_tuning.py, and lost_shuffle in exercises/07b_jvm_limits.py). The test deleted the shuffle files itself. A dead executor was not tried, and a broadcast join, which does not shuffle the small side, is not drawn.',
    svgLabel: 'The partitions of each step of a DataFrame, with lines showing which partitions of the step before each one uses, and the ones that run again when a partition at the end is lost',
    cell: 'P',
  },
};

export default function LineageLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [recipe, setRecipe] = useState<Recipe>('shuffle');
  const [lost, setLost] = useState(2);
  const [files, setFiles] = useState(true);
  const g = plan(recipe, lost, files);
  const byId = new Map(g.nodes.map((n) => [n.id, n]));
  const lostId = `${g.cols - 1}-${lost}`;
  const total = g.nodes.length;
  const note = T.note(recipe, files, lost);
  const hasShuffle = recipe !== 'narrow';
  const label = (n: Node) => (recipe === 'join' && n.col === 0 ? `${n.row < 4 ? 'A' : 'B'}${n.row % 4}` : `${T.cell}${n.row}`);
  const fill: Record<Kind, string> = { need: 'var(--accent)', files: 'var(--k2)', idle: 'none' };

  const swatch = (i: number, x: number, y: number) => {
    const p = { x, y, width: 16, height: 14, rx: 4 };
    if (i === 0) return <rect {...p} style={{ fill: 'var(--accent)' }} />;
    if (i === 1) return <rect {...p} style={{ fill: 'var(--k2)' }} />;
    if (i === 2) return <rect {...p} fill="none" strokeWidth="1.5" strokeDasharray="3 3" style={{ stroke: 'var(--muted)' }} />;
    return <rect {...p} fill="none" strokeWidth="2" strokeDasharray="4 3" style={{ stroke: 'var(--wrong)' }} />;
  };

  return (
    <figure className="viz lg">
      <div className="viz-title">{T.title}</div>
      <div className="lab-controls">
        <span className="lab-label" style={{ margin: 0 }}>{T.recipeLabel}</span>
        <div className="viz-steps" role="group" aria-label={T.recipeLabel}>
          {RECIPES.map((r) => <button key={r} type="button" aria-pressed={recipe === r} onClick={() => setRecipe(r)}>{T.recipes[r]}</button>)}
        </div>
      </div>
      <div className="lab-controls">
        <span className="lab-label" style={{ margin: 0 }}>{T.lostLabel}</span>
        <div className="viz-steps" role="group" aria-label={T.lostLabel}>
          {[0, 1, 2, 3].map((p) => <button key={p} type="button" aria-pressed={lost === p} onClick={() => setLost(p)}>{T.cell}{p}</button>)}
        </div>
      </div>
      <div className="lab-controls" style={{ opacity: hasShuffle ? 1 : 0.45 }}>
        <span className="lab-label" style={{ margin: 0 }}>{T.filesLabel}</span>
        <div className="viz-steps" role="group" aria-label={T.filesLabel}>
          <button type="button" aria-pressed={files} onClick={() => setFiles(true)}>{T.filesOn}</button>
          <button type="button" aria-pressed={!files} onClick={() => setFiles(false)}>{T.filesOff}</button>
        </div>
      </div>

      <div className="viz-box">
        <svg viewBox="0 0 880 400" role="img" aria-label={T.svgLabel}>
          <rect className="band" x="10" y="10" width="860" height="380" rx="12" />
          {T.steps[recipe].map((name, i) => (
            <text key={name} className="b" x={COLX[i]} y="82" style={{ fontSize: 14 }}>{i + 1} {name}</text>
          ))}
          {hasShuffle && (
            <text className="b" x={(COLX[recipe === 'join' ? 0 : 1] + W + COLX[recipe === 'join' ? 1 : 2]) / 2} y="62" textAnchor="middle" style={{ fontSize: 13, fill: 'var(--accent)' }}>Shuffle</text>
          )}

          {g.edges.map((e) => {
            const a = byId.get(e.from)!;
            const b = byId.get(e.to)!;
            const on = g.need.has(e.to) && (g.need.has(e.from) || g.read.has(e.from));
            const readLine = on && g.read.has(e.from);
            return (
              <line key={`${e.from}>${e.to}`} x1={a.x + W} y1={a.y + a.h / 2} x2={b.x} y2={b.y + b.h / 2}
                strokeWidth={on ? 2 : 1} style={{ stroke: on ? (readLine ? 'var(--k2)' : 'var(--accent)') : 'var(--line-strong)', opacity: on ? 0.9 : 0.35, transition: 'opacity .3s' }} />
            );
          })}

          {g.nodes.map((n) => {
            const k = g.kind(n.id);
            return (
              <g key={n.id}>
                <rect x={n.x} y={n.y} width={W} height={n.h} rx="7" className="box" style={{ strokeWidth: 1, opacity: 0.6 }} />
                <rect x={n.x} y={n.y} width={W} height={n.h} rx="7" fill={k === 'idle' ? 'none' : undefined} strokeWidth={k === 'idle' ? 1.5 : 0}
                  strokeDasharray={k === 'idle' ? '3 3' : undefined} style={{ fill: fill[k], stroke: k === 'idle' ? 'var(--muted)' : 'none', opacity: k === 'idle' ? 0.6 : 1, transition: 'opacity .3s' }} />
                <text className={k === 'idle' ? 's' : 'dl'} x={n.x + W / 2} y={n.y + n.h / 2 + 4} textAnchor="middle" style={{ fontSize: 12.5, ...(k === 'idle' ? { textAnchor: 'middle', fontWeight: 600 } : {}) }}>{label(n)}</text>
                {n.id === lostId && (
                  <g>
                    <rect x={n.x - 4} y={n.y - 4} width={W + 8} height={n.h + 8} rx="9" fill="none" strokeWidth="2" strokeDasharray="5 4" style={{ stroke: 'var(--wrong)' }} />
                    <text x={n.x + W + 12} y={n.y + n.h / 2 + 4} style={{ fontSize: 13, fill: 'var(--wrong)', fontWeight: 600 }}>{T.lostTag}</text>
                  </g>
                )}
              </g>
            );
          })}

          {T.legend.map((text, i) => (
            <g key={text}>
              {swatch(i, 50 + i * 200, 366)}
              <text className="s" x={50 + i * 200 + 22} y="378" style={{ fontSize: 12.5 }}>{text}</text>
            </g>
          ))}
        </svg>
      </div>

      <div className="readout" aria-live="off">
        <span>{T.readout(g.need.size, total, g.read.size)}</span>
      </div>
      <div className="viz-now" aria-live="polite">
        <strong>{note.title}</strong>
        <span>{note.text}</span>
      </div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
