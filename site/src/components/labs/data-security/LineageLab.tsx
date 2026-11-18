import { useState } from 'react';
import { Legend, wrapText } from '../iceberg/ib';
import type { Lang } from '../spark/stepper';
import data from './lifecycle.json';

// Shows:      the tables of a small platform and the lines along which data flows (users, orders and events feed a derived table, users feed a partner export, everything is copied to a backup).
//             Every table shows how many rows it holds about one user. Pick how the erasure request is handled and see which tables still hold the person.
// Because:    "delete the user" is a sentence about a graph. The people who handle it as a delete on one table leave the person in five others, and only a walk along the lines finds them.
// Control:    the handling (nothing, delete from users only, walk the lineage) and a switch for restoring the backup with the erasure log applied.
// Conclusion: erasure needs a map of where the data went. Live tables are cleaned by following the lines, and a backup is cleaned by an erasure log applied on restore.
//
// The row counts per table are those of exercises/10_lifecycle.py (lifecycle.json) for the user of the request.

type Mode = 'start' | 'naive' | 'lineage';
const PLACES = data.places as string[];
const EDGES = data.edges as Record<string, string[]>;
const COUNTS: Record<Mode, Record<string, number>> = { start: data.start, naive: data.naive, lineage: data.lineage } as never;

const POS: Record<string, [number, number]> = {
  users: [20, 40], consents: [20, 125], orders: [20, 210], events: [20, 295],
  customer_360: [330, 100], partner_export: [330, 240], backup: [640, 170],
};

const TEXT: Record<Lang, { title: string; mode: string; modes: Record<Mode, string>; restore: string; legend: { kind: 'new' | 'use' | 'skip' | 'node'; text: string }[]; rows: string; holds: string; clean: string; verdict: Record<Mode, string>; backup: string; backupHold: string; backupClean: string; source: string; derived: string; caption: string }> = {
  th: {
    title: 'เลือกวิธีจัดการคำขอลบข้อมูลของผู้ใช้หนึ่งคน แล้วดูว่าตารางไหนยังเก็บเขาอยู่',
    mode: 'วิธีจัดการ', modes: { start: 'ยังไม่ลบ', naive: 'ลบจากตาราง users อย่างเดียว', lineage: 'ไล่ตามเส้นทางของข้อมูล' }, restore: 'กู้ Backup แล้วใช้ Log การลบ',
    legend: [{ kind: 'new', text: 'ยังเก็บข้อมูลของคนนี้อยู่' }, { kind: 'use', text: 'ไม่เหลือแล้ว' }],
    rows: 'แถว', holds: 'ยังเก็บ', clean: 'สะอาด', backup: 'Backup (เทป)', backupHold: 'ยังเก็บคนนี้ครบ', backupClean: 'สะอาดหลังกู้พร้อม Log การลบ', source: 'ตารางต้นทาง', derived: 'ตารางที่ทำต่อจากต้นทาง',
    verdict: { start: 'ผู้ใช้มีแถวใน 6 ตาราง ก่อนรับคำขอ', naive: 'ลบจาก users ตารางเดียว แต่ยังเหลืออีก 5 ตารางที่เก็บคนนี้', lineage: 'ไล่ตามเส้นทางจากตารางต้นทาง ตารางที่เก็บคนนี้เหลือศูนย์' },
    caption: 'จำนวนแถวของผู้ใช้หนึ่งคนในแต่ละตารางมาจากแบบฝึก 10 เส้นระหว่างตารางคือ Lineage ที่แบบฝึกกำหนด การกู้ Backup พร้อม Log ก็ทำในแบบฝึกเช่นกัน',
  },
  en: {
    title: 'Choose how to handle one user\'s request to delete their data, and see which tables still hold them',
    mode: 'Handling', modes: { start: 'nothing yet', naive: 'delete from users only', lineage: 'follow the lineage' }, restore: 'restore the backup and apply the erasure log',
    legend: [{ kind: 'new', text: 'still holds this person\'s data' }, { kind: 'use', text: 'nothing left' }],
    rows: 'rows', holds: 'still holds', clean: 'clean', backup: 'Backup (tape)', backupHold: 'still holds the person in full', backupClean: 'clean after the restore with the erasure log', source: 'source tables', derived: 'tables made from them',
    verdict: { start: 'The user has rows in 6 tables before the request', naive: 'Deleted from users only, 5 other tables still hold the person', lineage: 'Walked the lines from the source tables, and no table holds the person' },
    caption: 'The row counts of one user per table come from exercise 10. The lines between the tables are the lineage that the exercise defines. Restoring the backup with the log is done in the exercise too.',
  },
};

export default function LineageLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [mode, setMode] = useState<Mode>('naive');
  const [restore, setRestore] = useState(false);
  const c = COUNTS[mode];
  const box = (name: string) => {
    const [x, y] = POS[name];
    const n = c[name] ?? 0;
    const holds = n > 0;
    return (
      <g key={name}>
        <rect className={holds ? 'ib-node' : 'ib-use'} x={x} y={y} width={210} height={70} rx={10} style={holds ? { stroke: 'var(--ib-bad)', strokeWidth: 3 } : undefined} />
        <text x={x + 14} y={y + 28} className="ib-n" style={{ fontWeight: 700 }}>{name}</text>
        <text x={x + 14} y={y + 54} className={holds ? 'ib-bad ib-n' : 'ib-ok ib-n'}>{holds ? `✗ ${T.holds} ${n} ${n === 1 && lang === 'en' ? 'row' : T.rows}` : `✓ ${T.clean}`}</text>
      </g>
    );
  };
  const edge = (a: string, b: string, k: string) => {
    const [ax, ay] = POS[a], [bx, by] = POS[b];
    return <line key={k} x1={ax + 210} y1={ay + 35} x2={bx} y2={by + 35} className="ib-line" style={{ strokeWidth: 2.5, stroke: mode === 'lineage' ? 'var(--accent)' : undefined }} />;
  };
  const edges: [string, string][] = [];
  Object.entries(EDGES).forEach(([a, bs]) => bs.forEach((b) => edges.push([a, b])));
  const backupHolds = !restore; // the tape was taken earlier and is unchanged until it is restored with the erasure log
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="ib-controls" style={{ flexWrap: 'wrap' }}>
        <span className="ib-lbl">{T.mode}</span>
        <span className="seg" role="group" aria-label={T.mode} style={{ flexWrap: 'wrap' }}>
          {(['start', 'naive', 'lineage'] as Mode[]).map((m) => <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}>{T.modes[m]}</button>)}
        </span>
        <button type="button" className={`btn sm${restore ? ' primary' : ''}`} aria-pressed={restore} onClick={() => setRestore(!restore)}>{T.restore}</button>
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 440" role="img" aria-label={T.title}>
          <text x={20} y={26} className="ib-s">{T.source}</text>
          <text x={330} y={86} className="ib-s">{T.derived}</text>
          {edges.map(([a, b], i) => edge(a, b, `${a}${b}${i}`))}
          {PLACES.map(box)}
          {/* backup */}
          <rect className={backupHolds ? 'ib-node' : 'ib-use'} x={640} y={170} width={210} height={110} rx={10} style={backupHolds ? { stroke: 'var(--ib-bad)', strokeWidth: 3 } : undefined} />
          <text x={654} y={198} className="ib-n" style={{ fontWeight: 700 }}>{T.backup}</text>
          {wrapText(backupHolds ? `✗ ${T.backupHold}` : `✓ ${T.backupClean}`, 21).map((ln, i) => <text key={i} x={654} y={224 + i * 20} className={backupHolds ? 'ib-bad ib-n' : 'ib-ok ib-n'}>{ln}</text>)}
          <line x1={540} y1={135} x2={640} y2={200} className="ib-line" style={{ strokeWidth: 2, strokeDasharray: '6 5' }} />
          <line x1={540} y1={275} x2={640} y2={245} className="ib-line" style={{ strokeWidth: 2, strokeDasharray: '6 5' }} />
          <rect className="ib-banner" x={14} y={388} width={852} height={40} rx={10} />
          <text x={30} y={414} className="ib-n" style={{ fontWeight: 700 }}>{T.verdict[mode]}</text>
        </svg>
      </div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
