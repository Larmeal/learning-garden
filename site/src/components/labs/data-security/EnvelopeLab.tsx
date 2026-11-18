import { StepControls, useStepper, type Lang } from '../spark/stepper';
import { Legend, Lines } from '../iceberg/ib';
import data from './envelope.json';

// Shows:      envelope encryption in five steps: each table gets its own data key and its rows are encrypted with it; the data keys are wrapped by one master key; the wrapped keys sit next to
//             the data; a master key rotation rewrites only the 3 wrapped keys (180 bytes) and not the 92.5 million bytes of rows; and deleting one data key makes its rows unreadable everywhere.
// Because:    "key hierarchy" is a picture of two levels. The point of the second level (rotate cheaply, erase by deleting a key) is invisible in a sentence.
// Control:    the step player.
// Conclusion: the master key protects the data keys, the data keys protect the rows, rotation touches only the top and deletion of one data key erases a whole table, backups included.
//
// The sizes (37 bytes per value, 60 bytes per wrapped key, 180 against 92,500,000 bytes) and the failure of the old master key and of the deleted key are asserted in exercises/07_encryption.py (envelope.json).

const TABLES = Object.keys(data.rows);
const ROWS = data.rows as Record<string, number>;

const TEXT: Record<Lang, { title: string; legend: { kind: 'new' | 'use' | 'skip' | 'node'; text: string }[]; steps: { name: string; title: string; text: string }[]; kms: string; kek: string; dek: string; rows: string; wrapped: string; backup: string; unreadable: string; touched: string; caption: string }> = {
  th: {
    title: 'ไล่ดูห้าขั้นของการเข้ารหัสแบบ Envelope ตั้งแต่เข้ารหัสแถว หุ้ม Key ไปจนถึงหมุน Key และลบ Key เพื่อลบข้อมูล',
    legend: [{ kind: 'new', text: 'สิ่งที่เปลี่ยนในขั้นนี้' }, { kind: 'use', text: 'ยังเหมือนเดิม' }],
    kms: 'KMS หรือ HSM', kek: 'Master Key (KEK)', dek: 'DEK', rows: 'แถว', wrapped: 'DEK ที่ถูกหุ้ม', backup: 'Backup', unreadable: 'อ่านไม่ได้อีกแล้ว', touched: 'ไบต์ที่ต้องเขียนใหม่',
    steps: [
      { name: 'เข้ารหัสแถว', title: '1. แต่ละตารางมี Data Key ของตัวเอง', text: 'ค่า 9 ตัวอักษรกลายเป็น 37 ไบต์ (Nonce 12, ข้อความ 9, Tag 16) ด้วย AES-GCM และมีเลขแถวเป็น Associated Data' },
      { name: 'หุ้ม Key', title: '2. Master Key หุ้ม Data Key แต่ละตัว', text: 'Data Key ที่หุ้มแล้วยาว 60 ไบต์ (Nonce 12, Key 32, Tag 16) Master Key อยู่ใน KMS และไม่ออกมานอก' },
      { name: 'เก็บข้างข้อมูล', title: '3. เก็บ DEK ที่หุ้มไว้ข้างข้อมูล', text: 'ดิสก์และ Backup มีแต่ข้อมูลที่เข้ารหัสกับ DEK ที่หุ้ม ไม่มีอะไรอ่านได้ถ้าไม่มี Master Key' },
      { name: 'หมุน Master Key', title: '4. หมุน Master Key', text: 'ถอดห่อ DEK ด้วย Key เก่า แล้วหุ้มด้วย Key ใหม่ เขียนใหม่ 180 ไบต์ ถ้าไม่มีชั้น Envelope ต้องถอดและเข้ารหัสทุกแถวใหม่ 92,500,000 ไบต์' },
      { name: 'ลบ Key', title: '5. ลบ DEK ของตารางเดียว', text: 'ตาราง customers อ่านไม่ได้ทุกสำเนา รวมถึง Backup บนเทป เพราะลบแค่ Key 32 ไบต์ ตารางอื่นไม่กระทบ' },
    ],
    caption: 'ขนาดไบต์และผลของการหมุนกับการลบ Key มาจากแบบฝึก 07 (cryptography 47.0.0) จำนวนแถวต่อตาราง (100,000, 2,000,000 และ 400,000) เป็นตัวอย่างของผู้เขียน',
  },
  en: {
    title: 'Walk through the five steps of envelope encryption, from encrypting rows and wrapping keys to rotating a key and deleting a key to delete data',
    legend: [{ kind: 'new', text: 'what changes in this step' }, { kind: 'use', text: 'stays the same' }],
    kms: 'KMS or HSM', kek: 'master key (KEK)', dek: 'DEK', rows: 'rows', wrapped: 'wrapped DEK', backup: 'Backup', unreadable: 'unreadable now', touched: 'bytes to rewrite',
    steps: [
      { name: 'encrypt rows', title: '1. Each table has a data key of its own', text: 'A 9 character value becomes 37 bytes (nonce 12, text 9, tag 16) with AES-GCM, and the row id is the associated data.' },
      { name: 'wrap keys', title: '2. The master key wraps each data key', text: 'A wrapped data key is 60 bytes (nonce 12, key 32, tag 16). The master key lives in a KMS and never leaves it.' },
      { name: 'store beside', title: '3. The wrapped keys are stored beside the data', text: 'The disk and the backups hold only encrypted data and wrapped keys, and nothing can be read without the master key.' },
      { name: 'rotate master', title: '4. Rotate the master key', text: 'Unwrap each data key with the old key and wrap it with the new one: 180 bytes are rewritten. Without the envelope every row would be decrypted and encrypted again, 92,500,000 bytes.' },
      { name: 'delete a key', title: '5. Delete the data key of one table', text: 'The customers table is unreadable in every copy, the backup tape included, because only 32 bytes of key were deleted. The other tables are untouched.' },
    ],
    caption: 'The sizes and the results of the rotation and of the deletion come from exercise 07 (cryptography 47.0.0). The row counts per table (100,000, 2,000,000 and 400,000) are the author\'s example.',
  },
};

export default function EnvelopeLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const st = useStepper(T.steps.length, 3600);
  const s = st.step;
  const rotated = s >= 3;
  const shredded = s >= 4;
  const dekX = (i: number) => 170 + i * 250;
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="viz-box">
        <svg viewBox="0 0 880 430" role="img" aria-label={T.title}>
          {/* master key */}
          <rect className={s === 3 ? 'ib-new' : s >= 1 ? 'ib-use' : 'ib-node'} x={290} y={10} width={300} height={54} rx={10} />
          <text x={440} y={34} textAnchor="middle" className="ib-n" style={{ fontWeight: 700 }}>{`${T.kek}${rotated ? ' v2' : ' v1'}`}</text>
          <text x={440} y={54} textAnchor="middle" className="ib-s">{T.kms}</text>
          {TABLES.map((tname, i) => {
            const gone = shredded && tname === 'customers';
            const x = dekX(i);
            return (
              <g key={tname}>
                {/* wrapping arrow */}
                <line x1={440} y1={64} x2={x} y2={124} className="ib-line" style={{ strokeWidth: 2.5, opacity: s >= 1 ? 1 : 0.15, strokeDasharray: s === 3 ? '6 4' : undefined, stroke: s === 3 ? 'var(--accent)' : undefined }} />
                {/* the wrapped data key */}
                <rect className={s === 1 || s === 3 ? 'ib-new' : s >= 2 ? 'ib-use' : 'ib-node'} x={x - 100} y={124} width={200} height={50} rx={9} style={gone ? { opacity: 0.25, strokeDasharray: '6 5' } : undefined} />
                <text x={x} y={146} textAnchor="middle" className="ib-n" style={{ fontWeight: 700, textDecoration: gone ? 'line-through' : undefined }}>{`${T.dek}: ${tname}`}</text>
                <text x={x} y={164} textAnchor="middle" className="ib-s">{s >= 1 ? `${T.wrapped} · ${data.wrappedBytes} B` : '32 B'}</text>
                {/* rows */}
                <rect className={s === 0 ? 'ib-new' : 'ib-use'} x={x - 100} y={220} width={200} height={74} rx={9} style={gone ? { stroke: 'var(--ib-bad)', strokeWidth: 3 } : undefined} />
                <text x={x} y={246} textAnchor="middle" className="ib-n" style={{ fontWeight: 700 }}>{`${tname}`}</text>
                <text x={x} y={268} textAnchor="middle" className="ib-s">{`${ROWS[tname].toLocaleString('en-US')} ${T.rows}`}</text>
                <text x={x} y={286} textAnchor="middle" className="ib-m" style={{ fontSize: 13 }}>{gone ? T.unreadable : `${data.valueBytes} B / value`}</text>
                <line x1={x} y1={174} x2={x} y2={220} className="ib-line" style={{ strokeWidth: 2.5, opacity: s >= 0 ? 1 : 0.2 }} />
                {/* the backup copy */}
                <rect className="ib-node" x={x - 100} y={312} width={200} height={34} rx={8} style={gone ? { stroke: 'var(--ib-bad)', strokeWidth: 2.5, opacity: 0.6 } : { opacity: s >= 2 ? 1 : 0.3 }} />
                <text x={x} y={334} textAnchor="middle" className="ib-s">{`${T.backup}${gone ? ` · ${T.unreadable}` : ''}`}</text>
              </g>
            );
          })}
          <rect className="ib-banner" x={14} y={362} width={852} height={56} rx={10} />
          {s === 3 ? (
            <text x={30} y={386} className="ib-n" style={{ fontWeight: 700 }}>{`${T.touched}: ${data.envelopeBytes} (${lang === 'th' ? 'เทียบกับ' : 'against'} ${data.directBytes.toLocaleString('en-US')})`}</text>
          ) : (
            <Lines x={30} y={386} text={T.steps[s].title} max={lang === 'th' ? 80 : 96} className="ib-n" />
          )}
        </svg>
      </div>
      <StepControls steps={T.steps} step={st.step} playing={st.playing} go={st.go} toggle={st.toggle} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
