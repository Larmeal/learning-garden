import { motion, useReducedMotion } from 'motion/react';
import { StepControls, useStepper, type StepInfo } from './stepper';

// Rows per partition measured by subjects/spark/code/exercises/07_performance_tuning.py:
// 2,000,000 rows, 90% of them with k = 1, repartition(8, "k") versus repartition(8, "k", "salt") with 64 salts.
const PLAIN = [22936, 29112, 25328, 28713, 22726, 1821935, 22334, 26916];
const SALTED = [305609, 194015, 193281, 194019, 221389, 306847, 362896, 221944];
const MAX = 1900000;

type Lang = 'th' | 'en';

const STEPS: Record<Lang, StepInfo[]> = {
  th: [
    { name: 'ข้อมูล skew', title: 'key เดียว 90% ของข้อมูล', text: 'hash(k) ส่งทุกแถวที่ k = 1 ไป partition เดียว partition ที่ 6 มี 1,821,935 แถว ส่วนที่เหลือมี 22,000 ถึง 29,000 แถว (วัดจริง)' },
    { name: 'เติม salt', title: 'เติม column salt แบบสุ่ม 0 ถึง 63', text: 'แต่ละแถวได้ salt = floor(rand() * 64) key ที่ใช้ตัดสินใจจึงเป็นคู่ (k, salt) แทนที่จะเป็น k เดี่ยวๆ แถวของ k = 1 จึงกลายเป็น 64 กลุ่มย่อย' },
    { name: 'repartition', title: 'repartition(8, "k", "salt")', text: 'กลุ่มย่อยของ k = 1 กระจายไปหลาย partition partition ที่ใหญ่สุดเหลือ 362,896 แถว จาก 1,821,935 ลดลงราว 5 เท่า (ไม่เท่ากันเป๊ะเพราะ hash ชนกันได้ จึงควรใช้ salt มากกว่าจำนวน partition)' },
    { name: 'ขยายฝั่งเล็ก', title: 'ฝั่งเล็กต้องมีทุก salt', text: 'เพื่อให้ join ยังถูก ตารางเล็ก 1,003 แถวถูกทำสำเนา 64 ชุด (crossJoin กับ range(64)) เป็น 64,192 แถว join ด้วย (k, salt) ได้ผล 2,000,000 แถวเท่ากับ join ปกติ ราคาที่จ่ายคือฝั่งเล็กใหญ่ขึ้น 64 เท่า' },
  ],
  en: [
    { name: 'Skewed data', title: 'One key has 90% of the data', text: 'hash(k) sends every row with k = 1 to a single partition. Partition 6 has 1,821,935 rows and the others have 22,000 to 29,000 rows (measured)' },
    { name: 'Add salt', title: 'Add a random salt column from 0 to 63', text: 'Each row gets salt = floor(rand() * 64). The key that decides the partition is now the pair (k, salt) instead of k alone, so the rows of k = 1 become 64 smaller groups' },
    { name: 'repartition', title: 'repartition(8, "k", "salt")', text: 'The small groups of k = 1 spread over many partitions. The biggest partition drops from 1,821,935 to 362,896 rows, about 5 times smaller (not exactly even because hashes can collide, so use more salts than partitions)' },
    { name: 'Expand small side', title: 'The small side needs every salt', text: 'To keep the join correct, the small table of 1,003 rows is copied 64 times (crossJoin with range(64)) into 64,192 rows. Joining on (k, salt) gives 2,000,000 rows, the same as the normal join. The price is a small side that is 64 times bigger' },
  ],
};

const TEXT: Record<Lang, { title: string; aria: (n: number) => string; heading: string; after: string; before: string; sampleHead: string; small: string; smallRows: string; joinNote: string; caption: string }> = {
  th: {
    title: 'Salting: กระจาย key ที่ใหญ่เกินไปออกเป็นหลายก้อน',
    aria: (n) => `จำนวนแถวต่อ partition ขั้น ${n}`,
    heading: 'แถวต่อ partition หลัง repartition(8, ...)',
    after: 'หลัง salt: partition ใหญ่สุด 362,896 แถว',
    before: 'ก่อน salt: partition ใหญ่สุด 1,821,935 แถว',
    sampleHead: 'ตัวอย่างแถวของ k = 1',
    small: 'ฝั่งเล็ก (dimension)',
    smallRows: '1,003 แถว  x  64 salt',
    joinNote: 'join ด้วย (k, salt) ได้ 2,000,000 แถวเท่าเดิม',
    caption: 'ตัวเลขทุกตัวมาจาก exercises/07_performance_tuning.py ค่าที่ partition ไหนได้เท่าไรขึ้นกับ hash ของ Spark เวอร์ชันนี้ ตำแหน่ง partition ในตัวอย่างแถวด้านขวาเป็นภาพประกอบ',
  },
  en: {
    title: 'Salting: split a key that is too big into many pieces',
    aria: (n) => `Rows per partition, step ${n}`,
    heading: 'Rows per partition after repartition(8, ...)',
    after: 'After salt: biggest partition 362,896 rows',
    before: 'Before salt: biggest partition 1,821,935 rows',
    sampleHead: 'Example rows of k = 1',
    small: 'Small side (dimension)',
    smallRows: '1,003 rows  x  64 salts',
    joinNote: 'join on (k, salt): same 2,000,000 rows',
    caption: 'Every number comes from exercises/07_performance_tuning.py. Which partition gets how many rows depends on the hash of this Spark version. The partition numbers in the example rows on the right are only an illustration.',
  },
};

export default function SaltingLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const steps = STEPS[lang];
  const { step, go, playing, toggle } = useStepper(steps.length, 3400);
  const reduce = useReducedMotion();
  const data = step >= 2 ? SALTED : PLAIN;
  const t = reduce ? { duration: 0 } : { duration: 0.8, ease: 'easeInOut' as const };
  const H = 190;
  return (
    <figure className="viz">
      <div className="viz-title">{T.title}</div>
      <div className="viz-box">
        <svg viewBox="0 0 880 330" role="img" aria-label={T.aria(step + 1)}>
          <rect className="band" x="10" y="10" width="860" height="310" rx="12" />
          <text className="b" x="28" y="38">{T.heading}</text>
          <text className="s" x="28" y="56">{step >= 2 ? T.after : T.before}</text>

          {data.map((v, i) => {
            const x = 48 + i * 62;
            const h = (v / MAX) * H;
            return (
              <g key={i}>
                <motion.rect className={step >= 2 ? 'k1' : i === 5 ? 'k2' : 'k1'} x={x} width={46} rx="4" initial={false} animate={{ y: 270 - h, height: h }} transition={t} />
                <text className="s m" x={x + 23} y={288} textAnchor="middle">{i + 1}</text>
                <motion.text className="s m" x={x + 23} textAnchor="middle" initial={false} animate={{ y: 264 - h }} transition={t}>
                  {v >= 1000 ? `${Math.round(v / 1000)}k` : v}
                </motion.text>
              </g>
            );
          })}

          {/* the rows of key 1 and their salts */}
          <motion.g initial={false} animate={{ opacity: step >= 1 ? 1 : 0 }} transition={t}>
            <rect className="box" x={560} y={80} width={290} height={100} rx="8" />
            <text className="b" x={574} y={102}>{T.sampleHead}</text>
            {[0, 1, 2, 3].map((i) => (
              <text key={i} className="m s" x={574} y={124 + i * 15}>
                {step >= 2 ? `(k=1, salt=${[17, 3, 52, 40][i]}) -> partition ${[3, 7, 1, 5][i]}` : `(k=1) -> partition 6`}
              </text>
            ))}
          </motion.g>

          <motion.g initial={false} animate={{ opacity: step >= 3 ? 1 : 0 }} transition={t}>
            <rect className="box on" x={560} y={196} width={290} height={100} rx="8" />
            <text className="b" x={574} y={218}>{T.small}</text>
            <text className="m s" x={574} y={238}>{T.smallRows}</text>
            <text className="m b acc" x={574} y={260}>{lang === 'th' ? '= 64,192 แถว' : '= 64,192 rows'}</text>
            <text className="s" x={574} y={280}>{T.joinNote}</text>
          </motion.g>
        </svg>
      </div>
      <StepControls steps={steps} step={step} playing={playing} go={go} toggle={toggle} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
