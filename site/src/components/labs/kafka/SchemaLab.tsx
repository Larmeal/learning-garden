import { useState } from 'react';
import type { Lang } from '../spark/timeline';
import { Legend } from '../iceberg/ib';
import data from './schemas.json';

// Shows:      the old and the new version of the Order schema side by side, with the field that changed marked, and two verdicts: can a new reader read old messages, can an old reader read new messages.
// Because:    compatibility is a question about a pair of schemas and a direction of reading. Seeing the two field lists and the two verdicts together shows which direction a change breaks.
// Control:    one of eight changes to the schema.
// Conclusion: adding a field with a default is safe both ways; adding one without a default breaks new readers, removing a field without a default breaks old readers, and a rename without an alias breaks both.
//
// The verdicts are real: exercise 09 wrote each old message with the old schema and read it with the new one (and the other way round) with fastavro, and saved the results in schemas.json.

interface Field { name: string; type: string; default?: unknown; aliases?: string[] }
type C = { change: string; backward: boolean; forward: boolean; old: Field[]; new: Field[] };
const CHANGES = data.changes as C[];

const NAMES: Record<string, { th: string; en: string; whyTh: string; whyEn: string }> = {
  'add a field with a default': { th: 'เพิ่มฟิลด์ที่มี default', en: 'add a field with a default', whyTh: 'Reader ใหม่ใส่ค่า default ให้ข้อความเก่าที่ไม่มีฟิลด์นี้ ส่วน Reader เก่าข้ามฟิลด์ที่มันไม่รู้จักไป', whyEn: 'The new reader fills in the default for old messages that lack the field, and the old reader skips a field it does not know.' },
  'add a field without a default': { th: 'เพิ่มฟิลด์ที่ไม่มี default', en: 'add a field without a default', whyTh: 'Reader ใหม่เจอข้อความเก่าที่ไม่มีฟิลด์นี้และไม่มีค่าให้ใส่แทน จึงอ่านไม่ได้', whyEn: 'The new reader meets an old message without the field and has no value to put in its place.' },
  'remove a field that had no default': { th: 'ลบฟิลด์ที่ไม่มี default', en: 'remove a field that had no default', whyTh: 'Reader เก่ายังต้องการฟิลด์นี้ แต่ข้อความใหม่ไม่มีและ Reader เก่าก็ไม่มีค่า default ให้ใช้', whyEn: 'The old reader still needs the field, the new message lacks it, and the old reader has no default to use.' },
  'remove a field that had a default': { th: 'ลบฟิลด์ที่มี default', en: 'remove a field that had a default', whyTh: 'Reader เก่าใช้ค่า default ของฟิลด์ที่หายไป Reader ใหม่ข้ามฟิลด์เก่าในข้อความเก่า', whyEn: 'The old reader uses the default of the missing field, and the new reader skips the old field in old messages.' },
  'rename a field': { th: 'เปลี่ยนชื่อฟิลด์', en: 'rename a field', whyTh: 'Avro จับคู่ฟิลด์ด้วยชื่อ ชื่อใหม่จึงเป็นฟิลด์ที่ไม่มีใน Schema ของอีกฝั่ง ทั้งสองทิศจึงพัง', whyEn: 'Avro matches fields by name, so the new name is a field the other side lacks, and both directions break.' },
  'rename a field and keep the old name as an alias': { th: 'เปลี่ยนชื่อฟิลด์ แล้วเก็บชื่อเก่าเป็น alias', en: 'rename a field and keep the old name as an alias', whyTh: 'Reader ใหม่รู้ว่า qty คือ quantity เพราะ alias จึงอ่านข้อความเก่าได้ แต่ Reader เก่าไม่รู้จักชื่อใหม่', whyEn: 'The new reader knows that qty is quantity through the alias, so it reads old messages, but the old reader does not know the new name.' },
  'widen int to long': { th: 'ขยาย int เป็น long', en: 'widen int to long', whyTh: 'int เลื่อนเป็น long ได้ (Reader ใหม่อ่านข้อมูลเก่าได้) แต่ long ใส่กลับเป็น int ไม่ได้', whyEn: 'An int can be promoted to a long (so the new reader reads old data), but a long cannot be read as an int.' },
  'narrow int to string': { th: 'เปลี่ยน int เป็น string', en: 'change int to string', whyTh: 'Avro ไม่แปลง int เป็น string และไม่แปลงกลับ ทั้งสองทิศจึงพัง', whyEn: 'Avro converts neither int to string nor the other way, so both directions break.' },
};

const TEXT: Record<Lang, {
  title: string; legend: { kind: 'new' | 'use' | 'skip'; text: string }[]; pick: string; oldV: string; newV: string; newReadsOld: string; oldReadsNew: string; ok: string; no: string; added: string; removed: string; changed: string; caption: string;
}> = {
  th: {
    title: 'เลือกการเปลี่ยน Schema แล้วดูว่า Reader ใหม่อ่านข้อความเก่าได้ไหม และ Reader เก่าอ่านข้อความใหม่ได้ไหม',
    legend: [{ kind: 'new', text: 'ฟิลด์ที่เปลี่ยนหรือเพิ่ม' }, { kind: 'skip', text: 'ฟิลด์ที่หายไป' }, { kind: 'use', text: 'ฟิลด์ที่เหมือนเดิม' }],
    pick: 'การเปลี่ยน', oldV: 'Schema เวอร์ชัน 1 (ข้อความเก่า)', newV: 'Schema เวอร์ชันใหม่', newReadsOld: 'Reader ใหม่ อ่านข้อความเก่า', oldReadsNew: 'Reader เก่า อ่านข้อความใหม่', ok: '✓ อ่านได้', no: '✗ อ่านไม่ได้', added: 'เพิ่ม', removed: 'หาย', changed: 'เปลี่ยน',
    caption: 'ผลการอ่านทุกช่องมาจากแบบฝึก 09: เขียนข้อความด้วย Schema ฝั่งหนึ่งแล้วอ่านด้วยอีกฝั่งจริง ๆ ด้วย fastavro ไม่ได้อ่านจากตาราง Compatibility ของ Registry (Schema Registry ไม่ได้รัน)',
  },
  en: {
    title: 'Choose a change to the schema and see whether a new reader can read old messages, and whether an old reader can read new messages',
    legend: [{ kind: 'new', text: 'field that changed or was added' }, { kind: 'skip', text: 'field that is gone' }, { kind: 'use', text: 'field that is the same' }],
    pick: 'change', oldV: 'schema version 1 (old messages)', newV: 'new schema version', newReadsOld: 'new reader reads old messages', oldReadsNew: 'old reader reads new messages', ok: '✓ can read', no: '✗ cannot read', added: 'added', removed: 'gone', changed: 'changed',
    caption: 'Every verdict comes from exercise 09: a message was written with the schema of one side and read with the other, for real, with fastavro. It was not taken from the compatibility table of a registry (no Schema Registry was run).',
  },
};

const label = (f: Field) => `${f.name}: ${f.type}${f.default !== undefined ? ` = ${JSON.stringify(f.default)}` : ''}${f.aliases ? ` (alias ${f.aliases.join(',')})` : ''}`;

export default function SchemaLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [i, setI] = useState(0);
  const c = CHANGES[i];
  const nm = NAMES[c.change];
  const oldNames = new Set(c.old.map((f) => f.name));
  const newNames = new Set(c.new.map((f) => f.name));
  const oldBy = new Map(c.old.map((f) => [f.name, f]));
  const stateOfNew = (f: Field) => (!oldNames.has(f.name) ? 'ib-new' : label(oldBy.get(f.name)!) !== label(f) ? 'ib-new' : 'ib-use');
  const rows = Math.max(c.old.length, c.new.length, 4);
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="ib-controls">
        <span className="ib-lbl">{T.pick}</span>
        <span className="seg" role="group" aria-label={T.pick} style={{ flexWrap: 'wrap' }}>
          {CHANGES.map((x, k) => (<button key={x.change} type="button" aria-pressed={i === k} onClick={() => setI(k)}>{NAMES[x.change][lang]}</button>))}
        </span>
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 340" role="img" aria-label={T.title}>
          <text x={22} y={26} className="ib-n">{T.oldV}</text>
          <text x={470} y={26} className="ib-n">{T.newV}</text>
          {c.old.map((f, j) => (
            <g key={f.name}>
              <rect className={newNames.has(f.name) ? (label(f) !== label(c.new.find((g) => g.name === f.name)!) ? 'ib-use' : 'ib-use') : 'ib-skip'} x={22} y={42 + j * 44} width={400} height={36} rx={7} />
              <text x={34} y={66 + j * 44} className="ib-m" style={{ fill: 'var(--fg)', fontSize: 14.5 }}>{label(f)}</text>
              {!newNames.has(f.name) && <text x={410} y={66 + j * 44} textAnchor="end" className="ib-s">{T.removed}</text>}
            </g>
          ))}
          {c.new.map((f, j) => (
            <g key={f.name}>
              <rect className={stateOfNew(f)} x={470} y={42 + j * 44} width={400} height={36} rx={7} />
              <text x={482} y={66 + j * 44} className="ib-m" style={{ fill: 'var(--fg)', fontSize: 14.5 }}>{label(f)}</text>
              {stateOfNew(f) === 'ib-new' && <text x={858} y={66 + j * 44} textAnchor="end" className="ib-s">{oldNames.has(f.name) ? T.changed : T.added}</text>}
            </g>
          ))}
          {[{ y: 42 + rows * 44 + 18, ok: c.backward, text: T.newReadsOld }, { y: 42 + rows * 44 + 56, ok: c.forward, text: T.oldReadsNew }].map((v) => (
            <g key={v.text}>
              <rect className="ib-node" x={22} y={v.y} width={848} height={34} rx={8} style={{ stroke: v.ok ? 'var(--brand)' : 'var(--ib-bad)', strokeWidth: 3 }} />
              <text x={36} y={v.y + 23} className="ib-n">{v.text}</text>
              <text x={856} y={v.y + 23} textAnchor="end" className="ib-n" style={{ fill: v.ok ? 'var(--brand)' : 'var(--ib-bad)' }}>{v.ok ? T.ok : T.no}</text>
            </g>
          ))}
        </svg>
      </div>
      <div className="readout" aria-live="polite"><div>{lang === 'th' ? nm.whyTh : nm.whyEn}</div></div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
