import { motion, useReducedMotion } from 'motion/react';
import { StepControls, useStepper, type StepInfo } from './stepper';

// Rows per partition measured by subjects/spark/code/exercises/07_performance_tuning.py:
// 2,000,000 rows, 90% of them with k = 1, repartition(8, "k") versus repartition(8, "k", "salt") with 64 salts.
const PLAIN = [22936, 29112, 25328, 28713, 22726, 1821935, 22334, 26916];
const SALTED = [305609, 194015, 193281, 194019, 221389, 306847, 362896, 221944];
const MAX = 1900000;

const STEPS: StepInfo[] = [
  { name: 'ข้อมูลเบ้', title: 'key เดียว 90% ของข้อมูล', text: 'hash(k) ส่งทุกแถวที่ k = 1 ไป partition เดียว partition ที่ 6 มี 1,821,935 แถว ส่วนที่เหลือมี 22,000 ถึง 29,000 แถว (วัดจริง)' },
  { name: 'เติม salt', title: 'เติม column salt แบบสุ่ม 0 ถึง 63', text: 'แต่ละแถวได้ salt = floor(rand() * 64) key ที่ใช้ตัดสินใจจึงเป็นคู่ (k, salt) แทนที่จะเป็น k เดี่ยวๆ แถวของ k = 1 จึงกลายเป็น 64 กลุ่มย่อย' },
  { name: 'repartition', title: 'repartition(8, "k", "salt")', text: 'กลุ่มย่อยของ k = 1 กระจายไปหลาย partition partition ที่ใหญ่สุดเหลือ 362,896 แถว จาก 1,821,935 ลดลงราว 5 เท่า (ไม่เท่ากันเป๊ะเพราะ hash ชนกันได้ จึงควรใช้ salt มากกว่าจำนวน partition)' },
  { name: 'ขยายฝั่งเล็ก', title: 'ฝั่งเล็กต้องมีทุก salt', text: 'เพื่อให้ join ยังถูก ตารางเล็ก 1,003 แถวถูกทำสำเนา 64 ชุด (crossJoin กับ range(64)) เป็น 64,192 แถว join ด้วย (k, salt) ได้ผล 2,000,000 แถวเท่ากับ join ปกติ ราคาที่จ่ายคือฝั่งเล็กใหญ่ขึ้น 64 เท่า' },
];

export default function SaltingLab() {
  const { step, go, playing, toggle } = useStepper(STEPS.length, 3400);
  const reduce = useReducedMotion();
  const data = step >= 2 ? SALTED : PLAIN;
  const t = reduce ? { duration: 0 } : { duration: 0.8, ease: 'easeInOut' as const };
  const H = 190;
  return (
    <figure className="viz">
      <div className="viz-title">Salting: กระจาย key ที่ใหญ่เกินไปออกเป็นหลายก้อน</div>
      <div className="viz-box">
        <svg viewBox="0 0 880 330" role="img" aria-label={`จำนวนแถวต่อ partition ขั้น ${step + 1}`}>
          <rect className="band" x="10" y="10" width="860" height="310" rx="12" />
          <text className="b" x="28" y="38">แถวต่อ partition หลัง repartition(8, ...)</text>
          <text className="s" x="28" y="56">{step >= 2 ? 'หลัง salt: partition ใหญ่สุด 362,896 แถว' : 'ก่อน salt: partition ใหญ่สุด 1,821,935 แถว'}</text>

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
            <text className="b" x={574} y={102}>ตัวอย่างแถวของ k = 1</text>
            {[0, 1, 2, 3].map((i) => (
              <text key={i} className="m s" x={574} y={124 + i * 15}>
                {step >= 2 ? `(k=1, salt=${[17, 3, 52, 40][i]}) -> partition ${[3, 7, 1, 5][i]}` : `(k=1) -> partition 6`}
              </text>
            ))}
          </motion.g>

          <motion.g initial={false} animate={{ opacity: step >= 3 ? 1 : 0 }} transition={t}>
            <rect className="box on" x={560} y={196} width={290} height={100} rx="8" />
            <text className="b" x={574} y={218}>ฝั่งเล็ก (dimension)</text>
            <text className="m s" x={574} y={238}>1,003 แถว  x  64 salt</text>
            <text className="m b acc" x={574} y={260}>= 64,192 แถว</text>
            <text className="s" x={574} y={280}>join ด้วย (k, salt) ได้ 2,000,000 แถวเท่าเดิม</text>
          </motion.g>
        </svg>
      </div>
      <StepControls steps={STEPS} step={step} playing={playing} go={go} toggle={toggle} />
      <figcaption className="viz-caption">ตัวเลขทุกตัวมาจาก exercises/07_performance_tuning.py ค่าที่ partition ไหนได้เท่าไรขึ้นกับ hash ของ Spark เวอร์ชันนี้ ตำแหน่ง partition ในตัวอย่างแถวด้านขวาเป็นภาพประกอบ</figcaption>
    </figure>
  );
}
