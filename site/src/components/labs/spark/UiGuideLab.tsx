import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';

// Which Spark UI page answers which question. The tabs are the ones of Spark 4.2.0.
// Numbers quoted in the hints were measured in this course: spill (chapter 7), skewed partition (chapter 7),
// 14 tasks of the groupBy job and shuffle bytes (chapter 11). Field names are those of the REST API
// (/api/v1/applications/<id>/stages and friends) that exercises/11_deployment_ui.py reads.

type Tab = 'Jobs' | 'Stages' | 'Storage' | 'Environment' | 'Executors' | 'SQL / DataFrame';
const TABS: Tab[] = ['Jobs', 'Stages', 'Storage', 'Environment', 'Executors', 'SQL / DataFrame'];

interface Symptom {
  id: string;
  label: string;
  tab: Tab;
  where: string;
  look: string;
  field: string;
  next: string;
}

const SYMPTOMS: Symptom[] = [
  {
    id: 'skew',
    label: 'บาง task ช้ากว่าเพื่อนมาก',
    tab: 'Stages',
    where: 'คลิก stage ที่ช้า แล้วดู Summary Metrics (Duration)',
    look: 'เทียบ Max กับ Median ของ Duration ถ้า Max ใหญ่กว่า Median หลายเท่า คือ skew ตัวอย่างในบทที่ 7: partition หนึ่งมี 1,821,935 แถว ที่เหลือราว 22,000 ถึง 29,000',
    field: 'taskSummary: executorRunTime (quantiles), shuffleReadMetrics.readBytes',
    next: 'บทที่ 7: salting หรือให้ AQE แยก partition (skew join)',
  },
  {
    id: 'spill',
    label: 'job ช้าและ stage เขียน disk',
    tab: 'Stages',
    where: 'หน้า stage: Summary Metrics และตาราง task',
    look: 'คอลัมน์ Spill (Memory) กับ Spill (Disk) แสดงเมื่อมากกว่า 0 ในบทที่ 7 เรียงข้อมูล 6 ล้านแถวบน memory 600 MB ได้ราว 280 MiB และ 232 MiB',
    field: 'memoryBytesSpilled, diskBytesSpilled',
    next: 'บทที่ 7 และบทที่ 13: เพิ่ม partition หรือ memory',
  },
  {
    id: 'tiny',
    label: 'task เยอะมากแต่แต่ละตัวเสร็จเร็ว',
    tab: 'Jobs',
    where: 'หน้า Jobs: คอลัมน์ Tasks (succeeded/total) และ Stage ที่เป็นสาเหตุ',
    look: 'ถ้า stage หลัง shuffle มี 200 task ที่แต่ละตัวมีข้อมูลไม่กี่ไบต์ แปลว่า shuffle.partitions มากเกินสำหรับข้อมูลนี้ (ในแล็บ 14 task คือ 8 map + 6 shuffle partition)',
    field: 'numTasks ต่อ stage, inputBytes, shuffleReadBytes',
    next: 'บทที่ 7: จำนวน partition หลัง shuffle กับ AQE coalesce',
  },
  {
    id: 'plan',
    label: 'อยากรู้ว่า join เลือกวิธีไหนจริง',
    tab: 'SQL / DataFrame',
    where: 'คลิก query ในรายการ แล้วดูแผนแบบกราฟ',
    look: 'กราฟ operator พร้อม metric ต่อ node เช่น number of output rows, spill size, data size ของ BroadcastExchange กับ AQE แผนที่เห็นคือแผนสุดท้ายหลังปรับ',
    field: 'REST: /sql (status, duration ของแต่ละ query)',
    next: 'บทที่ 6: อ่านแผนและ AQE',
  },
  {
    id: 'cache',
    label: 'cache() แล้วไม่แน่ใจว่าเก็บอยู่ไหม',
    tab: 'Storage',
    where: 'แท็บ Storage ว่ามี RDD ที่ cache ไหม ขนาดเท่าไร อยู่ memory หรือ disk',
    look: 'ก่อน action แรกแท็บนี้ว่าง (cache เป็น lazy) หลัง action แรกเห็น partition ที่ cache ถ้า groupBy แล้ว cache จะเห็น 200 partition (บทที่ 7)',
    field: 'REST: /storage/rdd (numCachedPartitions, memoryUsed, diskUsed)',
    next: 'บทที่ 7: cache มีราคา',
  },
  {
    id: 'exec',
    label: 'executor หายหรือมีไม่ครบ',
    tab: 'Executors',
    where: 'แท็บ Executors: ตารางทุก executor พร้อม driver',
    look: 'ดูจำนวน executor, core, memory, GC time และ task ที่ fail ถ้าเปิด dynamic allocation executor ที่ว่างจะถูกปล่อยคืน (ในแล็บ: ไม่มี executor ก่อน job, 2 ตัวหลัง job)',
    field: 'REST: /executors (active) และ /allexecutors (รวมที่ตายแล้ว)',
    next: 'หัวข้อ deploy ด้านล่าง: dynamic allocation และ resource',
  },
  {
    id: 'conf',
    label: 'config ที่ตั้งไว้มีผลจริงไหม',
    tab: 'Environment',
    where: 'แท็บ Environment: Spark Properties',
    look: 'แสดงค่า config ที่ application ใช้จริงหลังรวมจากทุกแหล่ง (ในแล็บเห็น spark.master กับ spark.executor.memory ตรงกับที่ตั้ง) ค่าที่ไม่ได้ตั้งจะไม่อยู่ในรายการ ต้องดูค่าเริ่มต้นจากเอกสารหรือ spark.conf.get',
    field: 'REST: /environment (sparkProperties)',
    next: 'บทที่ 6: spark.conf.get ได้ค่าพร้อมหน่วย',
  },
];

export default function UiGuideLab() {
  const [cur, setCur] = useState('skew');
  const reduce = useReducedMotion();
  const s = SYMPTOMS.find((x) => x.id === cur)!;
  const t = reduce ? { duration: 0 } : { duration: 0.35 };
  return (
    <figure className="viz">
      <div className="viz-title">เจออาการนี้ ให้เปิดหน้าไหนของ Spark UI</div>
      <div className="viz-steps" role="group" aria-label="เลือกอาการ">
        {SYMPTOMS.map((x) => (
          <button key={x.id} type="button" aria-pressed={cur === x.id} onClick={() => setCur(x.id)}>
            {x.label}
          </button>
        ))}
      </div>
      <div className="viz-box ug-wrap">
        <div className="ug-tabs" role="tablist" aria-label="แท็บของ Spark UI">
          {TABS.map((tab) => (
            <div key={tab} className="ug-tab" data-on={tab === s.tab ? '' : undefined} role="tab" aria-selected={tab === s.tab}>
              {tab}
              {tab === s.tab && <motion.span layoutId="ug-underline" className="ug-underline" transition={t} />}
            </div>
          ))}
        </div>
        <motion.div key={s.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={t} className="ug-panel">
          <div>
            <span className="ug-k">ดูที่</span>
            <strong>{s.tab}</strong>
            <span>{s.where}</span>
          </div>
          <div>
            <span className="ug-k">อ่านอะไร</span>
            <span>{s.look}</span>
          </div>
          <div>
            <span className="ug-k">field ใน REST</span>
            <code>{s.field}</code>
          </div>
          <div>
            <span className="ug-k">แล้วทำอะไรต่อ</span>
            <span>{s.next}</span>
          </div>
        </motion.div>
      </div>
    </figure>
  );
}
