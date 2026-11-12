import { useState } from 'react';
import type { Lang } from '../spark/stepper';
import { Legend, Node } from './ib';

// Shows:      the files of an Iceberg table growing commit by commit (metadata.json, manifest list, manifest, data file), each box
//             named by its job in the book picture (shelf label, table of contents, list of a snapshot, list of files, page).
// Because:    the reuse of manifests between snapshots is a picture of lines. Counting "1, 2, 3 rows" in a table does not show it.
// Control:    Append adds a commit; "Merge manifests" makes the next snapshot point to one merged manifest; the snapshot buttons choose which
//             snapshot a reader opens and its path is outlined; "Start over" empties the table.
// Conclusion: a commit writes only a few new files, and a snapshot is a list that points to files older snapshots already use.
//
// Numbers follow exercises/02_table_anatomy.py (three INSERTs: 3 data files, 3 manifests, manifest lists of 1, 2 and 3 rows, 4 metadata.json)
// and the merge follows exercises/10_maintenance.py (rewrite_manifests). The three layers follow the book Apache Iceberg: The Definitive Guide,
// chapter 2, figure 2-1, page 29. Positions are drawn to fit.

interface Commit {
  k: number;
  kind: 'append' | 'merge';
  manifests: string[];
  files: Record<string, string[]>;
}

const MAX = 5;
const ROW = 62;
const NH = 52;
const TOP = 78;
const X = { cat: 10, meta: 132, list: 332, man: 546, file: 728 };
const W = { cat: 100, meta: 168, list: 176, man: 150, file: 142 };

function build(acts: ('append' | 'merge')[]): Commit[] {
  const out: Commit[] = [];
  acts.forEach((a, i) => {
    const k = i + 1;
    const prev = out[i - 1];
    const m = `M${k}`;
    if (a === 'append' || !prev) {
      out.push({ k, kind: 'append', manifests: [...(prev ? prev.manifests : []), m], files: { ...(prev ? prev.files : {}), [m]: [`D${k}`] } });
    } else {
      out.push({ k, kind: 'merge', manifests: [m], files: { [m]: prev.manifests.flatMap((x) => prev.files[x]) } });
    }
  });
  return out;
}

const TEXT: Record<Lang, {
  title: string; append: string; merge: string; reset: string; open: string;
  cols: [string, string][]; layers: [string, string, string];
  catalogNode: (n: number) => string; metaTitle: (k: number) => string; listTitle: (k: number) => string; manTitle: (k: number) => string;
  fileTitle: (k: number) => string; nManifest: (n: number) => string; nFile: (n: number) => string;
  newTag: string; reusedTag: string; legend: [string, string, string];
  wrote: (k: number, kind: 'append' | 'merge', n: number) => string;
  reads: (s: number, m: number, f: number, reused: number) => string;
  empty: string; caption: string;
}> = {
  th: {
    title: 'กด Append ทีละครั้ง แล้วลองดูว่า Commit หนึ่งครั้งเขียนไฟล์ใหม่กี่ไฟล์ และ Snapshot ไหนใช้ไฟล์เก่าซ้ำ',
    append: 'Append 1 Commit', merge: 'รวม Manifest', reset: 'เริ่มใหม่', open: 'ผู้อ่านเปิด Snapshot ที่',
    cols: [['ป้ายบนชั้น', 'Catalog'], ['สารบัญ', 'metadata.json'], ['รายการของ Snapshot', 'Manifest List'], ['รายการไฟล์', 'Manifest'], ['หน้ากระดาษ', 'Data File']],
    layers: ['ชั้น Catalog', 'ชั้น Metadata', 'ชั้น Data'],
    catalogNode: (n) => `ชี้ฉบับ ${n}`, metaTitle: (k) => `ฉบับ ${k}`, listTitle: (k) => `Snapshot ${k}`, manTitle: (k) => `Manifest ${k}`, fileTitle: (k) => `ไฟล์ข้อมูล ${k}`,
    nManifest: (n) => `${n} Manifest`, nFile: (n) => `${n} ไฟล์`,
    newTag: 'ใหม่', reusedTag: 'ใช้ซ้ำ', legend: ['ไฟล์ที่เพิ่งเขียนใน Commit ล่าสุด', 'อยู่ในเส้นทางที่ผู้อ่านเดิน', 'ไม่เกี่ยวกับ Snapshot ที่เลือก (จาง)'],
    wrote: (k, kind, n) => kind === 'append'
      ? `Commit ที่ ${k} เขียนไฟล์ใหม่ ${n} ไฟล์ (สารบัญ, รายการของ Snapshot, รายการไฟล์ และไฟล์ข้อมูล) ไฟล์ของ Commit ก่อนหน้าไม่ถูกแตะเลย`
      : `Commit ที่ ${k} (รวม Manifest) เขียนไฟล์ใหม่ ${n} ไฟล์ ได้แก่สารบัญ รายการของ Snapshot และ Manifest ที่รวมแล้ว ไฟล์ข้อมูลไม่ถูกเขียนใหม่`,
    reads: (s, m, f, r) => `ผู้อ่านที่เปิด Snapshot ${s} จะเดินผ่าน ${m} Manifest และไปถึงไฟล์ข้อมูล ${f} ไฟล์ โดย ${r} Manifest เป็นของ Commit ก่อนหน้า (ใช้ซ้ำ ไม่ได้เขียนใหม่)`,
    empty: 'ตารางที่เพิ่งสร้างมีแค่สารบัญฉบับแรก และยังไม่มี Snapshot ลองกด Append เพื่อเขียนข้อมูลดู',
    caption: 'ตัวเลขตรงกับแบบฝึก 02 (INSERT สามครั้งได้ Manifest 3 ไฟล์ และ Manifest List ที่มี 1, 2, 3 แถว) การรวม Manifest ตรงกับแบบฝึก 10 สามชั้นในภาพตามหนังสือ Apache Iceberg: The Definitive Guide บทที่ 2 หน้า 29 ส่วนตำแหน่งของกล่องเราวาดขึ้นเอง',
  },
  en: {
    title: 'Press Append to add a commit. See how many new files one commit writes and which snapshots reuse old files',
    append: 'Append 1 commit', merge: 'Merge manifests', reset: 'Start over', open: 'A reader opens snapshot',
    cols: [['Shelf label', 'Catalog'], ['Table of contents', 'metadata.json'], ['List of a snapshot', 'Manifest list'], ['List of files', 'Manifest'], ['The pages', 'Data file']],
    layers: ['Catalog layer', 'Metadata layer', 'Data layer'],
    catalogNode: (n) => `points to ${n}`, metaTitle: (k) => `Edition ${k}`, listTitle: (k) => `Snapshot ${k}`, manTitle: (k) => `Manifest ${k}`, fileTitle: (k) => `Data file ${k}`,
    nManifest: (n) => `${n} manifest${n === 1 ? '' : 's'}`, nFile: (n) => `${n} file${n === 1 ? '' : 's'}`,
    newTag: 'new', reusedTag: 'reused', legend: ['written by the latest commit', 'on the path a reader follows', 'not part of the chosen snapshot (faded)'],
    wrote: (k, kind, n) => kind === 'append'
      ? `Commit ${k} wrote ${n} new files (table of contents, snapshot list, file list and data file). The files of earlier commits were not touched at all.`
      : `Commit ${k} (merge manifests) wrote ${n} new files: the table of contents, a snapshot list and the merged manifest. No data file was written again.`,
    reads: (s, m, f, r) => `A reader who opens snapshot ${s} walks through ${m} manifest(s) and reaches ${f} data file(s). ${r} of those manifests belong to earlier commits (reused, not written again).`,
    empty: 'A table that was just created has only its first table of contents and no snapshot yet. Press Append to write data.',
    caption: 'The numbers follow exercise 02 (three INSERTs give 3 manifests and manifest lists of 1, 2 and 3 rows). The merge follows exercise 10. The three layers follow the book Apache Iceberg: The Definitive Guide, chapter 2, page 29. Positions are drawn to fit.',
  },
};

const cy = (row: number) => TOP + row * ROW + NH / 2;
const top = (row: number) => TOP + row * ROW;
const born = (id: string) => Number(id.slice(1));
const curve = (x1: number, y1: number, x2: number, y2: number) => `M${x1},${y1} C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}`;

export default function TreeLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [acts, setActs] = useState<('append' | 'merge')[]>(['append', 'append', 'append']);
  const [pick, setPick] = useState<number | null>(null);
  const commits = build(acts);
  const n = commits.length;
  const sel = pick !== null && pick <= n ? pick : n;
  const snap = commits[sel - 1];
  const latest = commits[n - 1];

  const inMan = new Set(snap ? snap.manifests : []);
  const inFile = new Set(snap ? snap.manifests.flatMap((m) => snap.files[m]) : []);
  const allMan = Array.from(new Set(commits.flatMap((c) => c.manifests)));
  const allFile = Array.from(new Set(commits.flatMap((c) => Object.values(c.files).flat())));
  const filesOf = (m: string) => [...commits].reverse().find((c) => c.manifests.includes(m))!.files[m];
  const written = latest ? (latest.kind === 'append' ? 4 : 3) : 0;
  const reusedMan = snap ? snap.manifests.filter((m) => born(m) !== sel).length : 0;
  const canMerge = n >= 1 && n < MAX && latest.manifests.length >= 2;
  const act = (a: 'append' | 'merge') => { setActs([...acts, a]); setPick(null); };

  const stateOf = (isNew: boolean, inChain: boolean) => (isNew ? 'new' : inChain ? 'use' : 'node') as 'new' | 'use' | 'node';
  const lineStyle = (on: boolean) => ({ stroke: on ? 'var(--accent)' : 'var(--line-strong)', opacity: on ? 1 : 0.3, strokeWidth: on ? 3.5 : 2 });

  return (
    <figure className="viz">
      <div className="viz-title">{T.title}</div>
      <Legend items={[{ kind: 'new', text: T.legend[0] }, { kind: 'use', text: T.legend[1] }, { kind: 'node', text: T.legend[2] }]} />
      <div className="ib-controls">
        <button type="button" className="btn primary sm" onClick={() => act('append')} disabled={n >= MAX}>{T.append}</button>
        <button type="button" className="btn sm" onClick={() => act('merge')} disabled={!canMerge}>{T.merge}</button>
        <button type="button" className="btn sm" onClick={() => { setActs([]); setPick(null); }}>{T.reset}</button>
        {n > 0 && (
          <>
            <span className="ib-lbl">{T.open}</span>
            <span className="seg" role="group" aria-label={T.open}>
              {commits.map((c) => (
                <button key={c.k} type="button" aria-pressed={sel === c.k} onClick={() => setPick(c.k)}>{c.k}</button>
              ))}
            </span>
          </>
        )}
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 490" role="img" aria-label={T.title}>
          <rect className="ib-zone" x={4} y={58} width={118} height={394} rx={10} />
          <rect className="ib-zone" x={124} y={58} width={598} height={394} rx={10} />
          <rect className="ib-zone" x={724} y={58} width={152} height={394} rx={10} />
          <text x={63} y={478} textAnchor="middle" className="ib-layer">{T.layers[0]}</text>
          <text x={423} y={478} textAnchor="middle" className="ib-layer">{T.layers[1]}</text>
          <text x={800} y={478} textAnchor="middle" className="ib-layer">{T.layers[2]}</text>
          {[X.cat, X.meta, X.list, X.man, X.file].map((x, i) => (
            <g key={x}>
              <text x={x} y={24} className="ib-n">{T.cols[i][0]}</text>
              <text x={x} y={44} className="ib-m">{T.cols[i][1]}</text>
            </g>
          ))}

          {/* lines first, boxes on top */}
          <path className="ib-arrow" d={`M${X.cat + W.cat},${cy(n)} L${X.meta},${cy(n)}`} />
          {commits.map((c) => (
            <path key={`ml${c.k}`} className="ib-line" d={`M${X.meta + W.meta},${cy(c.k)} L${X.list},${cy(c.k)}`} style={lineStyle(c.k === sel)} />
          ))}
          {commits.flatMap((c) => c.manifests.map((m) => (
            <path key={`lm${c.k}${m}`} className="ib-line" d={curve(X.list + W.list, cy(c.k), X.man, cy(born(m)))} style={lineStyle(c.k === sel)} />
          )))}
          {allMan.flatMap((m) => filesOf(m).map((f) => (
            <path key={`mf${m}${f}`} className="ib-line" d={curve(X.man + W.man, cy(born(m)), X.file, cy(born(f)))} style={lineStyle(inMan.has(m))} />
          )))}

          <Node x={X.cat} y={top(n)} w={W.cat} h={NH} title={T.catalogNode(n)} state="use" mono={false} />
          {Array.from({ length: n + 1 }, (_, k) => (
            <Node key={`meta${k}`} x={X.meta} y={top(k)} w={W.meta} h={NH} title={T.metaTitle(k)} sub={`v${k}.metadata.json`}
              state={stateOf(k === n && n > 0, k === sel)} tag={k === n && n > 0 ? T.newTag : undefined} dim={k !== sel && k !== n} />
          ))}
          {commits.map((c) => (
            <Node key={`list${c.k}`} x={X.list} y={top(c.k)} w={W.list} h={NH} title={T.listTitle(c.k)} sub={T.nManifest(c.manifests.length)} mono={false}
              state={stateOf(c.k === n, c.k === sel)} tag={c.k === n ? T.newTag : undefined} dim={c.k !== sel && c.k !== n} />
          ))}
          {allMan.map((m) => {
            const isNew = born(m) === n;
            const on = inMan.has(m);
            return (
              <Node key={m} x={X.man} y={top(born(m))} w={W.man} h={NH} title={T.manTitle(born(m))} sub={T.nFile(filesOf(m).length)} mono={false}
                state={stateOf(isNew, on)} tag={isNew ? T.newTag : on && born(m) !== sel ? T.reusedTag : undefined} dim={!on && !isNew} />
            );
          })}
          {allFile.map((f) => {
            const isNew = born(f) === n && latest.kind === 'append';
            const on = inFile.has(f);
            return (
              <Node key={f} x={X.file} y={top(born(f))} w={W.file} h={NH} title={T.fileTitle(born(f))} sub={`d${born(f)}.parquet`}
                state={stateOf(isNew, on)} tag={isNew ? T.newTag : undefined} dim={!on && !isNew} />
            );
          })}
        </svg>
      </div>
      <div className="readout" aria-live="polite">
        {n === 0 ? <div>{T.empty}</div> : (
          <>
            <div>{T.wrote(n, latest.kind, written)}</div>
            <div>{T.reads(sel, snap.manifests.length, inFile.size, reusedMan)}</div>
          </>
        )}
      </div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
