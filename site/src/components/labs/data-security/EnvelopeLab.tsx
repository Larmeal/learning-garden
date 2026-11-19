import { StepControls, useStepper, type Lang } from '../spark/stepper';
import { Key as LegendKey, num } from './ds';
import data from './envelope.json';

// Shows:      three tables drawn as chests, each locked with a key of its own (a data key, DEK). A vault holds one master key. In five steps: each chest is locked with its own key, the master key
//             puts every small key into a locked pouch, the pouches are stored next to the chests, the master key is replaced (only the three pouches are redone, the chests are not touched),
//             and one small key is thrown away (that chest and its backup can never be opened again).
// Because:    "envelope encryption" is a story about which key opens which lock, and which lock has to be changed when a key changes. A row of boxes says it less well than keys and locks.
// Control:    the five steps (Next, or Autoplay). The master key, the pouches, the chests and the backups each change in the steps where the lesson says they do.
// Conclusion: replacing the master key redoes 180 bytes instead of 92,500,000, and throwing away one data key makes one table and its backup unreadable.
//
// The sizes (37 bytes per value, 60 bytes per wrapped key, 180 bytes to rotate, 92,500,000 without the envelope) and the effect of rotating and deleting come from exercises/07_encryption.py
// (cryptography 47.0.0). The row counts per table (100,000, 2,000,000, 400,000) are the author's example: those rows were not really encrypted.

const ROWS = data.rows as Record<string, number>;
const TABLES = Object.keys(ROWS);
const CX = [150, 440, 730];

const TEXT: Record<Lang, {
  title: string; steps: { name: string; title: string; text: string }[]; vault: string; master: string; ownKey: string; pouch: string; rows: string; perValue: string; backup: string; unreadable: string; gone: string;
  rewrite: string; ifAll: string; kinds: { key: string; master: string; locked: string; dead: string }; caption: string; step: string[];
}> = {
  th: {
    title: 'กด ถัดไป ทีละขั้น ดูว่าแต่ละตารางมีกุญแจของตัวเอง กุญแจใหญ่หุ้มกุญแจเล็กอย่างไร และตอนเปลี่ยนหรือทิ้งกุญแจ อะไรต้องทำใหม่',
    vault: 'ตู้นิรภัย (KMS หรือ HSM)', master: 'Master Key', ownKey: 'DEK ของตาราง', pouch: 'DEK ที่ถูกหุ้ม', rows: 'แถว', perValue: 'ไบต์ต่อค่า', backup: 'Backup', unreadable: 'อ่านไม่ได้อีกแล้ว', gone: 'ทิ้งแล้ว',
    rewrite: 'ไบต์ที่ต้องเขียนใหม่', ifAll: 'ถ้าเข้ารหัสทุกแถวใหม่', kinds: { key: 'กุญแจ', master: 'Master Key', locked: 'ถูกล็อก', dead: 'เปิดไม่ได้อีกแล้ว' },
    steps: [
      { name: 'ล็อกแถว', title: '1. แต่ละตารางมีกุญแจของตัวเอง', text: 'แต่ละแถวถูกเข้ารหัสด้วย AES-GCM ค่า 9 ตัวอักษรกลายเป็น 37 ไบต์ กุญแจที่ล็อกตารางนี้เรียกว่า Data Key (DEK) และแต่ละตารางมีของตัวเอง' },
      { name: 'หุ้มกุญแจ', title: '2. Master Key ล็อกกุญแจเล็กทุกดอก', text: 'เรายังเก็บ DEK เปล่า ๆ ไว้ข้างตารางไม่ได้ ใครหยิบไปก็เปิดตารางได้ จึงเอา DEK ใส่ถุงที่ล็อกด้วย Master Key ถุงนั้นยาว 60 ไบต์ ส่วน Master Key อยู่ในตู้นิรภัยและไม่ออกมา' },
      { name: 'เก็บข้างข้อมูล', title: '3. เก็บถุงไว้ข้างข้อมูลได้เลย', text: 'ดิสก์และ Backup มีแต่ตารางที่ล็อกอยู่กับถุงที่ล็อกอยู่ ไม่มีอะไรเปิดได้ถ้าไม่มี Master Key' },
      { name: 'เปลี่ยน Master Key', title: '4. เปลี่ยน Master Key ใหม่', text: 'เปิดถุงสามใบด้วย Key เก่า แล้วล็อกใหม่ด้วย Key ใหม่ เขียนใหม่แค่ 180 ไบต์ ตารางไม่ถูกแตะเลย ถ้าไม่มีชั้นถุง ต้องถอดและเข้ารหัสทุกแถวใหม่ 92,500,000 ไบต์' },
      { name: 'ทิ้งกุญแจ', title: '5. ทิ้งกุญแจของตารางเดียว', text: 'ตาราง customers เปิดไม่ได้ทุกสำเนา รวมถึง Backup บนเทป เพราะทิ้งกุญแจแค่ 32 ไบต์ ตารางอื่นยังใช้ได้ตามปกติ' },
    ],
    step: ['ไม่มีอะไรหุ้ม', 'กำลังล็อกถุง', 'เก็บคู่ข้อมูล', 'เปลี่ยน Key', 'ทิ้ง Key'],
    caption: 'ขนาดไบต์ (37, 60, 180 และ 92,500,000) และผลของการเปลี่ยน Key กับการทิ้ง Key มาจากแบบฝึก 07 (cryptography 47.0.0) จำนวนแถวต่อตาราง (100,000, 2,000,000 และ 400,000) เป็นตัวอย่างของผู้เขียน ไม่ได้เข้ารหัสแถวเหล่านั้นจริง',
  },
  en: {
    title: 'Press Next, one step at a time, and see how each table has a key of its own, how a big key locks the small keys, and what has to be redone when a key is replaced or thrown away',
    vault: 'the vault (KMS or HSM)', master: 'master key', ownKey: 'the table\'s DEK', pouch: 'wrapped DEK', rows: 'rows', perValue: 'bytes per value', backup: 'Backup', unreadable: 'can never be opened again', gone: 'thrown away',
    rewrite: 'bytes to rewrite', ifAll: 'if every row were encrypted again', kinds: { key: 'key', master: 'master key', locked: 'locked', dead: 'can never be opened' },
    steps: [
      { name: 'lock rows', title: '1. Each table has a key of its own', text: 'Every row is encrypted with AES-GCM. A 9 character value becomes 37 bytes. The key that locks this table is its data key (DEK), and every table has its own.' },
      { name: 'wrap keys', title: '2. The master key locks every small key', text: 'We cannot leave a bare DEK next to a table: whoever takes it opens the table. So the DEK goes into a pouch locked with the master key. The pouch is 60 bytes, and the master key stays in the vault.' },
      { name: 'store beside', title: '3. The pouches sit next to the data', text: 'The disk and the backup hold only locked tables and locked pouches. Nothing opens without the master key.' },
      { name: 'rotate master', title: '4. Replace the master key', text: 'Open the three pouches with the old key and lock them again with the new one. Only 180 bytes are rewritten and the tables are not touched. Without the pouches every row would be decrypted and encrypted again, 92,500,000 bytes.' },
      { name: 'throw a key', title: '5. Throw away the key of one table', text: 'The customers table can never be opened again in any copy, the backup tape included, because only 32 bytes of key were thrown away. The other tables work as before.' },
    ],
    step: ['nothing wrapped', 'locking pouches', 'stored beside', 'new key', 'key thrown'],
    caption: 'The sizes (37, 60, 180 and 92,500,000 bytes) and the effect of replacing and throwing away a key come from exercise 07 (cryptography 47.0.0). The row counts per table (100,000, 2,000,000 and 400,000) are the author\'s example: those rows were not really encrypted.',
  },
};

// a key: a ring, a shaft and two teeth, drawn with its left end at (x, y)
function KeyGlyph({ x, y, color, s = 1, op = 1, dead }: { x: number; y: number; color: string; s?: number; op?: number; dead?: boolean }) {
  return (
    <g opacity={op} transform={`translate(${x},${y}) scale(${s})`}>
      <circle cx={10} cy={0} r={9} fill="none" stroke={color} strokeWidth={4} />
      <line x1={19} y1={0} x2={58} y2={0} stroke={color} strokeWidth={4} strokeLinecap="round" />
      <line x1={46} y1={0} x2={46} y2={11} stroke={color} strokeWidth={4} strokeLinecap="round" />
      <line x1={56} y1={0} x2={56} y2={9} stroke={color} strokeWidth={4} strokeLinecap="round" />
      {dead ? <line x1={-6} y1={-14} x2={66} y2={14} stroke="var(--ib-bad)" strokeWidth={4} /> : null}
    </g>
  );
}
function LockGlyph({ x, y, color, s = 1, open }: { x: number; y: number; color: string; s?: number; open?: boolean }) {
  return (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      <path d={open ? 'M -8 -6 V -14 A 8 8 0 0 1 8 -14' : 'M -8 -6 V -14 A 8 8 0 0 1 8 -14 V -6'} fill="none" stroke={color} strokeWidth={3} />
      <rect x={-12} y={-6} width={24} height={18} rx={4} fill={color} />
    </g>
  );
}

export default function EnvelopeLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const { step, go, playing, toggle } = useStepper(5, 4200);
  const s = step; // 0..4
  const accent = 'var(--accent)', bad = 'var(--ib-bad)', muted = 'var(--muted)';
  const wrapped = s >= 1;
  const rotated = s >= 3;
  const killed = s === 4;
  return (
    <figure className="viz ib-fig lg">
      <div className="viz-title">{T.title}</div>
      <LegendKey items={[{ color: accent, text: T.kinds.key }, { color: bad, text: T.kinds.dead, ring: true }]} />
      <div className="viz-box">
        <svg viewBox="0 0 880 470" role="img" aria-label={T.title}>
          {/* the vault */}
          <rect x={290} y={8} width={300} height={96} rx={16} fill="var(--surface)" stroke={rotated ? accent : 'var(--line-strong)'} strokeWidth={rotated && s === 3 ? 4 : 2.5} />
          <text x={440} y={30} textAnchor="middle" className="ib-s" style={{ fontSize: 14 }}>{T.vault}</text>
          <KeyGlyph x={352} y={68} color={rotated ? accent : 'var(--fg)'} s={1.45} />
          <text x={448} y={64} className="ib-n" style={{ fontWeight: 700, fontSize: 16 }}>{T.master}</text>
          <text x={448} y={86} className="ib-n" style={{ fontWeight: 700, fontSize: 18, fill: rotated ? accent : 'var(--fg)' }}>{rotated ? 'v2' : 'v1'}</text>
          {TABLES.map((name, i) => {
            const cx = CX[i];
            const dead = killed && i === 0;
            const hold = dead ? bad : 'var(--line-strong)';
            return (
              <g key={name}>
                {/* the line from the vault while keys are being locked, and while the master key is replaced */}
                {(s === 1 || s === 3) && !dead ? <line x1={440} y1={104} x2={cx} y2={150} stroke={accent} strokeWidth={3} strokeDasharray="7 6" /> : null}
                {/* the data key: bare in step 1, in a locked pouch from step 2 */}
                {!wrapped ? (
                  <g>
                    <KeyGlyph x={cx - 30} y={172} color={accent} s={1} />
                    <text x={cx} y={206} textAnchor="middle" className="ib-s" style={{ fontSize: 14 }}>{T.ownKey} · 32 B</text>
                  </g>
                ) : (
                  <g opacity={dead ? 0.55 : 1}>
                    <rect x={cx - 100} y={146} width={200} height={72} rx={12} fill="var(--surface)" stroke={dead ? bad : accent} strokeWidth={dead ? 3 : s === 1 || s === 3 ? 4 : 2.5} strokeDasharray={dead ? '8 6' : undefined} />
                    <KeyGlyph x={cx - 84} y={174} color={dead ? muted : accent} s={0.85} dead={dead} />
                    <LockGlyph x={cx + 70} y={176} color={dead ? muted : rotated ? accent : 'var(--fg)'} s={1.2} open={false} />
                    <text x={cx} y={206} textAnchor="middle" className="ib-s" style={{ fontSize: 14 }}>{dead ? T.gone : `${T.pouch} · ${data.wrappedBytes} B`}</text>
                  </g>
                )}
                {/* the chest: the table, locked */}
                <rect x={cx - 100} y={248} width={200} height={90} rx={12} fill={dead ? 'color-mix(in srgb, var(--ib-bad) 12%, var(--surface))' : 'var(--surface)'} stroke={dead ? bad : accent} strokeWidth={dead ? 3.5 : 2.5} style={{ transition: 'fill .3s' }} />
                <LockGlyph x={cx + 74} y={282} color={dead ? bad : accent} s={1.3} />
                <text x={cx - 88} y={278} className="ib-n" style={{ fontWeight: 700, fontSize: 17 }}>{name}</text>
                <text x={cx - 88} y={302} className="ib-s" style={{ fontSize: 14 }}>{num(ROWS[name])} {T.rows}</text>
                <text x={cx - 88} y={324} className="ib-s" style={{ fontSize: 14, fill: dead ? bad : undefined, fontWeight: dead ? 700 : 400 }}>{dead ? T.unreadable : `${data.valueBytes} ${T.perValue}`}</text>
                {/* the backup */}
                <rect x={cx - 100} y={354} width={200} height={40} rx={10} fill={dead ? 'color-mix(in srgb, var(--ib-bad) 12%, var(--surface))' : 'var(--surface)'} stroke={dead ? bad : 'var(--line-strong)'} strokeWidth={dead ? 3.5 : 1.5} strokeDasharray="6 5" />
                <text x={cx} y={380} textAnchor="middle" style={{ fontSize: 14.5, fontWeight: dead ? 700 : 400, fill: dead ? bad : undefined }} className="ib-n">{dead ? `${T.backup} · ${T.unreadable}` : T.backup}</text>
              </g>
            );
          })}
          {/* the bytes to rewrite when the master key is replaced */}
          {rotated ? (
            <g>
              <rect x={8} y={406} width={864} height={56} rx={12} className="ib-banner" />
              <text x={22} y={428} className="ib-n" style={{ fontSize: 14.5 }}>{`${T.rewrite}: `}<tspan style={{ fontWeight: 700 }}>{num(data.envelopeBytes)} B</tspan>{`  ·  ${T.ifAll}: `}<tspan style={{ fontWeight: 700, fill: bad }}>{num(data.directBytes)} B</tspan></text>
              <rect x={22} y={438} width={820} height={9} rx={4} fill="var(--accent-soft)" stroke="var(--line-strong)" />
              <rect x={22} y={438} width={820} height={9} rx={4} fill={bad} opacity={0.55} />
              <rect x={22} y={438} width={4} height={9} rx={2} fill={accent} />
            </g>
          ) : (
            <g>
              <rect x={8} y={406} width={864} height={56} rx={12} className="ib-banner" />
              <text x={22} y={440} className="ib-n" style={{ fontWeight: 700, fontSize: 16 }}>{T.step[s]}</text>
            </g>
          )}
        </svg>
      </div>
      <StepControls steps={T.steps} step={step} playing={playing} go={go} toggle={toggle} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
