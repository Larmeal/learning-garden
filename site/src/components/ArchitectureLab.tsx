import { useState, type KeyboardEvent } from 'react';
import { motion, useReducedMotion } from 'motion/react';

type Mode = 'local' | 'cluster';
type Part = 'driver' | 'executor' | 'manager' | 'storage';

const INFO: Record<Part, { title: string; text: string }> = {
  driver: {
    title: 'Driver',
    text: 'โปรแกรมหลักของคุณ รันโค้ด Python ถือ SparkSession สร้างแผนจากคำสั่ง DataFrame แล้วแบ่งงานเป็น task ส่งให้ executor ผลลัพธ์จะมาอยู่ที่นี่เมื่อคุณเรียก collect() หรือ toPandas()',
  },
  executor: {
    title: 'Executor',
    text: 'process (JVM) ที่รับ task ไปทำกับ partition ของตัวเอง และเก็บข้อมูลที่ cache ไว้ จำนวน task ที่รันพร้อมกันได้ขึ้นกับจำนวน core ใน local mode ไม่มี process แยก executor คือ thread ใน process เดียวกับ driver',
  },
  manager: {
    title: 'Cluster manager',
    text: 'ผู้จัดสรรเครื่องและ core ให้แอปพลิเคชัน เช่น standalone, YARN หรือ Kubernetes แอปพลิเคชันขอ executor จากที่นี่ ใน local mode ไม่ต้องมี',
  },
  storage: {
    title: 'Storage',
    text: 'ที่เก็บข้อมูลจริง เช่น ไฟล์ใน disk, HDFS หรือ S3 Spark อ่านข้อมูลจากที่นี่เป็นก้อนๆ (partition) และไม่เก็บข้อมูลถาวรเอง',
  },
};

const EXEC_Y = [20, 115, 210];

export default function ArchitectureLab() {
  const [mode, setMode] = useState<Mode>('cluster');
  const [sel, setSel] = useState<Part>('driver');
  const reduce = useReducedMotion();

  const pick = (p: Part) => ({
    role: 'button' as const,
    tabIndex: 0,
    className: 'pick',
    'aria-label': INFO[p].title,
    'aria-pressed': sel === p,
    onClick: () => setSel(p),
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setSel(p);
      }
    },
  });
  const cls = (p: Part) => (sel === p ? 'box sel' : 'box');
  const active = mode === 'local' && sel === 'manager' ? 'driver' : sel;

  const packet = (key: string, from: [number, number], to: [number, number], delay: number) =>
    reduce ? null : (
      <motion.circle
        key={key}
        r="5"
        className="acc"
        initial={{ cx: from[0], cy: from[1], opacity: 0 }}
        animate={{ cx: [from[0], to[0]], cy: [from[1], to[1]], opacity: [0, 1, 1, 0] }}
        transition={{ duration: 1.6, repeat: Infinity, delay, ease: 'linear' }}
      />
    );

  return (
    <figure className="viz">
      <div className="viz-title">กดแต่ละส่วนเพื่อดูหน้าที่ แล้วลองสลับระหว่างเครื่องคุณกับ cluster</div>
      <div className="lab-controls">
        <div className="seg" role="group" aria-label="โหมดการรัน">
          <button type="button" aria-pressed={mode === 'local'} onClick={() => setMode('local')}>local[*] (เครื่องเดียว)</button>
          <button type="button" aria-pressed={mode === 'cluster'} onClick={() => setMode('cluster')}>cluster (หลายเครื่อง)</button>
        </div>
      </div>

      <div className="viz-box">
        <svg viewBox="0 0 880 310" role="img" aria-label={mode === 'local' ? 'โหมด local: driver และ executor อยู่ใน process เดียวกัน อ่านข้อมูลจาก storage' : 'โหมด cluster: driver ส่ง task ให้ executor สามตัว cluster manager จัดสรร executor และ executor อ่านข้อมูลจาก storage'}>
          <defs>
            <marker id="al-ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path className="mk" d="M0 0 L10 5 L0 10 z" />
            </marker>
          </defs>

          {mode === 'cluster' ? (
            <g key="cluster">
              <g {...pick('driver')}>
                <rect className={cls('driver')} x="20" y="88" width="190" height="112" rx="10" />
                <text className="b" x="115" y="120" textAnchor="middle">Driver</text>
                <text className="m" x="115" y="142" textAnchor="middle" style={{ fontSize: 12 }}>SparkSession</text>
                <text className="s" x="115" y="166" textAnchor="middle">วางแผน และแจก task</text>
                <text className="s" x="115" y="184" textAnchor="middle">มี 1 ตัว</text>
              </g>
              <g {...pick('manager')}>
                <rect className={cls('manager')} x="20" y="244" width="190" height="52" rx="10" />
                <text className="b" x="115" y="266" textAnchor="middle">Cluster manager</text>
                <text className="s" x="115" y="284" textAnchor="middle">standalone / YARN / K8s</text>
              </g>
              <line className="ln" x1="115" y1="202" x2="115" y2="242" markerEnd="url(#al-ar)" />
              <text className="s" x="125" y="226">ขอ executor</text>

              {EXEC_Y.map((y, i) => (
                <line key={y} className="ln" x1="210" y1={118 + i * 28} x2="348" y2={y + 35} markerEnd="url(#al-ar)" />
              ))}
              <text className="s" x="280" y="138" textAnchor="middle">ส่ง task</text>
              {EXEC_Y.map((y, i) => packet(`p${i}`, [212, 118 + i * 28], [346, y + 35], i * 0.5))}

              {EXEC_Y.map((y, i) => (
                <g key={y} {...pick('executor')}>
                  <rect className={cls('executor')} x="350" y={y} width="220" height="70" rx="10" />
                  <text className="b" x="366" y={y + 24}>Executor {i + 1}</text>
                  <rect className="band" x="366" y={y + 36} width="86" height="24" rx="5" />
                  <text className="s" x="409" y={y + 52} textAnchor="middle">task</text>
                  <rect className="band" x="462" y={y + 36} width="86" height="24" rx="5" />
                  <text className="s" x="505" y={y + 52} textAnchor="middle">task</text>
                </g>
              ))}

              {EXEC_Y.map((y, i) => (
                <line key={y} className="ln" x1="570" y1={y + 35} x2="690" y2={[95, 150, 205][i]} markerStart="url(#al-ar)" markerEnd="url(#al-ar)" />
              ))}
              <text className="s" x="630" y="132" textAnchor="middle">อ่าน / เขียน</text>
              <text className="s" x="630" y="176" textAnchor="middle">partition</text>
            </g>
          ) : (
            <g key="local">
              <rect className="band" x="20" y="14" width="560" height="282" rx="14" />
              <text className="b" x="38" y="40">1 process (JVM) บนเครื่องคุณ</text>
              <g {...pick('driver')}>
                <rect className={cls('driver')} x="40" y="100" width="170" height="112" rx="10" />
                <text className="b" x="125" y="132" textAnchor="middle">Driver</text>
                <text className="m" x="125" y="154" textAnchor="middle" style={{ fontSize: 12 }}>SparkSession</text>
                <text className="s" x="125" y="178" textAnchor="middle">วางแผน และแจก task</text>
              </g>
              <line className="ln" x1="210" y1="156" x2="298" y2="156" markerEnd="url(#al-ar)" />
              <text className="s" x="254" y="146" textAnchor="middle">ส่ง task</text>
              {packet('pl', [212, 156], [296, 156], 0)}
              {packet('pl2', [212, 156], [296, 156], 0.8)}
              <g {...pick('executor')}>
                <rect className={cls('executor')} x="300" y="56" width="262" height="212" rx="10" />
                <text className="b" x="316" y="82">Executor (thread ใน process เดียวกัน)</text>
                {Array.from({ length: 16 }, (_, i) => (
                  <rect key={i} className="band" x={318 + (i % 4) * 56} y={100 + Math.floor(i / 4) * 40} width="46" height="30" rx="5" />
                ))}
                <text className="s" x="431" y="258" textAnchor="middle">แต่ละช่อง = 1 thread (local[*] ใช้เท่าจำนวน core)</text>
              </g>
            </g>
          )}

          <g {...pick('storage')}>
            <path className={cls('storage')} d="M692 74 v146 a80 20 0 0 0 160 0 v-146" />
            <ellipse className={cls('storage')} cx="772" cy="74" rx="80" ry="20" />
            <text className="b" x="772" y="138" textAnchor="middle">Storage</text>
            <text className="s" x="772" y="158" textAnchor="middle">ไฟล์ / data lake</text>
          </g>
          {mode === 'local' && <line className="ln" x1="562" y1="162" x2="690" y2="150" markerStart="url(#al-ar)" markerEnd="url(#al-ar)" />}
        </svg>
      </div>

      <div className="viz-now" aria-live="polite">
        <strong>{INFO[active].title}</strong>
        <span>{INFO[active].text}</span>
      </div>
    </figure>
  );
}
