import { useState, type ReactNode } from 'react';
import { StepControls, useStepper, type Lang } from '../spark/stepper';
import { Legend, Lines, Node, type NodeState } from './ib';
import data from './underCovers.json';
import rl from './rowLevel.json';

// Shows:      one small table going through the statements of a lesson. For each statement the picture walks through the numbered steps,
//             draws the files of the three layers (catalog, metadata, data), and marks which are written in this step, which are reused and
//             which a reader skips. Click any box to see what is really inside that file.
//             Two datasets: `uc` (orders: CREATE, INSERT, INSERT, MERGE, SELECT, time travel, compaction, the "under the covers" page) and
//             `cow` / `mor` (the same five rows changed by DELETE and UPDATE in copy-on-write and in merge-on-read, the row-level in-depth page).
// Because:    "a commit writes a few files and swaps one pointer" is easy to say and hard to believe. Reading the real content of the
//             manifest that says DELETED, of the delete file that lists positions, or of the manifest list that still points at an old
//             manifest, is what makes it believable.
// Control:    the Previous / Next buttons walk through the numbered steps; a click on a box shows the content of that file below.
// Conclusion: every statement is the same two moves, write new files that nobody refers to yet, then change one pointer. Reads follow
//             the pointers down and use the statistics in the manifests to skip files and the delete files to skip rows.
//
// Every value in the panel is read from the files on disk by exercises/15_under_the_covers.py --write (underCovers.json) and
// exercises/16_cow_mor_in_depth.py --write (rowLevel.json). The names a1, d1, m1, s1, v1 are short names for the long file names (UUIDs).
// Layering and order follow the book Apache Iceberg: The Definitive Guide, chapter 2 (figure 2-1, page 29) and chapter 3 (figure 3-2,
// page 46); the numbered-step style follows the Dremio guide.

export type Op = 'create' | 'insert1' | 'insert2' | 'merge' | 'select' | 'travel' | 'compact'
  | 'cowDelete' | 'morDelete' | 'morUpdate' | 'morSelect' | 'morCompact' | 'morClean';
type Ds = 'uc' | 'cow' | 'mor';

interface Entry { status: string; file: string; content: number; records: number; bytes: number; order_id?: number[]; customer?: string[]; amount?: number[]; rows: (string | number)[][] }
interface Manifest { name: string; content: number; length: number; seq: number; added: number; existing: number; deleted: number; entries: Entry[] }
interface Snapshot { name: string; id: string; parent: string | null; seq: number; operation: string; summary: Record<string, string>; manifests: Manifest[] }
interface State { label: string; metadata: string; versions: string[]; current: string | null; 'last-sequence-number': number; 'format-version': number; snapshots: Snapshot[] }

// the files of one dataset, looked up by short name
function dataset(states: State[], table: string) {
  const last = states[states.length - 1];
  const all = last.snapshots.flatMap((s) => s.manifests);
  return {
    table, states,
    stateOfV: (v: string): State => states.find((x) => x.metadata === v) ?? { label: '', metadata: v, versions: [v], current: null, 'last-sequence-number': 0, 'format-version': 2, snapshots: [] },
    snapByName: (n: string) => last.snapshots.find((s) => s.name === n)!,
    snapById: (id: string) => last.snapshots.find((s) => s.id === id),
    manifestByName: (n: string) => all.find((m) => m.name === n)!,
    entryOf: (a: string) => all.flatMap((m) => m.entries).find((e) => e.file === a)!,
  };
}
type D = ReturnType<typeof dataset>;
const DS: Record<Ds, D> = {
  uc: dataset((data as unknown as { steps: State[] }).steps, 'db.orders'),
  cow: dataset((rl as unknown as { cow: { steps: State[] } }).cow.steps, 'db.small_cow'),
  mor: dataset((rl as unknown as { mor: { steps: State[] } }).mor.steps, 'db.small_mor'),
};

// ---- what each step of each operation draws -----------------------------------------------------------------------------------------
// snap: the snapshot whose tree is drawn; snaps: the snapshot boxes to show (default just snap); metas: the metadata.json boxes.
// w: ids that already exist (undefined = all of them); nw: written in this step; use / skip: highlighted; dim: faded; ptr: where the
// catalog points; swap: the pointer moves in this step; reused: boxes tagged "reused"; sel: what the panel shows at first.
interface Sp { snap: string | null; snaps?: string[]; metas: string[]; w?: string[]; nw?: string[]; use?: string[]; skip?: string[]; dim?: string[]; reused?: string[]; left?: string[]; ptr: string | null; swap?: boolean; sel?: string }
type Common = Pick<Sp, 'snap' | 'snaps' | 'metas'>;

// A write operation: step 1 reads, then one step per group of files written (bottom up), then the pointer moves.
// o.first: what the first step uses; o.use: what the last step uses; o.dim/dimFrom and o.reused/reusedFrom: from which group on a box is faded or tagged "reused".
function writeOp(groups: string[][], base: string[], common: Common, prev: string, cur: string,
  o: { first?: string[]; left?: string[]; use?: string[]; dim?: string[]; dimFrom?: number; reused?: string[]; reusedFrom?: number } = {}): Sp[] {
  const out: Sp[] = [{ ...common, w: base, ptr: prev, use: o.first ?? [prev], left: o.left, sel: o.first?.[0] ?? prev }];
  groups.forEach((g, i) => {
    out.push({
      ...common, w: [...base, ...groups.slice(0, i + 1).flat()], nw: g, ptr: prev, sel: g[0],
      dim: o.dim && i >= (o.dimFrom ?? 99) ? o.dim : undefined, reused: o.reused && i >= (o.reusedFrom ?? 99) ? o.reused : undefined,
    });
  });
  out.push({ ...common, ptr: cur, swap: true, use: o.use ?? [cur], dim: o.dim, reused: o.reused, sel: 'cat' });
  return out;
}

const SPEC: Record<Op, { ds: Ds; state: number; read: boolean; steps: Sp[] }> = {
  create: {
    ds: 'uc', state: 0, read: false,
    steps: [
      { snap: null, metas: ['v1'], w: [], ptr: null },
      { snap: null, metas: ['v1'], w: ['v1'], nw: ['v1'], ptr: null, sel: 'v1' },
      { snap: null, metas: ['v1'], w: ['v1'], use: ['v1'], ptr: 'v1', swap: true, sel: 'cat' },
    ],
  },
  insert1: { ds: 'uc', state: 1, read: false, steps: writeOp([['a1'], ['m1'], ['s1'], ['v2']], ['v1'], { snap: 's1', metas: ['v1', 'v2'] }, 'v1', 'v2', { use: ['v2', 's1', 'm1', 'a1'] }) },
  insert2: {
    ds: 'uc', state: 2, read: false,
    steps: writeOp([['a2'], ['m2'], ['s2'], ['v3']], ['v2', 'a1', 'm1'], { snap: 's2', metas: ['v2', 'v3'] }, 'v2', 'v3', { use: ['v3', 's2', 'm2', 'a2', 'm1', 'a1'], reused: ['m1'], reusedFrom: 2 }),
  },
  merge: {
    ds: 'uc', state: 3, read: false,
    steps: [
      { snap: 's2', metas: ['v3'], ptr: 'v3', use: ['v3', 's2', 'm2', 'm1', 'a1'], skip: ['a2'], sel: 'a1' },
      { snap: 's3', metas: ['v3', 'v4'], w: ['v3', 'm2', 'a2', 'a1'], nw: ['a3'], ptr: 'v3', sel: 'a3' },
      { snap: 's3', metas: ['v3', 'v4'], w: ['v3', 'm2', 'a2', 'a1', 'a3', 'm3', 'm4'], nw: ['m3', 'm4'], dim: ['a1'], ptr: 'v3', sel: 'm4' },
      { snap: 's3', metas: ['v3', 'v4'], w: ['v3', 'm2', 'a2', 'a1', 'a3', 'm3', 'm4', 's3'], nw: ['s3'], dim: ['a1'], reused: ['m2'], ptr: 'v3', sel: 's3' },
      { snap: 's3', metas: ['v3', 'v4'], w: ['v3', 'm2', 'a2', 'a1', 'a3', 'm3', 'm4', 's3', 'v4'], nw: ['v4'], dim: ['a1'], reused: ['m2'], ptr: 'v3', sel: 'v4' },
      { snap: 's3', metas: ['v3', 'v4'], dim: ['a1'], reused: ['m2'], ptr: 'v4', swap: true, use: ['v4', 's3', 'm3', 'm2', 'a3', 'a2'], sel: 'cat' },
    ],
  },
  select: {
    ds: 'uc', state: 3, read: true,
    steps: [
      { snap: 's3', metas: ['v4'], ptr: 'v4', use: ['v4'], sel: 'cat' },
      { snap: 's3', metas: ['v4'], ptr: 'v4', use: ['v4', 's3'], sel: 'v4' },
      { snap: 's3', metas: ['v4'], ptr: 'v4', use: ['v4', 's3', 'm3', 'm2', 'm4'], sel: 's3' },
      { snap: 's3', metas: ['v4'], ptr: 'v4', use: ['v4', 's3', 'm3', 'm2', 'a2'], skip: ['m4', 'a3', 'a1'], sel: 'm3' },
      { snap: 's3', metas: ['v4'], ptr: 'v4', use: ['v4', 's3', 'm2', 'a2'], skip: ['m3', 'm4', 'a3', 'a1'], sel: 'a2' },
    ],
  },
  travel: {
    ds: 'uc', state: 3, read: true,
    steps: [
      { snap: 's1', snaps: ['s1', 's2', 's3'], metas: ['v4'], ptr: 'v4', use: ['v4'], sel: 'v4' },
      { snap: 's1', snaps: ['s1', 's2', 's3'], metas: ['v4'], ptr: 'v4', use: ['v4', 's1'], skip: ['s2', 's3'], sel: 's1' },
      { snap: 's1', snaps: ['s1', 's2', 's3'], metas: ['v4'], ptr: 'v4', use: ['v4', 's1', 'm1'], skip: ['s2', 's3'], sel: 'm1' },
      { snap: 's1', snaps: ['s1', 's2', 's3'], metas: ['v4'], ptr: 'v4', use: ['v4', 's1', 'm1', 'a1'], skip: ['s2', 's3'], sel: 'a1' },
    ],
  },
  compact: {
    ds: 'uc', state: 4, read: false,
    steps: [
      { snap: 's3', metas: ['v4'], ptr: 'v4', use: ['a3', 'a2'], dim: ['a1'], sel: 'a2' },
      { snap: 's4', metas: ['v4', 'v5'], w: ['v4', 'a3', 'a2', 'a4'], nw: ['a4'], ptr: 'v4', sel: 'a4' },
      { snap: 's4', metas: ['v4', 'v5'], w: ['v4', 'a3', 'a2', 'a4', 'm5', 'm6', 'm7'], nw: ['m5', 'm6', 'm7'], dim: ['a3', 'a2'], ptr: 'v4', sel: 'm6' },
      { snap: 's4', metas: ['v4', 'v5'], w: ['v4', 'a3', 'a2', 'a4', 'm5', 'm6', 'm7', 's4'], nw: ['s4'], dim: ['a3', 'a2'], ptr: 'v4', sel: 's4' },
      { snap: 's4', metas: ['v4', 'v5'], w: ['v4', 'a3', 'a2', 'a4', 'm5', 'm6', 'm7', 's4', 'v5'], nw: ['v5'], dim: ['a3', 'a2'], ptr: 'v4', sel: 'v5' },
      { snap: 's4', metas: ['v4', 'v5'], dim: ['a3', 'a2'], ptr: 'v5', swap: true, use: ['v5', 's4', 'm5', 'a4'], sel: 'cat' },
    ],
  },

  // ---- row-level: copy-on-write and merge-on-read (dataset cow / mor, the same five rows, see exercises/16_cow_mor_in_depth.py) ----
  cowDelete: {
    ds: 'cow', state: 1, read: false,
    steps: writeOp([['a2'], ['m2', 'm3'], ['s2'], ['v3']], ['v2', 'a1'], { snap: 's2', metas: ['v2', 'v3'] }, 'v2', 'v3', { first: ['v2', 'a1'], use: ['v3', 's2', 'm2', 'a2'], dim: ['a1'], dimFrom: 1 }),
  },
  morDelete: {
    ds: 'mor', state: 1, read: false,
    steps: writeOp([['d1'], ['m2'], ['s2'], ['v3']], ['v2', 'm1', 'a1'], { snap: 's2', metas: ['v2', 'v3'] }, 'v2', 'v3', { first: ['v2', 'a1'], use: ['v3', 's2', 'm2', 'd1', 'm1', 'a1'], reused: ['m1'], reusedFrom: 2 }),
  },
  morUpdate: {
    ds: 'mor', state: 2, read: false,
    steps: writeOp([['a2'], ['d2'], ['m3', 'm4', 'm5'], ['s3'], ['v4']], ['v3', 'm1', 'a1', 'm2', 'd1'], { snap: 's3', metas: ['v3', 'v4'] }, 'v3', 'v4',
      { first: ['v3', 'a1', 'd1'], use: ['v4', 's3', 'm3', 'a2', 'm4', 'd2', 'm1', 'a1'], dim: ['d1'], dimFrom: 2, reused: ['m1'], reusedFrom: 3 }),
  },
  morSelect: {
    ds: 'mor', state: 2, read: true,
    steps: [
      { snap: 's3', metas: ['v4'], ptr: 'v4', use: ['v4'], sel: 'cat' },
      { snap: 's3', metas: ['v4'], ptr: 'v4', use: ['v4', 's3'], sel: 'v4' },
      { snap: 's3', metas: ['v4'], ptr: 'v4', use: ['v4', 's3', 'm3', 'm1', 'm4', 'm5'], sel: 's3' },
      { snap: 's3', metas: ['v4'], ptr: 'v4', use: ['v4', 's3', 'm3', 'm1', 'm4', 'a2', 'a1', 'd2'], skip: ['m5', 'd1'], sel: 'm4' },
      { snap: 's3', metas: ['v4'], ptr: 'v4', use: ['v4', 's3', 'm3', 'm1', 'm4', 'a2', 'a1', 'd2'], skip: ['m5', 'd1'], sel: 'd2' },
    ],
  },
  morCompact: {
    ds: 'mor', state: 3, read: false,
    steps: [
      { snap: 's3', metas: ['v4'], ptr: 'v4', use: ['a1', 'd2', 'a2'], dim: ['d1'], sel: 'd2' },
      { snap: 's4', metas: ['v4', 'v5'], w: ['v4', 'a2', 'a1', 'd2', 'm4', 'a3'], nw: ['a3'], ptr: 'v4', sel: 'a3' },
      { snap: 's4', metas: ['v4', 'v5'], w: ['v4', 'a2', 'a1', 'd2', 'm4', 'a3', 'm6', 'm7', 'm8'], nw: ['m6', 'm7', 'm8'], dim: ['a2', 'a1'], ptr: 'v4', sel: 'm8' },
      { snap: 's4', metas: ['v4', 'v5'], w: ['v4', 'a2', 'a1', 'd2', 'm4', 'a3', 'm6', 'm7', 'm8', 's4'], nw: ['s4'], dim: ['a2', 'a1'], reused: ['m4'], ptr: 'v4', sel: 's4' },
      { snap: 's4', metas: ['v4', 'v5'], w: ['v4', 'a2', 'a1', 'd2', 'm4', 'a3', 'm6', 'm7', 'm8', 's4', 'v5'], nw: ['v5'], dim: ['a2', 'a1'], reused: ['m4'], ptr: 'v4', sel: 'v5' },
      { snap: 's4', metas: ['v4', 'v5'], dim: ['a2', 'a1'], reused: ['m4'], ptr: 'v5', swap: true, use: ['v5', 's4', 'm6', 'a3'], left: ['d2'], sel: 'd2' },
    ],
  },
  morClean: {
    ds: 'mor', state: 4, read: false,
    steps: writeOp([['m9'], ['s5'], ['v6']], ['v5', 'm6', 'a3', 'd2'], { snap: 's5', metas: ['v5', 'v6'] }, 'v5', 'v6', { first: ['v5', 'd2'], left: ['d2'], use: ['v6', 's5', 'm6', 'a3'], dim: ['d2'], dimFrom: 0, reused: ['m6'], reusedFrom: 1 }),
  },
};

// ---- text ---------------------------------------------------------------------------------------------------------------------------
interface OpText { title: string; sql: string; steps: [string, string][] }
interface Text {
  legendWrite: [string, string, string]; legendRead: [string, string, string];
  cols: [string, string][]; layers: [string, string, string];
  vTitle: (n: string) => string; sTitle: (n: string) => string; mTitle: (n: string) => string; aTitle: (n: string) => string;
  dTitle: (n: string) => string; mdTitle: (n: string) => string; pos: (n: number) => string; colsDel: [string, string];
  leftTag: string; rows: (n: number) => string; nMan: (n: number) => string; none: string; newTag: string; reusedTag: string; catalog: string;
  click: string; fields: string; field: string; value: string; means: string; sqlLabel: string; panel: Record<string, string>;
  ops: Record<Op, OpText>; names: Record<Op, string[]>; caption: string;
}

const TEXT: Record<Lang, Text> = {
  th: {
    legendWrite: ['เพิ่งเขียนในขั้นนี้', 'มีอยู่แล้วและเกี่ยวกับขั้นนี้', 'ยังไม่ได้เขียน'],
    legendRead: ['Spark เปิดอ่าน', 'ตัดทิ้ง ไม่ต้องเปิด', 'ยังไม่ถึงขั้นนั้น (จาง)'],
    cols: [['ป้ายบนชั้น', 'Catalog'], ['สารบัญ', 'metadata.json'], ['รายการของ Snapshot', 'Manifest List'], ['รายการไฟล์', 'Manifest'], ['ไฟล์ข้อมูล', 'Data File']],
    layers: ['Catalog', 'Metadata', 'Data'],
    dTitle: (n) => `ไฟล์ลบ ${n}`, mdTitle: (n) => `รายการไฟล์ลบ ${n}`, pos: (n) => `${n} ตำแหน่ง`, colsDel: ['ไฟล์ข้อมูล / ไฟล์ลบ', 'Data / Delete'],
    vTitle: (n) => `สารบัญ ${n}`, sTitle: (n) => `Snapshot ${n}`, mTitle: (n) => `รายการไฟล์ ${n}`, aTitle: (n) => `ไฟล์ข้อมูล ${n}`,
    rows: (n) => `${n} แถว`, nMan: (n) => `${n} Manifest`, none: 'ยังไม่มี', leftTag: 'ค้างอยู่', newTag: 'ใหม่', reusedTag: 'ใช้ซ้ำ', catalog: 'Catalog',
    click: 'คลิกกล่องในภาพเพื่อดูว่าข้างในไฟล์นั้นมีอะไร ค่าทั้งหมดอ่านจากไฟล์จริงที่ Spark เขียน',
    fields: 'ข้างในไฟล์', field: 'ฟิลด์', value: 'ค่า', means: 'หมายความว่า', sqlLabel: 'คำสั่ง',
    panel: {
      md: 'Manifest ของไฟล์ลบ', d: 'ไฟล์ลบแบบ Position (Parquet)', contentData: '0 = Manifest ของไฟล์ข้อมูล', contentDel: '1 = Manifest ของไฟล์ลบ', entryD: 'ไฟล์ลบหนึ่งไฟล์', recordPos: 'จำนวนตำแหน่งที่ไฟล์นี้บอกให้ข้าม',
      cat: 'แถวของตารางใน Catalog', v: 'ไฟล์ metadata.json', s: 'Manifest List ของ Snapshot', m: 'Manifest', a: 'ไฟล์ข้อมูล (Parquet)',
      table_name: 'ชื่อตารางที่ Catalog จำ', metadata_location: 'ตัวชี้: สารบัญฉบับปัจจุบัน', previous_metadata_location: 'สารบัญฉบับก่อนหน้า',
      'format-version': 'เวอร์ชันของ Spec (ตารางนี้ใช้ v2)', 'last-sequence-number': 'เลขลำดับของ Commit ล่าสุด', 'current-snapshot-id': 'Snapshot ที่ผู้อ่านเห็นตอนนี้',
      snapshots: 'Snapshot ทั้งหมดที่ยังเก็บไว้', 'metadata-log': 'สารบัญฉบับก่อน ๆ ที่เคยเป็นปัจจุบัน', schema: 'Column กับ Field ID (ID เดิมตลอดแม้เปลี่ยนชื่อ)',
      'snapshot-id': 'รหัสของ Snapshot', 'parent-snapshot-id': 'Snapshot ก่อนหน้า', 'sequence-number': 'ลำดับของ Commit นี้', operation: 'ชนิดการเปลี่ยนแปลง', summary: 'สรุปสิ่งที่ Commit นี้ทำ',
      manifests: 'Manifest ที่ Snapshot นี้ชี้ไป (ชื่อ: เพิ่ม / มีอยู่แล้ว / ลบ)', record_count: 'จำนวนแถวในไฟล์', file_size: 'ขนาดไฟล์', 'sequence-no': 'ลำดับ Commit ที่เขียน Manifest นี้',
      entry: 'ไฟล์ข้อมูลหนึ่งไฟล์', counts: 'ไฟล์ที่เพิ่ม / มีอยู่แล้ว / ลบ', unreferenced: 'ยังไม่มีใครอ้างถึง', emptyV: 'ว่าง ยังไม่มี Snapshot', firstV: 'ไม่มี (นี่คือฉบับแรก)',
      ownerSnap: 'เขียนโดย Snapshot', stat: 'ค่าต่ำสุด..สูงสุดของแต่ละ Column',
    },
    ops: {
      cowDelete: {
        title: 'DELETE แบบ Copy-on-write: ลบ 1 Row จาก 5 Row แล้วดูว่า Spark เขียนอะไรใหม่บ้าง',
        sql: "DELETE FROM lab.db.small_cow WHERE order_id = 3    -- ตารางใช้โหมดเริ่มต้น คือ Copy-on-write",
        steps: [
          ['1. หาไฟล์ที่มี Order 3', 'Order 3 อยู่ใน a1 ซึ่งมีทั้ง 5 Row ตารางนี้ไม่ได้ตั้งโหมดอะไร จึงใช้ค่าเริ่มต้นคือ Copy-on-write'],
          ['2. เขียนไฟล์ที่ไม่มี Order 3', 'Spark อ่าน a1 ทั้งไฟล์ ตัด Order 3 ออก แล้วเขียน 4 Row ที่เหลือเป็นไฟล์ใหม่ a2 ลบ Row เดียวก็ต้องเขียนไฟล์ใหม่ทั้งไฟล์'],
          ['3. เขียน Manifest สองไฟล์', 'm2 บอกว่า a2 ถูกเพิ่ม (ADDED) และ m3 บอกว่า a1 ถูกลบ (DELETED)'],
          ['4. เขียน Manifest List ใหม่', 's2 ชี้ที่ m2 กับ m3 และไม่มี m1 แล้ว เพราะ a1 ที่อยู่ใน m1 ถูกแทนด้วย a2'],
          ['5. เขียน metadata.json ฉบับใหม่', 'v3 เพิ่ม Snapshot s2 ที่มี operation เป็น overwrite Catalog ยังชี้ v2'],
          ['6. เปลี่ยนตัวชี้ใน Catalog', 'ผู้อ่านเห็น 4 Row ในไฟล์เดียว และอ่านได้ตรง ๆ โดยไม่ต้องกรองอะไรเพิ่ม แต่สิ่งที่ต้องแลกคือเราเขียน 4 Row ใหม่เพื่อลบแค่ 1 Row'],
        ],
      },
      morDelete: {
        title: 'DELETE แบบ Merge-on-read: ลบ Row เดิมด้วยการเขียนไฟล์ลบเล็ก ๆ ไฟล์ข้อมูลไม่ถูกแตะเลย',
        sql: "DELETE FROM lab.db.small_mor WHERE order_id = 3    -- ตารางตั้งโหมดเป็น Merge-on-read",
        steps: [
          ['1. หาตำแหน่งของ Order 3', 'Spark ต้องรู้ว่า Row นี้อยู่ตำแหน่งที่เท่าไรของ a1 จึงต้องอ่าน a1 และได้ตำแหน่ง 2 (นับจาก 0) ซึ่งเป็นต้นทุนฝั่งเขียนของไฟล์ลบแบบ Position'],
          ['2. เขียนไฟล์ลบ', 'd1 เป็นไฟล์ Parquet เล็ก ๆ ที่มีแถวเดียว คือชื่อไฟล์ข้อมูล a1 กับตำแหน่ง 2 ไฟล์ a1 ไม่ถูกแตะเลย'],
          ['3. เขียน Manifest ของไฟล์ลบ', 'm2 เป็น Manifest ชนิดไฟล์ลบ (content = 1) ซึ่งแยกจาก Manifest ของไฟล์ข้อมูล และบอกว่า d1 ถูกเพิ่ม'],
          ['4. เขียน Manifest List ใหม่', 's2 ชี้ที่ m1 (ใช้ซ้ำ ลิสต์ a1 เหมือนเดิม) และ m2 (ลิสต์ d1) โดย Operation ของ Snapshot นี้คือ delete'],
          ['5. เขียน metadata.json ฉบับใหม่', 'v3 เพิ่ม Snapshot s2 Catalog ยังชี้ v2'],
          ['6. เปลี่ยนตัวชี้ใน Catalog', 'a1 ยังมี 5 Row ในไฟล์ แต่ผู้อ่านต้องเอา d1 มากรองก่อน จึงเห็น 4 Row'],
        ],
      },
      morUpdate: {
        title: 'UPDATE แบบ Merge-on-read: ลบ Row เก่าด้วยไฟล์ลบ แล้วเขียน Row ใหม่เป็นไฟล์ข้อมูลเล็ก ๆ',
        sql: "UPDATE lab.db.small_mor SET amount = 11.0 WHERE order_id = 5",
        steps: [
          ['1. หา Row ที่จะแก้', 'Order 5 อยู่ตำแหน่ง 4 ของ a1 และ a1 มีไฟล์ลบ d1 อยู่แล้วจาก DELETE ครั้งก่อน (ตำแหน่ง 2)'],
          ['2. เขียน Row ใหม่เป็นไฟล์ข้อมูล', 'a2 มี 1 Row คือ Order 5 ที่ Amount เป็น 11.0 เพราะ UPDATE ใน Merge-on-read ก็คือการลบ Row เก่าแล้วเขียน Row ใหม่'],
          ['3. เขียนไฟล์ลบใหม่ที่รวมของเก่า', 'd2 มี 2 ตำแหน่ง คือตำแหน่ง 2 (Order 3 ที่ลบไว้ก่อน) กับตำแหน่ง 4 (Order 5) Spark เอาตำแหน่งจาก d1 มารวมไว้ใน d2 เพื่อให้ a1 มีไฟล์ลบแค่ไฟล์เดียว'],
          ['4. เขียน Manifest สามไฟล์', 'm3 บอกว่า a2 ถูกเพิ่ม m4 บอกว่า d2 ถูกเพิ่ม และ m5 บอกว่า d1 ถูกลบ (DELETED) เพราะ d2 มาแทนแล้ว'],
          ['5. เขียน Manifest List ใหม่', 's3 ชี้ที่ m3, m1 (ใช้ซ้ำ), m4 และ m5'],
          ['6. เขียน metadata.json ฉบับใหม่', 'v4 เพิ่ม Snapshot s3 ที่มี operation เป็น overwrite เพราะมีทั้งไฟล์ที่เพิ่มและไฟล์ที่ถูกแทน'],
          ['7. เปลี่ยนตัวชี้ใน Catalog', 'ผู้อ่านเห็น a2 (1 Row) กับ a1 ที่ถูกกรองด้วย d2 (เหลือ 3 Row) รวม 4 Row'],
        ],
      },
      morSelect: {
        title: 'SELECT บนตาราง Merge-on-read: ผู้อ่านต้องเอาไฟล์ลบมากรองไฟล์ข้อมูลเอง',
        sql: "SELECT * FROM lab.db.small_mor",
        steps: [
          ['1. ถาม Catalog', 'Catalog บอกว่าตารางชี้ที่ v4'],
          ['2. เปิด metadata.json และเลือก Snapshot', 'ใน v4 Snapshot ปัจจุบันคือ s3'],
          ['3. อ่าน Manifest List', 's3 ลิสต์ Manifest สี่ไฟล์ คือ m3, m1, m4 และ m5'],
          ['4. อ่าน Manifest', 'm5 มีแต่ d1 ที่ถูกลบ จึงข้ามได้ ส่วนที่เหลือบอกว่ามีไฟล์ข้อมูล a2 กับ a1 และไฟล์ลบ d2 ที่ต้องใช้กับ a1'],
          ['5. อ่านไฟล์ข้อมูลแล้วกรองด้วยไฟล์ลบ', 'a2 อ่านได้ตรง ๆ 1 Row ส่วน a1 มี 5 Row แต่ d2 สั่งให้ข้ามตำแหน่ง 2 กับ 4 จึงเหลือ 3 Row รวมได้ 4 Row เท่ากับที่ SELECT count นับได้ (PyIceberg ก็เห็นว่าต้องใช้ d2 กับ a1)'],
        ],
      },
      morCompact: {
        title: 'Compaction บนตาราง Merge-on-read: เขียนไฟล์ข้อมูลใหม่ที่กรองแล้ว แต่ไฟล์ลบยังค้างอยู่',
        sql: "CALL lab.system.rewrite_data_files(table => 'db.small_mor', options => map('delete-file-threshold','1','min-input-files','1'))",
        steps: [
          ['1. เลือกไฟล์ที่ต้องเขียนใหม่', 'a1 มีไฟล์ลบ d2 ซึ่งถึงเกณฑ์ delete-file-threshold ที่เราตั้งไว้ที่ 1 แล้ว Spark จึงรวม a1 กับ a2 เข้าด้วยกัน (rewritten_data_files_count เป็น 2)'],
          ['2. เขียนไฟล์ที่กรองแล้ว', 'Spark อ่าน a1 พร้อมกรองด้วย d2 แล้วรวมกับ a2 เขียนเป็น a3 ที่มี 4 Row โดยในไฟล์ใหม่ไม่มี Row ที่ถูกลบอยู่แล้ว'],
          ['3. เขียน Manifest สามไฟล์', 'm6 บอกว่า a3 ถูกเพิ่ม ส่วน m7 กับ m8 บอกว่า a2 และ a1 ถูกลบ'],
          ['4. เขียน Manifest List ใหม่', 's4 ชี้ที่ m6, m7, m8 และ m4 (Manifest ของ d2 ที่ไม่ได้ถูกแตะ จึงใช้ซ้ำ) โดย operation ของ Snapshot คือ replace'],
          ['5. เขียน metadata.json ฉบับใหม่', 'v5 เพิ่ม Snapshot s4 Catalog ยังชี้ v4'],
          ['6. เปลี่ยนตัวชี้ใน Catalog', 'ผู้อ่านใหม่เปิดแค่ a3 ไฟล์เดียวโดยไม่ต้องกรอง แต่ d2 ยังอยู่ใน Snapshot (total-delete-files ยังเป็น 1) ทั้งที่ไม่มีไฟล์ข้อมูลไหนต้องใช้มันแล้ว ซึ่ง removed_delete_files_count ก็เป็น 0 ด้วย'],
        ],
      },
      morClean: {
        title: 'เก็บกวาดไฟล์ลบที่ไม่มีใครใช้ (Dangling Delete): ไม่ต้องเขียนไฟล์ข้อมูลใหม่เลย',
        sql: "CALL lab.system.rewrite_data_files(table => 'db.small_mor', options => map('remove-dangling-deletes','true','min-input-files','100'))",
        steps: [
          ['1. หาไฟล์ลบที่ไม่เหลือไฟล์ข้อมูลให้ใช้', 'd2 ชี้ไปที่ a1 ซึ่งไม่อยู่ใน Snapshot ปัจจุบันแล้ว ไฟล์ลบแบบนี้เรียกว่า Dangling และเพราะตัวเลือก remove-dangling-deletes ปิดไว้เป็นค่าเริ่มต้น เราเลยต้องเปิดเอง'],
          ['2. เขียน Manifest ที่บอกว่า d2 ถูกลบ', 'm9 ลิสต์ d2 เป็น DELETED โดยไม่มีการเขียนไฟล์ข้อมูลใหม่ (rewritten_data_files_count เป็น 0) และ m6 ที่ลิสต์ a3 ก็ไม่ถูกแตะ'],
          ['3. เขียน Manifest List ใหม่', 's5 ชี้ที่ m6 (ใช้ซ้ำ) และ m9'],
          ['4. เขียน metadata.json ฉบับใหม่', 'v6 เพิ่ม Snapshot s5 Catalog ยังชี้ v5'],
          ['5. เปลี่ยนตัวชี้ใน Catalog', 'total-delete-files เป็น 0 ตอนนี้ตารางเหลือไฟล์ข้อมูล a3 ไฟล์เดียว และไม่มีไฟล์ลบเลย'],
        ],
      },
      create: {
        title: 'CREATE TABLE: ตารางเปล่าก็มีไฟล์แล้ว 1 ไฟล์ กดถัดไปทีละขั้น แล้วคลิกกล่องดูข้างในไฟล์',
        sql: "CREATE TABLE lab.db.orders (order_id bigint, customer string, amount double) USING iceberg",
        steps: [
          ['1. Spark ส่งคำสั่ง CREATE TABLE', 'Spark ตรวจกับ Catalog ว่ายังไม่มีตาราง db.orders แล้วเตรียม Schema ที่ให้ Field ID กับทุก Column (order_id เป็น 1, customer เป็น 2, Amount เป็น 3) ตอนนี้ยังไม่มีไฟล์ใหม่'],
          ['2. เขียน metadata.json ฉบับแรก', 'ไฟล์ v1 เก็บ Schema, Partition spec และรายการ Snapshot ที่ว่างอยู่ เพราะตารางเปล่าไม่มีไฟล์ข้อมูล ไม่มี Manifest และไม่มี Manifest List'],
          ['3. บอก Catalog ให้ชี้มาที่ไฟล์นี้', 'Catalog เพิ่มแถวของ db.orders ที่ชี้ไปที่ v1 ตั้งแต่ตรงนี้ใครเปิดตารางก็จะเจอไฟล์นี้ และสิ่งที่ Catalog จำไว้ก็มีแค่เรื่องเดียวนี้'],
        ],
      },
      insert1: {
        title: 'INSERT ครั้งแรก: เขียนไฟล์ใหม่ 4 ไฟล์ แล้วค่อยเปลี่ยนตัวชี้ใน Catalog',
        sql: "INSERT INTO lab.db.orders VALUES (1, 'ann', 120.0), (2, 'bob', 80.5)",
        steps: [
          ['1. Spark อ่านตารางปัจจุบัน', 'Spark ถาม Catalog ว่าตอนนี้ตารางชี้ไฟล์ไหน ได้ v1 แล้วอ่าน Schema เพื่อรู้ว่าไฟล์ที่จะเขียนต้องหน้าตาอย่างไร'],
          ['2. เขียนไฟล์ข้อมูล', 'Spark เขียนไฟล์ Parquet a1 ที่มี 2 แถว ตอนนี้ยังไม่มีไฟล์ไหนบอกว่าตารางนี้มี a1 ผู้อ่านจึงยังไม่เห็นมัน'],
          ['3. เขียน Manifest', 'Manifest m1 เก็บ 1 แถวต่อ 1 ไฟล์ข้อมูล ในแถวนั้นมีสถานะ ADDED จำนวนแถว และค่าต่ำสุดกับสูงสุดของทุก Column'],
          ['4. เขียน Manifest List', 'Manifest List s1 ของ Snapshot ใหม่ชี้ไปที่ m1 และบอกว่า Manifest นี้เพิ่มไฟล์ 1 ไฟล์'],
          ['5. เขียน metadata.json ฉบับใหม่', 'v2 มีทุกอย่างที่ v1 มี และเพิ่ม Snapshot s1 เป็น Snapshot ปัจจุบัน แต่ Catalog ยังชี้ v1 ผู้อ่านจึงยังไม่เห็นอะไรเปลี่ยน'],
          ['6. เปลี่ยนตัวชี้ใน Catalog', 'Catalog เปลี่ยนจาก v1 เป็น v2 ในครั้งเดียว ตั้งแต่ตอนนี้ผู้อ่านเห็นไฟล์ใหม่ทั้งสี่ไฟล์พร้อมกัน ถ้าขั้นนี้ไม่ผ่าน ไฟล์ที่เขียนไปแล้วก็แค่ค้างเป็นไฟล์ที่ไม่มีใครอ้างถึง'],
        ],
      },
      insert2: {
        title: 'INSERT ครั้งที่สอง: Manifest ของครั้งแรกถูกใช้ซ้ำ ไม่ต้องเขียนใหม่',
        sql: "INSERT INTO lab.db.orders VALUES (3, 'ann', 42.0), (4, 'cara', 300.0)",
        steps: [
          ['1. Spark อ่านตารางปัจจุบัน', 'Catalog ชี้ที่ v2 ซึ่งมี Snapshot s1 อยู่แล้ว Spark เปิดมันขึ้นมาเพื่อรู้ Schema'],
          ['2. เขียนไฟล์ข้อมูลใหม่', 'Spark เขียน a2 ที่มี Order 3 และ 4 ไฟล์ a1 ของครั้งก่อนไม่ถูกแตะ'],
          ['3. เขียน Manifest ใหม่', 'Manifest m2 ลิสต์เฉพาะ a2 ส่วน m1 ซึ่งลิสต์ a1 อยู่ ไม่ถูกแก้ ไฟล์พวกนี้ไม่เคยถูกแก้หลังเขียน'],
          ['4. เขียน Manifest List ใหม่', 's2 ชี้ไปที่ m2 (ใหม่) และ m1 (ของเดิม ใช้ซ้ำ) เพราะเหตุนี้ Commit ครั้งที่สองจึงไม่ต้องไล่เขียนรายการไฟล์ทั้งตารางใหม่'],
          ['5. เขียน metadata.json ฉบับใหม่', 'v3 เก็บ Snapshot s1 กับ s2 โดย s2 เป็นปัจจุบัน Catalog ยังชี้ v2 อยู่'],
          ['6. เปลี่ยนตัวชี้ใน Catalog', 'Catalog เปลี่ยนจาก v2 เป็น v3 ผู้อ่านเห็นทั้ง a1 และ a2 ผ่าน s2 ส่วนผู้ที่ขอ s1 ก็ยังเห็น 2 แถวเดิม'],
        ],
      },
      merge: {
        title: 'MERGE INTO: แก้ 1 แถวกับเพิ่ม 1 แถว ได้ไฟล์ข้อมูลใหม่ 1 ไฟล์ และ Manifest ที่บอกว่าไฟล์เก่าถูกลบ',
        sql: "MERGE INTO lab.db.orders t USING src s ON t.order_id = s.order_id\nWHEN MATCHED THEN UPDATE SET t.amount = s.amount\nWHEN NOT MATCHED THEN INSERT *    -- src: (2, 'bob', 95.0) และ (5, 'dan', 10.0)",
        steps: [
          ['1. หาไฟล์ที่มี order ที่ต้องแก้', 'Order 2 อยู่ใน a1 (a1 มี Order 1 และ 2) ส่วน a2 มีแค่ Order 3 และ 4 จึงไม่ต้องเขียนใหม่ ส่วน Order 5 เป็นแถวใหม่'],
          ['2. เขียนไฟล์ข้อมูลใหม่แทน a1', 'โหมดเริ่มต้นเป็น Copy-on-write Spark อ่าน a1 แก้ Amount ของ Order 2 เป็น 95 และเติม Order 5 เข้าไป แล้วเขียนเป็นไฟล์ใหม่ a3 (3 แถว) ส่วน a1 ยังอยู่บน Disk เหมือนเดิม'],
          ['3. เขียน Manifest สองไฟล์', 'm3 บอกว่า a3 ถูกเพิ่ม (ADDED) ส่วน m4 บอกว่า a1 ถูกลบ (DELETED) ส่วน m2 ที่ลิสต์ a2 ไม่ต้องแตะ'],
          ['4. เขียน Manifest List ใหม่', 's3 ชี้ที่ m3, m2 (ใช้ซ้ำ) และ m4 โดยไม่มี m1 แล้ว เพราะ a1 ที่อยู่ใน m1 ถูกแทนที่ด้วย a3'],
          ['5. เขียน metadata.json ฉบับใหม่', 'v4 เพิ่ม Snapshot s3 ที่มี operation เป็น overwrite Catalog ยังชี้ v3'],
          ['6. เปลี่ยนตัวชี้ใน Catalog', 'Catalog เปลี่ยนจาก v3 เป็น v4 ผู้อ่านเห็น a3 กับ a2 รวม 5 แถว ส่วน a1 ไม่อยู่ในตารางอีกแล้ว แต่ s1 กับ s2 ยังชี้ไปที่ a1 ได้'],
        ],
      },
      select: {
        title: 'SELECT ... WHERE amount > 200: Spark เปิดไฟล์ข้อมูลกี่ไฟล์ จากไฟล์ที่ยังใช้อยู่ 2 ไฟล์',
        sql: "SELECT * FROM lab.db.orders WHERE amount > 200",
        steps: [
          ['1. ถาม Catalog', 'Catalog บอกว่าตารางชี้ที่ v4'],
          ['2. เปิด metadata.json และเลือก Snapshot', 'ใน v4 ฟิลด์ current-snapshot-id คือ s3 ถ้าไม่ได้ขอย้อนเวลา Spark ใช้ Snapshot นี้'],
          ['3. อ่าน Manifest List', 's3 ลิสต์ Manifest สามไฟล์ คือ m3, m2 และ m4'],
          ['4. อ่าน Manifest แล้วตัดไฟล์ด้วยค่าต่ำสุดสูงสุด', 'm4 มีแต่ไฟล์ที่ถูกลบ จึงไม่มีอะไรให้อ่าน ส่วน a3 มี Amount สูงสุด 120 ซึ่งไม่ถึง 200 จึงข้ามได้ แต่ a2 มี Amount สูงสุด 300 ซึ่งอาจมีแถวที่ต้องการ'],
          ['5. เปิดเฉพาะไฟล์ที่เหลือ', 'Spark เปิดแค่ a2 และได้ Order 4 (300.0) จากไฟล์ข้อมูลที่ยังใช้อยู่ 2 ไฟล์ เปิดจริงเพียงไฟล์เดียว เพราะ Spark ตัดสินใจจาก Manifest ได้โดยไม่ต้องเปิดไฟล์ a3'],
        ],
      },
      travel: {
        title: 'ย้อนเวลา: ขอ Snapshot s1 ทั้งที่ตารางตอนนี้อยู่ที่ s3 แล้วดูว่า Spark เดินไปทางไหน',
        sql: "SELECT * FROM lab.db.orders VERSION AS OF <snapshot-id ของ s1>",
        steps: [
          ['1. เปิด metadata.json ฉบับปัจจุบัน', 'v4 เก็บรายการ Snapshot ทุกตัวที่ยังไม่ถูกลบ ได้แก่ s1, s2 และ s3'],
          ['2. เลือก Snapshot ที่ขอ', 'เราขอ s1 ตรง ๆ Spark เลยไม่ใช้ s3 ซึ่งเป็น Snapshot ปัจจุบัน'],
          ['3. เดินจาก s1 ลงไป', 's1 ชี้ m1 และ m1 ลิสต์ a1 ไฟล์เหล่านี้ยังอยู่บน Disk เพราะยังไม่มีใครลบ'],
          ['4. อ่าน a1', 'ได้ 2 แถวเหมือนตอนหลัง INSERT ครั้งแรก ทั้งที่ตารางตอนนี้มี 5 แถว เพราะ Snapshot เก่าก็คือรายการไฟล์ชุดเก่านั่นเอง'],
        ],
      },
      compact: {
        title: 'Compaction: รวม a2 กับ a3 เป็นไฟล์เดียว ข้อมูลเท่าเดิมแต่ไฟล์ข้อมูลเหลือ 1 ไฟล์',
        sql: "CALL lab.system.rewrite_data_files(table => 'db.orders', options => map('min-input-files','2'))",
        steps: [
          ['1. เลือกไฟล์เล็กที่จะรวม', 'ตอนนี้ไฟล์ข้อมูลที่ใช้อยู่มี a2 (2 แถว) กับ a3 (3 แถว) Spark เลือกทั้งสองเพราะเราตั้ง min-input-files เป็น 2'],
          ['2. เขียนไฟล์ที่รวมแล้ว', 'a4 มี 5 แถว ซึ่งเท่ากับ a2 กับ a3 รวมกัน ส่วน a2 และ a3 ยังอยู่บน Disk'],
          ['3. เขียน Manifest สามไฟล์', 'm5 บอกว่า a4 ถูกเพิ่ม m6 บอกว่า a3 ถูกลบ และ m7 บอกว่า a2 ถูกลบ'],
          ['4. เขียน Manifest List ใหม่', 's4 ชี้ที่ m5, m6 และ m7 โดย operation ของ Snapshot นี้คือ replace เพราะข้อมูลเหมือนเดิมแต่เปลี่ยนไฟล์'],
          ['5. เขียน metadata.json ฉบับใหม่', 'v5 เพิ่ม Snapshot s4 Catalog ยังชี้ v4'],
          ['6. เปลี่ยนตัวชี้ใน Catalog', 'Catalog เปลี่ยนจาก v4 เป็น v5 ผู้อ่านใหม่เปิดแค่ a4 แต่ a1 ถึง a3 ยังอยู่บน Disk เพราะ Snapshot เก่ายังชี้ไป จนกว่าเราจะ Expire Snapshot'],
        ],
      },
    },
    names: {
      cowDelete: ['หาไฟล์', 'ไฟล์ใหม่', 'Manifest', 'Manifest List', 'สารบัญใหม่', 'เปลี่ยนตัวชี้'],
      morDelete: ['หาตำแหน่ง', 'ไฟล์ลบ', 'Manifest', 'Manifest List', 'สารบัญใหม่', 'เปลี่ยนตัวชี้'],
      morUpdate: ['หา Row', 'ไฟล์ข้อมูลใหม่', 'ไฟล์ลบใหม่', 'Manifest', 'Manifest List', 'สารบัญใหม่', 'เปลี่ยนตัวชี้'],
      morSelect: ['Catalog', 'สารบัญ', 'Manifest List', 'Manifest', 'อ่านและกรอง'],
      morCompact: ['เลือกไฟล์', 'ไฟล์ที่กรองแล้ว', 'Manifest', 'Manifest List', 'สารบัญใหม่', 'เปลี่ยนตัวชี้'],
      morClean: ['หาไฟล์ลบ', 'Manifest', 'Manifest List', 'สารบัญใหม่', 'เปลี่ยนตัวชี้'],
      create: ['คำสั่ง', 'เขียนสารบัญ', 'บอก Catalog'],
      insert1: ['อ่านตาราง', 'ไฟล์ข้อมูล', 'Manifest', 'Manifest List', 'สารบัญใหม่', 'เปลี่ยนตัวชี้'],
      insert2: ['อ่านตาราง', 'ไฟล์ข้อมูล', 'Manifest', 'Manifest List', 'สารบัญใหม่', 'เปลี่ยนตัวชี้'],
      merge: ['หาไฟล์', 'ไฟล์ข้อมูลใหม่', 'Manifest', 'Manifest List', 'สารบัญใหม่', 'เปลี่ยนตัวชี้'],
      select: ['Catalog', 'สารบัญ', 'Manifest List', 'Manifest', 'ไฟล์ข้อมูล'],
      travel: ['สารบัญ', 'เลือก Snapshot', 'เดินลง', 'อ่านไฟล์'],
      compact: ['เลือกไฟล์', 'ไฟล์ที่รวม', 'Manifest', 'Manifest List', 'สารบัญใหม่', 'เปลี่ยนตัวชี้'],
    },
    caption: 'ค่าทุกค่าในตารางใต้ภาพอ่านจากไฟล์จริงด้วย exercises/15_under_the_covers.py และ exercises/16_cow_mor_in_depth.py ชื่อ a1, m1, s1, v1 เป็นชื่อย่อแทนชื่อไฟล์ยาว ๆ ที่มี UUID ลำดับชั้นและลำดับขั้นของการเขียนตามหนังสือ Apache Iceberg: The Definitive Guide บทที่ 2 หน้า 29 และบทที่ 3 หน้า 46',
  },
  en: {
    legendWrite: ['written in this step', 'already there and part of this step', 'not written yet'],
    legendRead: ['opened by Spark', 'cut out, not opened', 'not reached yet (faded)'],
    cols: [['Shelf label', 'Catalog'], ['Table of contents', 'metadata.json'], ['List of a snapshot', 'Manifest list'], ['List of files', 'Manifest'], ['The pages', 'Data file']],
    layers: ['Catalog', 'Metadata', 'Data'],
    dTitle: (n) => `Delete file ${n}`, mdTitle: (n) => `Delete list ${n}`, pos: (n) => `${n} position${n === 1 ? '' : 's'}`, colsDel: ['Data / delete file', 'Data / Delete'],
    vTitle: (n) => `Contents ${n}`, sTitle: (n) => `Snapshot ${n}`, mTitle: (n) => `File list ${n}`, aTitle: (n) => `Data file ${n}`,
    rows: (n) => `${n} row${n === 1 ? '' : 's'}`, nMan: (n) => `${n} manifest${n === 1 ? '' : 's'}`, none: 'none yet', leftTag: 'left over', newTag: 'new', reusedTag: 'reused', catalog: 'Catalog',
    click: 'Click a box in the picture to see what is inside that file. Every value is read from the files Spark really wrote.',
    fields: 'Inside the file', field: 'Field', value: 'Value', means: 'Means', sqlLabel: 'Statement',
    panel: {
      md: 'Manifest of delete files', d: 'A position delete file (Parquet)', contentData: '0 = a manifest of data files', contentDel: '1 = a manifest of delete files', entryD: 'One delete file', recordPos: 'Positions this file says to skip',
      cat: 'The table’s row in the catalog', v: 'A metadata.json file', s: 'Manifest list of a snapshot', m: 'A manifest', a: 'A data file (Parquet)',
      table_name: 'The table name the catalog knows', metadata_location: 'The pointer: the current table of contents', previous_metadata_location: 'The previous table of contents',
      'format-version': 'Spec version (this table uses v2)', 'last-sequence-number': 'Sequence number of the latest commit', 'current-snapshot-id': 'The snapshot a reader sees now',
      snapshots: 'Every snapshot still kept', 'metadata-log': 'Earlier tables of contents that were current once', schema: 'Columns with field ids (ids stay even if a name changes)',
      'snapshot-id': 'The snapshot’s id', 'parent-snapshot-id': 'The snapshot before this one', 'sequence-number': 'Order of this commit', operation: 'Kind of change', summary: 'What this commit did',
      manifests: 'Manifests this snapshot points to (name: added / existing / deleted)', record_count: 'Rows in the file', file_size: 'Size of the file', 'sequence-no': 'Commit that wrote this manifest',
      entry: 'One data file', counts: 'Files added / existing / deleted', unreferenced: 'nothing refers to it yet', emptyV: 'empty, no snapshot yet', firstV: 'none (this is the first one)',
      ownerSnap: 'Written by snapshot', stat: 'Lowest..highest value of each column',
    },
    ops: {
      cowDelete: {
        title: 'DELETE in copy-on-write: remove 1 row of 5 and see what Spark writes',
        sql: "DELETE FROM lab.db.small_cow WHERE order_id = 3    -- the table uses the default mode, copy-on-write",
        steps: [
          ['1. Find the file with order 3', 'Order 3 is in a1, which has all 5 rows. The table sets no mode, so it uses the default, copy-on-write.'],
          ['2. Write the file without order 3', 'Spark reads the whole of a1, drops order 3 and writes the 4 remaining rows as a new file a2. Removing one row means writing a whole new file.'],
          ['3. Write two manifests', 'm2 says a2 was added (ADDED) and m3 says a1 was deleted (DELETED).'],
          ['4. Write a new manifest list', 's2 points to m2 and m3. There is no m1 any more, because a1, which was in m1, is replaced by a2.'],
          ['5. Write the new metadata.json', 'v3 adds snapshot s2 whose operation is overwrite. The catalog still points to v2.'],
          ['6. Change the pointer in the catalog', 'Readers see 4 rows in one file and can read it as it is, with nothing to filter. But we wrote 4 new rows to remove 1.'],
        ],
      },
      morDelete: {
        title: 'DELETE in merge-on-read: remove the row with a small delete file, the data file is not touched',
        sql: "DELETE FROM lab.db.small_mor WHERE order_id = 3    -- the table is set to merge-on-read",
        steps: [
          ['1. Find the position of order 3', 'Spark must know the position of this row in a1, so it reads a1 and gets position 2 (counting from 0). This is the write-side cost of a position delete file.'],
          ['2. Write the delete file', 'd1 is a small Parquet file with one row: the name of data file a1 and position 2. The file a1 is not touched.'],
          ['3. Write a manifest for delete files', 'm2 is a manifest of delete files (content = 1), separate from the manifests of data files. It says d1 was added.'],
          ['4. Write a new manifest list', 's2 points to m1 (reused, still lists a1) and m2 (lists d1). The operation of this snapshot is delete.'],
          ['5. Write the new metadata.json', 'v3 adds snapshot s2. The catalog still points to v2.'],
          ['6. Change the pointer in the catalog', 'a1 still holds 5 rows in the file, but a reader must filter it with d1 first, so it sees 4 rows.'],
        ],
      },
      morUpdate: {
        title: 'UPDATE in merge-on-read: delete the old row with a delete file, write the new row as a small data file',
        sql: "UPDATE lab.db.small_mor SET amount = 11.0 WHERE order_id = 5",
        steps: [
          ['1. Find the row to change', 'Order 5 is at position 4 of a1, and a1 already has a delete file d1 from the earlier DELETE (position 2).'],
          ['2. Write the new row as a data file', 'a2 has 1 row, order 5 with amount 11.0. An UPDATE in merge-on-read is a delete of the old row and a write of the new one.'],
          ['3. Write a new delete file that holds the old one', 'd2 has 2 positions: position 2 (order 3, deleted earlier) and position 4 (order 5). Spark folded the positions of d1 into d2, so that a1 has only one delete file.'],
          ['4. Write three manifests', 'm3 says a2 was added, m4 says d2 was added and m5 says d1 was deleted (DELETED) because d2 replaced it.'],
          ['5. Write a new manifest list', 's3 points to m3, m1 (reused), m4 and m5.'],
          ['6. Write the new metadata.json', 'v4 adds snapshot s3 whose operation is overwrite, because it both added files and replaced one.'],
          ['7. Change the pointer in the catalog', 'Readers see a2 (1 row) and a1 filtered with d2 (3 rows left), 4 rows in all.'],
        ],
      },
      morSelect: {
        title: 'SELECT on a merge-on-read table: the reader has to filter the data files with the delete files itself',
        sql: "SELECT * FROM lab.db.small_mor",
        steps: [
          ['1. Ask the catalog', 'The catalog says the table points to v4.'],
          ['2. Open metadata.json and choose a snapshot', 'In v4 the current snapshot is s3.'],
          ['3. Read the manifest list', 's3 lists four manifests: m3, m1, m4 and m5.'],
          ['4. Read the manifests', 'm5 holds only the deleted d1, so it can be skipped. The others say there are data files a2 and a1, and a delete file d2 that applies to a1.'],
          ['5. Read the data files and filter with the delete file', 'a2 is read as it is, 1 row. a1 has 5 rows but d2 says to skip positions 2 and 4, so 3 rows are left. That gives 4 rows, the same as SELECT count (PyIceberg also sees that it needs d2 with a1).'],
        ],
      },
      morCompact: {
        title: 'Compaction on a merge-on-read table: new data files without the deleted rows, but the delete file stays behind',
        sql: "CALL lab.system.rewrite_data_files(table => 'db.small_mor', options => map('delete-file-threshold','1','min-input-files','1'))",
        steps: [
          ['1. Choose the files to rewrite', 'a1 has a delete file d2, which reaches the delete-file-threshold we set to 1. Spark rewrites a1 together with a2 (rewritten_data_files_count is 2).'],
          ['2. Write the filtered file', 'Spark reads a1 while filtering it with d2, adds a2 and writes a3 with 4 rows. The deleted rows are not in the new file at all.'],
          ['3. Write three manifests', 'm6 says a3 was added, and m7 and m8 say a2 and a1 were deleted.'],
          ['4. Write a new manifest list', 's4 points to m6, m7, m8 and m4 (the manifest of d2, not touched, reused). The operation of the snapshot is replace.'],
          ['5. Write the new metadata.json', 'v5 adds snapshot s4. The catalog still points to v4.'],
          ['6. Change the pointer in the catalog', 'New readers open only a3, with no filtering, but d2 is still in the snapshot (total-delete-files is still 1) although no data file needs it any more. That is why removed_delete_files_count is 0.'],
        ],
      },
      morClean: {
        title: 'Cleaning up a delete file that nobody uses (a dangling delete): no data file is rewritten',
        sql: "CALL lab.system.rewrite_data_files(table => 'db.small_mor', options => map('remove-dangling-deletes','true','min-input-files','100'))",
        steps: [
          ['1. Find a delete file with no data file left', 'd2 points to a1, which is not in the current snapshot any more. Such a delete file is called dangling. The option remove-dangling-deletes is off by default, so we have to turn it on.'],
          ['2. Write a manifest that says d2 is deleted', 'm9 lists d2 as DELETED. No data file is written (rewritten_data_files_count is 0) and m6, which lists a3, is not touched.'],
          ['3. Write a new manifest list', 's5 points to m6 (reused) and m9.'],
          ['4. Write the new metadata.json', 'v6 adds snapshot s5. The catalog still points to v5.'],
          ['5. Change the pointer in the catalog', 'total-delete-files is 0. The table has one data file, a3, and no delete file.'],
        ],
      },
      create: {
        title: 'CREATE TABLE: even an empty table has one file. Press Next, then click a box to look inside the file',
        sql: "CREATE TABLE lab.db.orders (order_id bigint, customer string, amount double) USING iceberg",
        steps: [
          ['1. Spark sends CREATE TABLE', 'Spark checks with the catalog that db.orders does not exist, then prepares a schema that gives every column a field id (order_id is 1, customer is 2, amount is 3). There is no new file yet.'],
          ['2. Write the first metadata.json', 'File v1 holds the schema, the partition spec and an empty list of snapshots. An empty table has no data file, no manifest and no manifest list.'],
          ['3. Tell the catalog to point to it', 'The catalog adds a row for db.orders that points to v1. From here anyone who opens the table finds this file, and this is all the catalog remembers.'],
        ],
      },
      insert1: {
        title: 'The first INSERT: four new files are written, then one pointer changes in the catalog',
        sql: "INSERT INTO lab.db.orders VALUES (1, 'ann', 120.0), (2, 'bob', 80.5)",
        steps: [
          ['1. Spark reads the current table', 'Spark asks the catalog which file the table points to, gets v1 and reads the schema so it knows what shape of file to write.'],
          ['2. Write the data file', 'Spark writes a Parquet file a1 with 2 rows. No file says yet that the table has a1, so readers cannot see it.'],
          ['3. Write the manifest', 'Manifest m1 has one row per data file. That row holds the status ADDED, the number of rows and the lowest and highest value of every column.'],
          ['4. Write the manifest list', 'Manifest list s1 of the new snapshot points to m1 and says that this manifest added 1 file.'],
          ['5. Write the new metadata.json', 'v2 has everything v1 has and adds snapshot s1 as the current one. The catalog still points to v1, so readers see no change.'],
          ['6. Change the pointer in the catalog', 'The catalog changes v1 to v2 in one go. From now on readers see all four new files at the same moment. If this step fails, the files already written are only files that nothing refers to.'],
        ],
      },
      insert2: {
        title: 'The second INSERT: the manifest of the first one is reused, not written again',
        sql: "INSERT INTO lab.db.orders VALUES (3, 'ann', 42.0), (4, 'cara', 300.0)",
        steps: [
          ['1. Spark reads the current table', 'The catalog points to v2, which already has snapshot s1. Spark opens it to know the schema.'],
          ['2. Write a new data file', 'Spark writes a2 with orders 3 and 4. The file a1 of the first insert is not touched.'],
          ['3. Write a new manifest', 'Manifest m2 lists only a2. Manifest m1, which lists a1, is not changed. These files are never edited after they are written.'],
          ['4. Write a new manifest list', 's2 points to m2 (new) and to m1 (old, reused). That is why the second commit does not rewrite a list of all the files of the table.'],
          ['5. Write the new metadata.json', 'v3 keeps snapshots s1 and s2, and s2 is the current one. The catalog still points to v2.'],
          ['6. Change the pointer in the catalog', 'The catalog changes v2 to v3. Readers see a1 and a2 through s2, and anyone who asks for s1 still sees the original 2 rows.'],
        ],
      },
      merge: {
        title: 'MERGE INTO: change 1 row and add 1 row. The result is a new data file and a manifest that says the old file is deleted',
        sql: "MERGE INTO lab.db.orders t USING src s ON t.order_id = s.order_id\nWHEN MATCHED THEN UPDATE SET t.amount = s.amount\nWHEN NOT MATCHED THEN INSERT *    -- src: (2, 'bob', 95.0) and (5, 'dan', 10.0)",
        steps: [
          ['1. Find the file with the order to change', 'Order 2 is in a1 (a1 has orders 1 and 2). a2 has only orders 3 and 4, so it does not need to be rewritten. Order 5 is a new row.'],
          ['2. Write a new data file in place of a1', 'The default mode is copy-on-write. Spark reads a1, sets the amount of order 2 to 95, adds order 5 and writes everything as a new file a3 (3 rows). a1 stays on disk as it was.'],
          ['3. Write two manifests', 'm3 says that a3 was added (ADDED) and m4 says that a1 was deleted (DELETED). m2, which lists a2, is not touched.'],
          ['4. Write a new manifest list', 's3 points to m3, m2 (reused) and m4. There is no m1 any more, because a1, which was in m1, is replaced by a3.'],
          ['5. Write the new metadata.json', 'v4 adds snapshot s3, whose operation is overwrite. The catalog still points to v3.'],
          ['6. Change the pointer in the catalog', 'The catalog changes v3 to v4. Readers see a3 and a2, 5 rows in all, and a1 is no longer part of the table, but s1 and s2 can still reach a1.'],
        ],
      },
      select: {
        title: 'SELECT ... WHERE amount > 200: how many data files does Spark open, out of the 2 files still in use?',
        sql: "SELECT * FROM lab.db.orders WHERE amount > 200",
        steps: [
          ['1. Ask the catalog', 'The catalog says the table points to v4.'],
          ['2. Open metadata.json and choose a snapshot', 'In v4 the field current-snapshot-id is s3. Without a time-travel request Spark uses this snapshot.'],
          ['3. Read the manifest list', 's3 lists three manifests: m3, m2 and m4.'],
          ['4. Read the manifests and cut files by lowest and highest value', 'm4 holds only deleted files, so there is nothing to read. a3 has a highest amount of 120, which is below 200, so it can be skipped. a2 has a highest amount of 300 and may hold the rows we want.'],
          ['5. Open only the files that are left', 'Spark opens only a2 and gets order 4 (300.0). Of the 2 data files in use only one is opened, and Spark decided that from a manifest without opening a3.'],
        ],
      },
      travel: {
        title: 'Time travel: ask for snapshot s1 although the table is at s3 now, and see which way Spark walks',
        sql: "SELECT * FROM lab.db.orders VERSION AS OF <snapshot id of s1>",
        steps: [
          ['1. Open the current metadata.json', 'v4 keeps the list of every snapshot that has not been removed: s1, s2 and s3.'],
          ['2. Choose the snapshot that was asked for', 'We asked for s1 directly, so Spark does not use s3, the current snapshot.'],
          ['3. Walk down from s1', 's1 points to m1, and m1 lists a1. These files are still on disk because nobody removed them.'],
          ['4. Read a1', 'We get 2 rows, as right after the first INSERT, although the table has 5 rows now. An old snapshot is just an older set of file lists.'],
        ],
      },
      compact: {
        title: 'Compaction: merge a2 and a3 into one file. The data is the same, but there is one data file instead of two',
        sql: "CALL lab.system.rewrite_data_files(table => 'db.orders', options => map('min-input-files','2'))",
        steps: [
          ['1. Choose the small files to merge', 'The data files in use are a2 (2 rows) and a3 (3 rows). Spark picks both because we set min-input-files to 2.'],
          ['2. Write the merged file', 'a4 has 5 rows, the rows of a2 and a3 together. a2 and a3 stay on disk.'],
          ['3. Write three manifests', 'm5 says a4 was added, m6 says a3 was deleted and m7 says a2 was deleted.'],
          ['4. Write a new manifest list', 's4 points to m5, m6 and m7. The operation of this snapshot is replace, because the data is the same and only the files changed.'],
          ['5. Write the new metadata.json', 'v5 adds snapshot s4. The catalog still points to v4.'],
          ['6. Change the pointer in the catalog', 'The catalog changes v4 to v5. New readers open only a4, but a1 to a3 are still on disk because old snapshots point to them, until we expire those snapshots.'],
        ],
      },
    },
    names: {
      cowDelete: ['Find file', 'New file', 'Manifests', 'Manifest list', 'New contents', 'Swap pointer'],
      morDelete: ['Find position', 'Delete file', 'Manifest', 'Manifest list', 'New contents', 'Swap pointer'],
      morUpdate: ['Find row', 'New data file', 'New delete file', 'Manifests', 'Manifest list', 'New contents', 'Swap pointer'],
      morSelect: ['Catalog', 'Contents', 'Manifest list', 'Manifests', 'Read and filter'],
      morCompact: ['Pick files', 'Filtered file', 'Manifests', 'Manifest list', 'New contents', 'Swap pointer'],
      morClean: ['Find delete file', 'Manifest', 'Manifest list', 'New contents', 'Swap pointer'],
      create: ['Statement', 'Write contents', 'Tell catalog'],
      insert1: ['Read table', 'Data file', 'Manifest', 'Manifest list', 'New contents', 'Swap pointer'],
      insert2: ['Read table', 'Data file', 'Manifest', 'Manifest list', 'New contents', 'Swap pointer'],
      merge: ['Find file', 'New data file', 'Manifests', 'Manifest list', 'New contents', 'Swap pointer'],
      select: ['Catalog', 'Contents', 'Manifest list', 'Manifests', 'Data file'],
      travel: ['Contents', 'Pick snapshot', 'Walk down', 'Read file'],
      compact: ['Pick files', 'Merged file', 'Manifests', 'Manifest list', 'New contents', 'Swap pointer'],
    },
    caption: 'Every value in the table under the picture is read from real files by exercises/15_under_the_covers.py and exercises/16_cow_mor_in_depth.py. The names a1, m1, s1, v1 are short for the long file names with a UUID. The layers and the order of the writing follow the book Apache Iceberg: The Definitive Guide, chapter 2 page 29 and chapter 3 page 46.',
  },
};

// ---- geometry -----------------------------------------------------------------------------------------------------------------------
const X = { cat: 8, v: 148, s: 336, m: 534, a: 722 };
const W = { cat: 100, v: 148, s: 158, m: 148, a: 150 };
const TOP = 66;
const ROW = 62;
const NH = 50;
const y = (i: number) => TOP + i * ROW;
const cy = (i: number) => y(i) + NH / 2;
const curve = (x1: number, y1: number, x2: number, y2: number) => `M${x1},${y1} C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}`;

// ---- what is inside a file (read from the json) -------------------------------------------------------------------------------------
const num = (n: number) => (Number.isInteger(n) ? n.toFixed(1) : String(n));
const sum = (s: Snapshot) => Object.entries(s.summary).map(([k, v]) => `${k}=${v}`).join(', ');

interface Info { name: string; kind: string; rows: [string, string, string][]; table?: { head: string[]; rows: (string | number)[][] } }

function inspect(id: string, T: Text, ptr: string | null, prev: string | null, d: D): Info {
  const P = T.panel;
  if (id === 'cat') {
    return { name: T.catalog, kind: P.cat, rows: [['table_name', d.table, P.table_name], ['metadata_location', ptr ? `${ptr}.metadata.json` : '—', P.metadata_location], ['previous_metadata_location', prev ? `${prev}.metadata.json` : '—', P.previous_metadata_location]] };
  }
  if (id[0] === 'v') {
    const st = d.stateOfV(id);
    const cur = st.snapshots.find((s) => s.name === st.current);
    return {
      name: `${id}.metadata.json`, kind: P.v,
      rows: [
        ['format-version', String(st['format-version']), P['format-version']],
        ['last-sequence-number', String(st['last-sequence-number']), P['last-sequence-number']],
        ['schema', 'order_id (1), customer (2), amount (3)', P.schema],
        ['current-snapshot-id', cur ? `${cur.name}  (${cur.id})` : P.emptyV, P['current-snapshot-id']],
        ['snapshots', st.snapshots.length ? st.snapshots.map((s) => s.name).join(', ') : '[ ]', P.snapshots],
        ['metadata-log', st.versions.length > 1 ? st.versions.slice(0, -1).join(', ') : '[ ]', P['metadata-log']],
      ],
    };
  }
  if (id[0] === 's') {
    const s = d.snapByName(id);
    return {
      name: `${id}  (snap-….avro)`, kind: P.s,
      rows: [
        ['snapshot-id', s.id, P['snapshot-id']],
        ['parent-snapshot-id', s.parent ? `${d.snapById(s.parent)?.name ?? ''}  (${s.parent})` : '—', P['parent-snapshot-id']],
        ['sequence-number', String(s.seq), P['sequence-number']],
        ['operation', s.operation, P.operation],
        ['summary', sum(s), P.summary],
        ['manifests', s.manifests.map((m) => `${m.name}${m.content === 1 ? ' (delete)' : ''}: ${m.added} / ${m.existing} / ${m.deleted}`).join('  ·  '), P.manifests],
      ],
    };
  }
  if (id[0] === 'm') {
    const m = d.manifestByName(id);
    const owner = d.states[d.states.length - 1].snapshots.find((s) => s.manifests.some((x) => x.name === id && x.seq === s.seq));
    const del = m.content === 1;
    const rows: [string, string, string][] = [
      ['content', del ? '1' : '0', del ? P.contentDel : P.contentData],
      ['sequence-number', String(m.seq), P['sequence-no']],
      ['added / existing / deleted', `${m.added} / ${m.existing} / ${m.deleted}`, P.counts],
    ];
    m.entries.forEach((e) => {
      if (e.content === 1) {
        rows.push([`status = ${e.status}`, `${e.file}  (${T.pos(e.records)})`, P.entryD]);
      } else {
        rows.push([`status = ${e.status}`, `${e.file}  (${T.rows(e.records)})`, P.entry]);
        if (e.order_id && e.customer && e.amount) {
          rows.push(['order_id', `${e.order_id[0]} .. ${e.order_id[1]}`, P.stat]);
          rows.push(['customer', `${e.customer[0]} .. ${e.customer[1]}`, '']);
          rows.push(['amount', `${num(e.amount[0])} .. ${num(e.amount[1])}`, '']);
        }
      }
    });
    return { name: `${id}  (….-m0.avro)`, kind: (del ? P.md : P.m) + (owner ? `  ·  ${P.ownerSnap} ${owner.name}` : ''), rows };
  }
  const e = d.entryOf(id);
  if (e.content === 1) {
    return {
      name: `${id}  (….parquet)`, kind: P.d,
      rows: [['record_count', String(e.records), P.recordPos], ['file_size', `${e.bytes} bytes`, P.file_size]],
      table: { head: ['file_path', 'pos'], rows: e.rows.map((r) => [String(r[0]), r[1]]) },
    };
  }
  return {
    name: `${id}  (….parquet)`, kind: P.a,
    rows: [['record_count', String(e.records), P.record_count], ['file_size', `${e.bytes} bytes`, P.file_size]],
    table: { head: ['order_id', 'customer', 'amount'], rows: e.rows.map((r) => [r[0], r[1], num(r[2] as number)]) },
  };
}

// the boxes of one step: the snapshots, the manifests of the drawn snapshot and the files they list
function shape(sp: Sp, d: D) {
  const snap = sp.snap ? d.snapByName(sp.snap) : null;
  const snapIds = sp.snaps ?? (snap ? [snap.name] : []);
  const mans = snap ? snap.manifests : [];
  const dataIds: string[] = [];
  mans.forEach((m) => m.entries.forEach((e) => { if (!dataIds.includes(e.file)) dataIds.push(e.file); }));
  return { snap, snapIds, mans, dataIds };
}

// ---- component ----------------------------------------------------------------------------------------------------------------------
export default function UnderCoversLab({ op = 'insert1', lang = 'th' }: { op?: Op; lang?: Lang }) {
  const T = TEXT[lang];
  const O = T.ops[op];
  const spec = SPEC[op];
  const d = DS[spec.ds];
  const infos = O.steps.map(([title, text], i) => ({ name: T.names[op][i], title, text }));
  const { step, go, playing, toggle } = useStepper(infos.length, 5200);
  const [pick, setPick] = useState<{ step: number; id: string } | null>(null);
  const sp = spec.steps[step];
  const state = d.states[spec.state];
  const cols = spec.ds === 'uc' ? T.cols : [...T.cols.slice(0, 4), T.colsDel];

  // tree drawn in this step, and the number of rows the tallest step needs (the picture keeps one height)
  const { snap, snapIds, mans, dataIds } = shape(sp, d);
  const R = Math.max(3, ...spec.steps.map((x) => { const h = shape(x, d); return Math.max(h.snapIds.length, h.mans.length, h.dataIds.length, x.metas.length); }));
  const status = (a: string) => mans.flatMap((m) => m.entries).find((e) => e.file === a)!.status;

  const written = (id: string) => (sp.w ? sp.w.includes(id) : true);
  const has = (list: string[] | undefined, id: string) => !!list && list.includes(id);
  const stateOf = (id: string): NodeState => {
    if (spec.read) return has(sp.use, id) ? 'use' : has(sp.skip, id) ? 'skip' : 'node';
    if (has(sp.nw, id)) return 'new';
    if (!written(id)) return 'skip';
    return has(sp.use, id) ? 'use' : 'node';
  };
  const dimmed = (id: string) => (spec.read ? !has(sp.use, id) && !has(sp.skip, id) : has(sp.dim, id));

  // positions
  const posV = (id: string) => sp.metas.indexOf(id);
  const posS = (id: string) => snapIds.indexOf(id);
  const posM = (id: string) => mans.findIndex((m) => m.name === id);
  const posA = (id: string) => dataIds.indexOf(id);

  // inspector
  const selId = pick && pick.step === step ? pick.id : sp.sel ?? 'cat';
  const prevPtr = state.versions.length > 1 && sp.ptr ? state.versions[state.versions.indexOf(sp.ptr) - 1] ?? null : null;
  const info = inspect(selId, T, sp.ptr, prevPtr, d);

  const clickable = (id: string, child: ReactNode) => (
    <g key={id} role="button" tabIndex={0} style={{ cursor: 'pointer' }} aria-label={id} onClick={() => setPick({ step, id })}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPick({ step, id }); } }}>
      {child}
    </g>
  );
  const ring = (x: number, yy: number, w: number) => <rect className="ib-sel" x={x - 5} y={yy - 5} width={w + 10} height={NH + 10} rx={13} />;

  // lines
  const lines: { key: string; d: string; on: boolean }[] = [];
  if (sp.ptr && posV(sp.ptr) >= 0) {
    lines.push({ key: 'cat', d: curve(X.cat + W.cat, cy(0), X.v, cy(posV(sp.ptr))), on: true });
  }
  const top = sp.metas[sp.metas.length - 1];
  snapIds.forEach((s) => {
    const owner = d.stateOfV(top).snapshots.some((x) => x.name === s);
    if (owner && written(top) && written(s)) lines.push({ key: `vs${s}`, d: curve(X.v + W.v, cy(posV(top)), X.s, cy(posS(s))), on: spec.read ? has(sp.use, s) && has(sp.use, top) : has(sp.nw, s) || has(sp.nw, top) || has(sp.use, s) });
  });
  if (snap) {
    mans.forEach((m) => {
      if (written(snap.name) && written(m.name)) lines.push({ key: `sm${m.name}`, d: curve(X.s + W.s, cy(posS(snap.name)), X.m, cy(posM(m.name))), on: spec.read ? has(sp.use, snap.name) && has(sp.use, m.name) : has(sp.nw, snap.name) || has(sp.nw, m.name) || has(sp.use, m.name) });
      m.entries.forEach((e) => {
        if (written(m.name) && written(e.file)) lines.push({ key: `ma${m.name}${e.file}`, d: curve(X.m + W.m, cy(posM(m.name)), X.a, cy(posA(e.file))), on: spec.read ? has(sp.use, m.name) && has(sp.use, e.file) : has(sp.nw, m.name) || has(sp.nw, e.file) || has(sp.use, e.file) });
      });
    });
  }

  const legend = spec.read ? T.legendRead : T.legendWrite;
  const legendItems = spec.read
    ? [{ kind: 'use' as const, text: legend[0] }, { kind: 'skip' as const, text: legend[1] }, { kind: 'node' as const, text: legend[2] }]
    : [{ kind: 'new' as const, text: legend[0] }, { kind: 'use' as const, text: legend[1] }, { kind: 'skip' as const, text: legend[2] }];

  const catSub = sp.ptr ? `→ ${sp.ptr}` : `→ ${T.none}`;
  const bannerY = y(R) + 12;

  return (
    <figure className="viz">
      <div className="viz-title">{O.title}</div>
      <pre className="ib-sql" aria-label={T.sqlLabel}>{O.sql}</pre>
      <Legend items={legendItems} />
      <div className="viz-box">
        <svg viewBox={`0 0 880 ${bannerY + 56}`} role="img" aria-label={O.title}>
          <rect className="ib-zone" x={2} y={52} width={114} height={y(R) - 52} rx={10} />
          <rect className="ib-zone" x={118} y={52} width={598} height={y(R) - 52} rx={10} />
          <rect className="ib-zone" x={718} y={52} width={160} height={y(R) - 52} rx={10} />
          {[X.cat, X.v, X.s, X.m, X.a].map((x, i) => (
            <g key={x}>
              <text x={x} y={22} className="ib-n">{cols[i][0]}</text>
              <text x={x} y={42} className="ib-m">{cols[i][1]}</text>
            </g>
          ))}

          {lines.map((l) => <path key={l.key} className="ib-line" d={l.d} style={{ stroke: l.on ? 'var(--accent)' : 'var(--line-strong)', strokeWidth: l.on ? 3.5 : 2, opacity: l.on ? 1 : 0.35 }} />)}

          {clickable('cat', (
            <g>
              {selId === 'cat' && ring(X.cat, y(0), W.cat)}
              <Node x={X.cat} y={y(0)} w={W.cat} h={NH} title={T.catalog} sub={catSub} state={sp.swap ? 'new' : 'use'} tag={sp.swap ? T.newTag : undefined} mono={false} />
            </g>
          ))}
          {sp.metas.map((v) => clickable(v, (
            <g>
              {selId === v && ring(X.v, y(posV(v)), W.v)}
              <Node x={X.v} y={y(posV(v))} w={W.v} h={NH} title={T.vTitle(v)} sub={`${v}.metadata.json`} state={stateOf(v)} dim={dimmed(v) && v !== sp.ptr}
                tag={has(sp.nw, v) ? T.newTag : undefined} />
            </g>
          )))}
          {snapIds.map((s) => clickable(s, (
            <g>
              {selId === s && ring(X.s, y(posS(s)), W.s)}
              <Node x={X.s} y={y(posS(s))} w={W.s} h={NH} title={T.sTitle(s)} sub={T.nMan(d.snapByName(s).manifests.length)} state={stateOf(s)} dim={dimmed(s)} mono={false}
                tag={has(sp.nw, s) ? T.newTag : undefined} />
            </g>
          )))}
          {mans.map((m) => clickable(m.name, (
            <g>
              {selId === m.name && ring(X.m, y(posM(m.name)), W.m)}
              <Node x={X.m} y={y(posM(m.name))} w={W.m} h={NH} title={m.content === 1 ? T.mdTitle(m.name) : T.mTitle(m.name)} sub={m.entries.map((e) => `${e.status} ${e.file}`).join(', ')}
                state={stateOf(m.name)} dim={dimmed(m.name)} tag={has(sp.nw, m.name) ? T.newTag : has(sp.reused, m.name) ? T.reusedTag : undefined} />
            </g>
          )))}
          {dataIds.map((a) => {
            const e = d.entryOf(a);
            const count = e.content === 1 ? T.pos(e.records) : T.rows(e.records);
            return clickable(a, (
              <g>
                {selId === a && ring(X.a, y(posA(a)), W.a)}
                <Node x={X.a} y={y(posA(a))} w={W.a} h={NH} title={e.content === 1 ? T.dTitle(a) : T.aTitle(a)} sub={status(a) === 'DELETED' ? `DELETED · ${count}` : count}
                  state={stateOf(a)} dim={dimmed(a)} mono={false} tag={has(sp.nw, a) ? T.newTag : has(sp.left, a) ? T.leftTag : undefined} />
              </g>
            ));
          })}

          <rect className="ib-banner" x={12} y={bannerY} width={856} height={46} rx={10} />
          <Lines x={26} y={bannerY + 29} text={O.steps[step][0]} max={80} className="ib-n" />
        </svg>
      </div>
      <StepControls steps={infos} step={step} playing={playing} go={go} toggle={toggle} lang={lang} />
      <div className="ib-inspect" aria-live="polite">
        <div className="ib-inspect-head"><b>{info.name}</b><span>{info.kind}</span></div>
        <table>
          <thead><tr><th>{T.field}</th><th>{T.value}</th><th>{T.means}</th></tr></thead>
          <tbody>{info.rows.map(([k, v, m], i) => <tr key={i}><td className="k">{k}</td><td className="v">{v}</td><td>{m}</td></tr>)}</tbody>
        </table>
        {info.table && (
          <table className="ib-rows">
            <thead><tr>{info.table.head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>{info.table.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
          </table>
        )}
        <div className="ib-inspect-hint">{T.click}</div>
      </div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
