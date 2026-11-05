import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { StepControls, useStepper, type StepInfo } from './stepper';

type Scenario = 'coalesce' | 'join' | 'skew';

const SCENARIOS: { id: Scenario; label: string }[] = [
  { id: 'coalesce', label: 'รวม partition เล็ก' },
  { id: 'join', label: 'เปลี่ยน join strategy' },
  { id: 'skew', label: 'แยก partition ที่เบ้' },
];

const STEPS: Record<Scenario, StepInfo[]> = {
  coalesce: [
    { name: 'แผนตั้งต้น', title: 'แผนก่อนรัน: shuffle เป็น 200 partition', text: 'AdaptiveSparkPlan isFinalPlan=false ยังไม่รู้ขนาดข้อมูลหลัง shuffle จึงใช้ค่า spark.sql.shuffle.partitions = 200 ภาพวาด 16 ช่องแทน 200' },
    { name: 'map stage จบ', title: 'Stage แรกรันจบ: รู้ขนาดจริงแล้ว', text: 'ข้อมูลทั้งหมดหลัง partial aggregate มีแค่ 1,152 ไบต์ กระจายอยู่ใน 3 partition ที่เหลือว่าง (ความสูงแท่งไม่ตามสัดส่วน)' },
    { name: 'คำนวณเป้า', title: 'คำนวณขนาดเป้าหมายต่อ partition', text: 'target = max(min(total / parallelism, advisory 64MB), minPartitionSize 1MB) = max(72 B, 1 MB) = 1 MB เพราะข้อมูลทั้งก้อนเล็กกว่าเป้ามาก' },
    { name: 'รวมกัน', title: 'CoalesceShufflePartitions รวม partition ติดกัน', text: 'partition ที่อยู่ติดกันถูกรวมจนใกล้ 1 MB ที่นี่รวมเหลือ 1 ก้อน stage ถัดไปจึงมี 1 task แทน 200 task (วัดจริง: getNumPartitions = 1)' },
  ],
  join: [
    { name: 'แผนตั้งต้น', title: 'แผนก่อนรัน: Sort Merge Join', text: 'Optimizer เดาขนาดจากสถิติของ source ซึ่งไม่รู้ว่าฝั่งขวาหลัง groupBy เหลือกี่แถว จึงเลือก SortMergeJoin ที่ต้อง shuffle ทั้งสองฝั่ง' },
    { name: 'stage จบ', title: 'Shuffle stage ทั้งสองฝั่งรันจบ', text: 'ฝั่งซ้ายยังใหญ่ แต่ฝั่งขวาเหลือ 5 แถวหลัง groupBy (id % 5) ขนาดจริงเล็กกว่า 10 MB มาก' },
    { name: 'plan ใหม่', title: 'Re-optimize: เปลี่ยนเป็น Broadcast Hash Join', text: 'DynamicJoinSelection เห็นว่าฝั่งขวาเล็กพอ จึงสร้างแผนใหม่ที่ broadcast ฝั่งขวา และ AQE ยอมรับเพราะแผนใหม่ไม่มี shuffle เพิ่ม' },
    { name: 'ผลลัพธ์', title: 'ฝั่งซ้ายอ่านแบบ local', text: 'ฝั่งซ้าย shuffle ไปแล้ว AQE เลยไม่ทิ้ง แต่อ่านด้วย AQEShuffleRead local: task อ่านไฟล์ shuffle ของ map task ที่อยู่เครื่องเดียวกัน ไม่ต้อง sort และไม่ต้องดึงข้ามเครื่อง' },
  ],
  skew: [
    { name: 'ขนาดจริง', title: 'Stage แรกจบ: ดูขนาดของแต่ละ partition', text: 'ด้านซ้ายมี partition เดียวที่ใหญ่กว่าชาวบ้านมาก (ตัวเลขในภาพเป็นตัวอย่าง หน่วย KB) ด้านขวาสม่ำเสมอ' },
    { name: 'ตรวจ skew', title: 'หาเส้นที่ถือว่า skew', text: 'threshold = max(skewedPartitionThresholdInBytes, median × skewedPartitionFactor 5) ที่นี่ median = 63.5 KB จึงได้เส้น 317.5 KB partition ที่ 4 (400 KB) เกินเส้น' },
    { name: 'แยก', title: 'OptimizeSkewedJoin แยก partition ใหญ่ตามช่วงของ map task', text: 'partition ที่ 4 ถูกหั่นเป็น 3 ชิ้นตาม advisoryPartitionSizeInBytes (ภาพใช้ 140 KB) และ partition ที่ 4 ฝั่งขวาถูกทำสำเนา 3 ชุดให้จับคู่ครบ' },
    { name: 'ผลลัพธ์', title: 'แต่ละ task งานพอๆ กัน', text: 'จาก 8 task ที่ task หนึ่งหนักเกินเพื่อน กลายเป็น 10 task ที่หนักใกล้กัน plan แสดง SortMergeJoin(skew=true) และ AQEShuffleRead skewed' },
  ],
};

const EASE = { duration: 0.7, ease: 'easeInOut' as const };

function CoalesceScene({ step }: { step: number }) {
  const slots = Array.from({ length: 16 }, (_, i) => i);
  const filled = new Set([2, 7, 12]);
  const merged = step >= 3;
  return (
    <svg viewBox="0 0 880 330" role="img" aria-label="ภาพรวม shuffle partition">
      <rect className="band" x="10" y="10" width="860" height="310" rx="12" />
      <text className="b" x="28" y="38">ผลของ Exchange hashpartitioning(k, 200) ที่ map stage เขียนไว้</text>
      <text className="s" x="28" y="56">วาด 16 ช่องแทน 200 ช่อง (ส่วนใหญ่ว่าง)</text>

      {slots.map((i) => {
        const x = 40 + i * 50;
        return (
          <g key={i}>
            <motion.rect className="box" x={x} y={110} width={42} height={120} rx="5" animate={{ opacity: merged ? 0.25 : 1 }} transition={EASE} />
            <text className="s" x={x + 21} y={246} textAnchor="middle">{i + 1}</text>
            {filled.has(i) && (
              <motion.rect
                className="k1"
                x={x + 6}
                width={30}
                rx="4"
                initial={false}
                animate={{ y: step >= 1 ? 160 : 230, height: step >= 1 ? 70 : 0, opacity: step >= 1 ? 1 : 0 }}
                transition={EASE}
              />
            )}
          </g>
        );
      })}

      <motion.rect
        x={34}
        y={100}
        height={140}
        rx="10"
        fill="none"
        className="coalesce-frame"
        initial={false}
        animate={{ width: merged ? 812 : 0, opacity: merged ? 1 : 0 }}
        transition={EASE}
      />
      <motion.g initial={false} animate={{ opacity: merged ? 1 : 0 }} transition={{ ...EASE, delay: merged ? 0.5 : 0 }}>
        <text className="b acc" x={440} y={274} textAnchor="middle" style={{ fontSize: 15 }}>AQEShuffleRead coalesced: 1 partition = 1 task</text>
      </motion.g>

      <motion.g initial={false} animate={{ opacity: step === 1 || step === 2 ? 1 : 0 }} transition={EASE}>
        <text className="m b" x={440} y={294} textAnchor="middle">รวม 1,152 B  (48 แถว = 16 map task x 3 key)</text>
      </motion.g>
      <motion.g initial={false} animate={{ opacity: step === 2 ? 1 : 0 }} transition={EASE}>
        <text className="m" x={440} y={314} textAnchor="middle">target = max(min(1152 / 16, 64MB), 1MB) = 1MB</text>
      </motion.g>
    </svg>
  );
}

function JoinScene({ step }: { step: number }) {
  const bhj = step >= 2;
  const ran = step >= 1;
  const label = (smj: string, b: string) => (bhj ? b : smj);
  return (
    <svg viewBox="0 0 880 330" role="img" aria-label="ภาพเปลี่ยน join strategy">
      <rect className="band" x="10" y="10" width="860" height="310" rx="12" />
      <defs>
        <marker id="aq-ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path className="mk" d="M0 0 L10 5 L0 10 z" />
        </marker>
      </defs>

      <motion.rect className="box" x={300} y={28} width={280} height={46} rx="8" initial={false} animate={{ stroke: bhj ? 'var(--accent)' : 'var(--line-strong)' }} transition={EASE} />
      <text className="b m" x={440} y={57} textAnchor="middle" style={{ fontSize: 14 }}>{label('SortMergeJoin', 'BroadcastHashJoin')}</text>

      <line className="ln" x1={400} y1={122} x2={400} y2={76} markerEnd="url(#aq-ar)" />
      <line className="ln" x1={480} y1={122} x2={480} y2={76} markerEnd="url(#aq-ar)" />

      {/* left side */}
      <rect className="box" x={150} y={124} width={250} height={44} rx="8" />
      <text className="m" x={275} y={151} textAnchor="middle">{bhj ? 'AQEShuffleRead local' : 'Sort [k]'}</text>
      <line className="ln" x1={275} y1={198} x2={275} y2={170} markerEnd="url(#aq-ar)" />
      <rect className="box" x={150} y={200} width={250} height={44} rx="8" />
      <text className="m" x={275} y={227} textAnchor="middle">Exchange hashpartitioning(k, 200)</text>
      <line className="ln" x1={275} y1={274} x2={275} y2={246} markerEnd="url(#aq-ar)" />
      <rect className="box" x={150} y={276} width={250} height={34} rx="8" />
      <text className="s" x={275} y={298} textAnchor="middle">Range 5,000,000 แถว (ฝั่งซ้าย)</text>

      {/* right side */}
      <motion.rect className="box" x={480} y={124} width={250} height={44} rx="8" initial={false} animate={{ stroke: bhj ? 'var(--accent)' : 'var(--line-strong)' }} transition={EASE} />
      <text className="m" x={605} y={151} textAnchor="middle">{bhj ? 'BroadcastExchange' : 'Sort [k]'}</text>
      <line className="ln" x1={605} y1={198} x2={605} y2={170} markerEnd="url(#aq-ar)" />
      <motion.rect className="box" x={480} y={200} width={250} height={44} rx="8" initial={false} animate={{ opacity: bhj ? 0.18 : 1 }} transition={EASE} />
      <motion.text className="m" x={605} y={227} textAnchor="middle" initial={false} animate={{ opacity: bhj ? 0.3 : 1 }} transition={EASE}>Exchange hashpartitioning(k, 200)</motion.text>
      <line className="ln" x1={605} y1={274} x2={605} y2={246} markerEnd="url(#aq-ar)" />
      <rect className="box" x={480} y={276} width={250} height={34} rx="8" />
      <text className="s" x={605} y={298} textAnchor="middle">groupBy(id % 5).count()</text>

      {/* real sizes after the stages ran */}
      <motion.g initial={false} animate={{ opacity: ran ? 1 : 0 }} transition={EASE}>
        <text className="m b" x={140} y={223} textAnchor="end">ใหญ่</text>
        <text className="m b acc" x={740} y={223}>5 แถว (เล็ก)</text>
      </motion.g>
      <motion.text className="s" x={760} y={148} initial={false} animate={{ opacity: bhj ? 1 : 0 }} transition={EASE}>
        ส่งไปทุก executor
      </motion.text>
    </svg>
  );
}

const LEFT = [60, 70, 55, 400, 65, 72, 58, 62];
const SKEW_SCALE = 0.36;
const BASE = 280;

function SkewScene({ step }: { step: number }) {
  const split = step >= 2;
  const lineY = BASE - 317.5 * SKEW_SCALE;
  const pieces = [133, 133, 134];
  const starts = [0, 133, 266];
  return (
    <svg viewBox="0 0 880 330" role="img" aria-label="ภาพแยก partition ที่เบ้">
      <rect className="band" x="10" y="10" width="860" height="310" rx="12" />
      <text className="b" x="28" y="36">ฝั่งซ้าย (ใหญ่ มี skew)</text>
      <text className="b" x="568" y="36">ฝั่งขวา</text>

      {LEFT.map((v, i) => {
        const x = 40 + i * 62;
        const isBig = i === 3;
        return (
          <g key={i}>
            <text className="s" x={x + 22} y={BASE + 18} textAnchor="middle">{i + 1}</text>
            {isBig ? (
              pieces.map((p, k) => (
                <motion.rect
                  key={k}
                  className={step >= 1 ? 'k2' : 'k1'}
                  x={x}
                  width={44}
                  rx="3"
                  initial={false}
                  animate={{
                    y: BASE - (starts[k] + p) * SKEW_SCALE - (split ? k * 9 : 0),
                    height: p * SKEW_SCALE,
                  }}
                  transition={EASE}
                />
              ))
            ) : (
              <rect className="k1" x={x} y={BASE - v * SKEW_SCALE} width={44} height={v * SKEW_SCALE} rx="3" />
            )}
            <text className="s m" x={x + 22} y={BASE - v * SKEW_SCALE - 6} textAnchor="middle" style={{ opacity: split && isBig ? 0 : 1 }}>{v}</text>
          </g>
        );
      })}
      <motion.g initial={false} animate={{ opacity: step >= 1 ? 1 : 0 }} transition={EASE}>
        <line x1={34} x2={540} y1={lineY} y2={lineY} stroke="var(--accent)" strokeWidth="1.8" strokeDasharray="6 5" />
        <text className="s acc b" x={540} y={lineY - 6} textAnchor="end">เส้น skew = max(50KB, 63.5 x 5) = 317.5 KB</text>
      </motion.g>

      {/* right side: even partitions; the 4th one is replicated */}
      {Array.from({ length: 8 }, (_, i) => {
        const x = 580 + (i % 4) * 70;
        const y = i < 4 ? 70 : 190;
        const hot = i === 3;
        return (
          <g key={i}>
            <rect className={hot && split ? 'box on' : 'box'} x={x} y={y} width={60} height={50} rx="6" />
            <text className="s" x={x + 30} y={y + 29} textAnchor="middle">{i + 1}</text>
          </g>
        );
      })}
      <motion.g initial={false} animate={{ opacity: split ? 1 : 0 }} transition={EASE}>
        <text className="s acc b" x={580} y={140}>partition 4 ถูกทำสำเนา 3 ชุด</text>
        <text className="s" x={580} y={156}>(ให้จับคู่กับแต่ละชิ้นฝั่งซ้าย)</text>
      </motion.g>
      <motion.g initial={false} animate={{ opacity: step === 3 ? 1 : 0 }} transition={EASE}>
        <text className="b m" x={580} y={300}>7 task ปกติ + 3 task ที่แยก = 10 task</text>
      </motion.g>
    </svg>
  );
}

export default function AqeLab() {
  const [sc, setSc] = useState<Scenario>('coalesce');
  const { step, go, playing, toggle, reset } = useStepper(4, 3200);
  const reduce = useReducedMotion();
  void reduce;

  const pick = (s: Scenario) => {
    setSc(s);
    reset();
  };

  return (
    <figure className="viz">
      <div className="viz-title">AQE ตัดสินใจใหม่หลัง stage แรกรันจบ</div>
      <div className="viz-steps" role="group" aria-label="เลือกสถานการณ์">
        {SCENARIOS.map((s) => (
          <button key={s.id} type="button" aria-pressed={sc === s.id} onClick={() => pick(s.id)}>
            {s.label}
          </button>
        ))}
      </div>
      <div className="viz-box">
        {sc === 'coalesce' && <CoalesceScene step={step} />}
        {sc === 'join' && <JoinScene step={step} />}
        {sc === 'skew' && <SkewScene step={step} />}
      </div>
      <StepControls steps={STEPS[sc]} step={step} playing={playing} go={go} toggle={toggle} />
    </figure>
  );
}
