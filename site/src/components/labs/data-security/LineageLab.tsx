import { useState } from 'react';
import { ClockControls, useClock, prog, smooth, mix, type Lang, type Mark } from '../spark/timeline';
import { wrapText } from '../iceberg/ib';
import { Key, PersonGlyph } from './ds';
import data from './lifecycle.json';

// Shows:      the tables of a small platform and the lines along which one person's data flowed (users, consents, orders and events feed customer_360, users feed a partner export, and everything
//             was copied to a backup tape). Every table shows one small person for each row it holds about the user. A delete request arrives, and you watch it travel: with a delete on
//             users only it stops at one table, and with the lineage it follows the lines to every table. Optionally the backup is restored with the erasure log applied.
// Because:    "delete the user" is a sentence about a graph. The people who handle it as one delete leave the person in five other tables, and only a walk along the lines finds them.
// Control:    how the request is handled (nothing, delete from users only, follow the lineage), a switch for restoring the backup with the erasure log, and the clock.
// Conclusion: erasure needs a map of where the data went. Live tables are cleaned by following the lines, and a backup is cleaned by an erasure log applied when it is restored.
//
// The rows per table are those of exercises/10_lifecycle.py (lifecycle.json) for the user of the request, and so are the lines between the tables and the three results (one table cleaned,
// six cleaned, backup cleaned only through the log).

type Mode = 'start' | 'naive' | 'lineage';
const PLACES = data.places as string[];
const EDGES = data.edges as Record<string, string[]>;
const COUNTS: Record<Mode, Record<string, number>> = { start: data.start, naive: data.naive, lineage: data.lineage } as never;

const POS: Record<string, [number, number]> = {
  users: [20, 60], consents: [20, 145], orders: [20, 230], events: [20, 315],
  customer_360: [330, 120], partner_export: [330, 260], backup: [640, 190],
};
// when the request reaches each table, when the handling is "follow the lineage" (users first, then the tables that hold the user's id, then the tables made from them)
const REACH: Record<string, number> = { users: 1.2, consents: 2.2, orders: 2.6, events: 3.0, customer_360: 4.4, partner_export: 4.4, backup: 5.9 };
const DUR = 8.5;

const TEXT: Record<Lang, {
  title: string; mode: string; modes: Record<Mode, string>; restore: string; key: { holds: string; clean: string; log: string }; rows: string; holds: string; clean: string; request: string; log: string;
  verdict: Record<Mode, string>; backup: string; backupHold: string; backupClean: string; source: string; derived: string; caption: string; marks: (m: Mode, r: boolean) => Mark[];
}> = {
  th: {
    title: 'เลือกวิธีจัดการคำขอลบข้อมูลของผู้ใช้หนึ่งคน กดเล่น แล้วดูว่าคำขอเดินทางไปถึงตารางไหนบ้าง และตารางไหนยังเก็บเขาอยู่',
    mode: 'วิธีจัดการ', modes: { start: 'ยังไม่ลบ', naive: 'ลบจาก users อย่างเดียว', lineage: 'ไล่ตามเส้นทางของข้อมูล' }, restore: 'กู้ Backup แล้วใช้ Log การลบ',
    key: { holds: 'ยังเก็บข้อมูลของคนนี้อยู่', clean: 'ไม่เหลือแล้ว', log: 'Log การลบ' }, rows: 'แถว', holds: 'ยังเก็บ', clean: 'สะอาด', request: 'คำขอลบ ผู้ใช้หนึ่งคน', log: 'Log การลบ',
    verdict: { start: 'ผู้ใช้มีแถวใน 6 ตาราง ก่อนรับคำขอ', naive: 'ลบจาก users ตารางเดียว แต่ยังเหลืออีก 5 ตารางที่เก็บคนนี้', lineage: 'ไล่ตามเส้นทางจากตารางต้นทาง ตารางที่เก็บคนนี้เหลือศูนย์' },
    source: 'ตารางต้นทาง', derived: 'ตารางที่ทำต่อจากต้นทาง', backup: 'Backup (เทป)', backupHold: 'ยังเก็บคนนี้ครบ', backupClean: 'สะอาดหลังกู้พร้อม Log การลบ',
    caption: 'จำนวนแถวของผู้ใช้หนึ่งคนในแต่ละตาราง เส้นระหว่างตาราง และผลทั้งสามแบบ มาจากแบบฝึก 10 การกู้ Backup พร้อม Log ก็ทำในแบบฝึกเช่นกัน',
    marks: (m, r) => [
      { at: 0, name: 'ก่อนลบ', title: 'ผู้ใช้คนเดียว อยู่ในหลายตาราง', text: 'แต่ละคนตัวเล็กคือหนึ่งแถวที่เก็บผู้ใช้คนนี้ ตารางต้นทางเก็บ id ของเขา ตารางที่ทำต่อจากต้นทางเอาข้อมูลของเขาไปรวมแล้ว และเทปก็คัดลอกไว้หมด' },
      { at: 1.2, name: 'คำขอลบ', title: m === 'start' ? 'ยังไม่มีการลบ' : 'คำขอลบมาถึงตาราง users', text: m === 'start' ? 'ภาพนี้คือก่อนรับคำขอ' : m === 'naive' ? 'ทีมลบจาก users ตารางเดียวแล้วถือว่าเสร็จ ตารางอื่นไม่ถูกแตะ' : 'ทีมมีแผนที่ของข้อมูล จึงไล่ต่อไปยังทุกตารางที่เก็บ id ของผู้ใช้คนนี้' },
      { at: 4.4, name: 'ตารางที่ทำต่อ', title: m === 'lineage' ? 'ตามเส้นไปยังตารางที่ทำต่อ' : 'ตารางที่ทำต่อยังเก็บเขาอยู่', text: m === 'lineage' ? 'customer_360 กับ partner_export ได้ข้อมูลของเขามาจากตารางต้นทาง จึงต้องถูกแก้ด้วย' : m === 'naive' ? 'customer_360 และ partner_export ยังมีเขาอยู่ ทั้งที่ส่งข้อมูลนี้ออกไปนอกบริษัทแล้ว' : 'ยังไม่มีอะไรเปลี่ยน' },
      { at: 6.6, name: 'Backup', title: r ? 'กู้ Backup แล้วใช้ Log การลบ' : 'Backup บนเทปยังมีเขาอยู่', text: r ? 'เทปแก้ไม่ได้ แต่ Log การลบถูกใช้ทุกครั้งที่กู้ ผู้ใช้คนนี้จึงไม่กลับมา' : 'เทปแก้ไม่ได้ ถ้ากู้โดยไม่ใช้ Log การลบ คนที่ลบไปแล้วจะกลับมา' },
    ],
  },
  en: {
    title: 'Choose how one user\'s delete request is handled, press play, and watch which tables the request reaches and which still hold the person',
    mode: 'Handling', modes: { start: 'nothing yet', naive: 'delete from users only', lineage: 'follow the lineage' }, restore: 'restore the backup and apply the erasure log',
    key: { holds: 'still holds this person\'s data', clean: 'nothing left', log: 'erasure log' }, rows: 'rows', holds: 'still holds', clean: 'clean', request: 'delete request, one user', log: 'erasure log',
    verdict: { start: 'The user has rows in 6 tables before the request', naive: 'Deleted from users only, 5 other tables still hold the person', lineage: 'Followed the lines from the source tables, and no table holds the person' },
    source: 'source tables', derived: 'tables made from them', backup: 'Backup (tape)', backupHold: 'holds the person in full', backupClean: 'clean after restore with the log',
    caption: 'The rows of one user per table, the lines between the tables and the three results come from exercise 10. Restoring the backup with the log is done in the exercise too.',
    marks: (m, r) => [
      { at: 0, name: 'before', title: 'One user, in many tables', text: 'Each small person is one row that holds this user. The source tables keep the user\'s id, the tables made from them already combined the data, and the tape copied it all.' },
      { at: 1.2, name: 'request', title: m === 'start' ? 'Nothing is deleted yet' : 'The delete request reaches the users table', text: m === 'start' ? 'This is the picture before the request.' : m === 'naive' ? 'The team deletes from users only and calls it done. The other tables are not touched.' : 'The team has a map of the data, so it goes on to every table that holds this user\'s id.' },
      { at: 4.4, name: 'derived', title: m === 'lineage' ? 'Follow the lines to the tables made from them' : 'The derived tables still hold the person', text: m === 'lineage' ? 'customer_360 and partner_export got the data from the source tables, so they have to be fixed too.' : m === 'naive' ? 'customer_360 and partner_export still have them, and one of them was sent outside the company.' : 'Nothing changes.' },
      { at: 6.6, name: 'backup', title: r ? 'Restore the backup and apply the erasure log' : 'The tape still holds the person', text: r ? 'A tape cannot be edited, but the erasure log is applied every time it is restored, so this user does not come back.' : 'A tape cannot be edited. If it is restored without the erasure log, the person who was deleted comes back.' },
    ],
  },
};

export default function LineageLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [mode, setMode] = useState<Mode>('lineage');
  const [restore, setRestore] = useState(true);
  const clock = useClock(DUR);
  const { t } = clock;
  const cleaned = (name: string): boolean => {
    if (mode === 'start') return false;
    if (mode === 'naive') return name === 'users' && t >= REACH.users + 0.6;
    return t >= REACH[name] + 0.6;
  };
  const rowsOf = (name: string) => (cleaned(name) ? COUNTS[mode === 'start' ? 'start' : mode][name] : COUNTS.start[name]);
  const backupClean = restore && mode !== 'start' && t >= REACH.backup + 0.6;
  const box = (name: string) => {
    const [x, y] = POS[name];
    const n = rowsOf(name);
    const holds = n > 0;
    const flash = mode !== 'start' && t >= REACH[name] && t < REACH[name] + 0.6 && (mode === 'lineage' || name === 'users');
    return (
      <g key={name}>
        <rect x={x} y={y} width={210} height={72} rx={10} fill="var(--surface)" stroke={holds ? 'var(--ib-bad)' : 'var(--accent)'} strokeWidth={holds ? 3.5 : 3} style={{ transition: 'stroke .3s' }} />
        {flash ? <rect x={x - 4} y={y - 4} width={218} height={80} rx={13} fill="none" stroke="var(--accent)" strokeWidth={4} opacity={0.6} /> : null}
        <text x={x + 14} y={y + 26} className="ib-n" style={{ fontWeight: 700, fontSize: 16.5 }}>{name}</text>
        {holds
          ? Array.from({ length: n }, (_, k) => <PersonGlyph key={k} cx={x + 28 + k * 34} cy={y + 46} r={7} fill="var(--ib-bad)" stroke="var(--surface)" />)
          : <text x={x + 14} y={y + 56} className="ib-ok ib-n" style={{ fontSize: 15 }}>{`✓ ${T.clean}`}</text>}
        {holds ? <text x={x + 14 + n * 34 + 6} y={y + 56} className="ib-bad ib-n" style={{ fontSize: 14.5 }}>{`${T.holds} ${n} ${n === 1 && lang === 'en' ? 'row' : T.rows}`}</text> : null}
      </g>
    );
  };
  const edges: [string, string][] = [];
  Object.entries(EDGES).forEach(([a, bs]) => bs.forEach((b) => edges.push([a, b])));
  const edge = ([a, b]: [string, string], i: number) => {
    const [ax, ay] = POS[a], [bx, by] = POS[b];
    const x1 = ax + 210, y1 = ay + 36, x2 = bx, y2 = by + 36;
    const p = mode === 'lineage' ? smooth(prog(t, REACH[a] + 0.6, REACH[b] - 0.2)) : 0;
    return (
      <g key={i}>
        <line x1={x1} y1={y1} x2={x2} y2={y2} className="ib-line" style={{ strokeWidth: 2.5 }} />
        {p > 0 && p < 1 ? <circle cx={mix(x1, x2, p)} cy={mix(y1, y2, p)} r={8} style={{ fill: 'var(--accent)' }} /> : null}
      </g>
    );
  };
  // the request: a card that arrives at the users table
  const reqP = mode === 'start' ? 0 : smooth(prog(t, 0.2, 1.2));
  const logP = restore && mode !== 'start' ? smooth(prog(t, 4.9, 5.9)) : 0;
  return (
    <figure className="viz ib-fig lg">
      <div className="viz-title">{T.title}</div>
      <div className="ib-controls" style={{ flexWrap: 'wrap' }}>
        <span className="ib-lbl">{T.mode}</span>
        <span className="seg" role="group" aria-label={T.mode} style={{ flexWrap: 'wrap' }}>
          {(['start', 'naive', 'lineage'] as Mode[]).map((m) => <button key={m} type="button" aria-pressed={mode === m} onClick={() => { setMode(m); clock.restart(); }}>{T.modes[m]}</button>)}
        </span>
        <button type="button" className={`btn sm${restore ? ' primary' : ''}`} aria-pressed={restore} onClick={() => { setRestore(!restore); clock.restart(); }}>{T.restore}</button>
      </div>
      <Key items={[{ color: 'var(--ib-bad)', text: T.key.holds }, { color: 'var(--accent)', text: T.key.clean }]} />
      <div className="viz-box">
        <svg viewBox="0 0 880 470" role="img" aria-label={T.title}>
          <text x={20} y={24} className="ib-s" style={{ fontSize: 14 }}>{T.source}</text>
          <text x={330} y={88} className="ib-s" style={{ fontSize: 14 }}>{T.derived}</text>
          {edges.map(edge)}
          <line x1={540} y1={156} x2={640} y2={226} className="ib-line" style={{ strokeWidth: 2, strokeDasharray: '6 5' }} />
          <line x1={540} y1={296} x2={640} y2={262} className="ib-line" style={{ strokeWidth: 2, strokeDasharray: '6 5' }} />
          {PLACES.map(box)}
          {/* the backup tape */}
          <rect x={640} y={190} width={220} height={120} rx={10} fill="var(--surface)" stroke={backupClean ? 'var(--accent)' : 'var(--ib-bad)'} strokeWidth={3.5} strokeDasharray="8 5" />
          <text x={654} y={218} className="ib-n" style={{ fontWeight: 700, fontSize: 16.5 }}>{T.backup}</text>
          {!backupClean ? <PersonGlyph cx={668} cy={246} r={7} fill="var(--ib-bad)" stroke="var(--surface)" /> : null}
          {wrapText(backupClean ? `✓ ${T.backupClean}` : `✗ ${T.backupHold}`, 21).map((ln, i) => <text key={i} x={654} y={(backupClean ? 248 : 278) + i * 20} className={backupClean ? 'ib-ok ib-n' : 'ib-bad ib-n'} style={{ fontSize: 14.5 }}>{ln}</text>)}
          {/* the delete request travelling to users */}
          {reqP > 0 && reqP < 1 ? (
            <g>
              <rect x={mix(540, 232, reqP)} y={mix(8, 66, reqP)} width={190} height={34} rx={17} fill="var(--accent)" />
              <text x={mix(540, 232, reqP) + 95} y={mix(8, 66, reqP) + 22} textAnchor="middle" style={{ fill: 'var(--on-key, #fff)', fontSize: 14.5, fontWeight: 700 }}>🗑 {T.request}</text>
            </g>
          ) : null}
          {/* the erasure log going to the backup */}
          {logP > 0 && logP < 1 ? (
            <g>
              <rect x={mix(540, 650, logP)} y={mix(380, 322, logP)} width={150} height={32} rx={16} fill="var(--accent)" />
              <text x={mix(540, 650, logP) + 75} y={mix(380, 322, logP) + 21} textAnchor="middle" style={{ fill: 'var(--on-key, #fff)', fontSize: 14, fontWeight: 700 }}>{T.log}</text>
            </g>
          ) : null}
          <rect x={14} y={402} width={852} height={52} rx={12} className="ib-banner" />
          <text x={30} y={434} className="ib-n" style={{ fontWeight: 700, fontSize: 16.5 }}>{T.verdict[mode]}</text>
        </svg>
      </div>
      <ClockControls clock={clock} marks={T.marks(mode, restore)} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
