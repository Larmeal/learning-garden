import { useMemo, useState } from 'react';
import { ClockControls, prog, smooth, useClock, type Lang, type Mark } from './timeline';

// How the standalone Master hands out the cores of an application: Master.scheduleExecutorsOnWorkers (Master.scala:741-821),
// reimplemented here step by step. The cluster has 3 Workers with 4 cores each and the application asks for 6 cores
// (spark.cores.max = 6). All six combinations shown here were also run on a real standalone cluster with three Workers
// (exercises/11b_standalone_spread.py) and gave the same cores per Worker and the same number of executors.

const WORKERS = 3;
const CORES = 4;
const MAX = 6;
const STEP = 0.8;

interface Ev { w: number; first: number; n: number; order: number; pass: number }

function plan(spread: boolean, ec: number | null): Ev[] {
  const min = ec ?? 1;
  const free = Array(WORKERS).fill(CORES) as number[];
  const assigned = Array(WORKERS).fill(0) as number[];
  let left = Math.min(MAX, free.reduce((a, b) => a + b, 0));
  const can = (p: number) => left >= min && free[p] - assigned[p] >= min;
  const out: Ev[] = [];
  let pass = 0;
  let list = free.map((_, i) => i).filter(can);
  while (list.length) {
    pass += 1;
    for (const p of list) {
      let keep = true;
      while (keep && can(p)) {
        out.push({ w: p, first: assigned[p], n: min, order: out.length + 1, pass });
        left -= min;
        assigned[p] += min;
        if (spread) keep = false;
      }
    }
    list = list.filter(can);
  }
  return out;
}

type EcOpt = { id: number | null };
const EC: EcOpt[] = [{ id: null }, { id: 1 }, { id: 2 }];

const TEXT: Record<Lang, {
  ecLabel: (id: number | null) => string; title: string; defaultTag: string; svgLabel: (per: string, n: number) => string;
  head: (done: number, max: number) => string; coresLine: (cores: number, given: number) => string; total: (n: number) => string; executor: string;
  riddle: { name: string; title: string; text: string };
  give: { name: string; spreadTitle: string; packTitle: string; spreadText: (ec: number, per: string) => string; packText: (per: string) => string };
  result: { name: string; noEcTitle: (n: number) => string; ecTitle: (n: number, ec: number) => string; noEcText: string; ecText: string };
  caption: string;
}> = {
  th: {
    ecLabel: (id) => (id === null ? 'ไม่ตั้ง spark.executor.cores' : `executor.cores = ${id}`),
    title: 'Master แจก Core ให้แอปอย่างไร: กระจาย หรือรวมไว้', defaultTag: ' (ค่าเริ่มต้น)',
    svgLabel: (per, n) => `Master แจก 6 Core ได้ ${per} Core ต่อ Worker และ Executor ${n} ตัว`,
    head: (done, max) => `Master วนแจก Core ตามลำดับเลข 1 ถึง 6 (${done > 0 ? `แจกแล้ว ${done} จาก ${max}` : 'ยังไม่เริ่ม'})`,
    coresLine: (cores, given) => `${cores} Core (${given} ถูกแจกแล้ว)`, total: (n) => `รวมได้ ${n} Core`, executor: 'Executor',
    riddle: { name: 'โจทย์', title: 'แอปขอ 6 Core จาก Cluster ที่มี Worker 3 ตัว ตัวละ 4 Core', text: 'Master ต้องตัดสินใจว่าจะเอา 6 Core นั้นมาจาก Worker ตัวไหนบ้าง และจะเปิด Executor กี่ตัว ซึ่งเรื่องนี้ขึ้นอยู่กับค่า spark.deploy.spreadOutApps (ตั้งที่ Master) และ spark.executor.cores (ตั้งที่แอป)' },
    give: {
      name: 'แจก',
      spreadTitle: 'spreadOutApps = true: วนไปทีละ Worker รอบละหนึ่งก้อน',
      packTitle: 'spreadOutApps = false: ใช้ Worker แรกให้เต็มก่อน แล้วค่อยไปตัวถัดไป',
      spreadText: (ec, per) => `แต่ละรอบจะให้ Worker ละ ${ec} Core แล้วไปต่อที่ Worker ถัดไป วนไปเรื่อย ๆ จนครบ 6 ตัวเลขในช่องคือลำดับที่แจก ได้ ${per} Core ต่อ Worker (วัดจริง) เอกสาร Spark บอกว่าการกระจายมักไปได้ดีกับ Data Locality ของ HDFS`,
      packText: (per) => `Worker 1 จะรับจนเต็ม 4 Core แล้วที่เหลือไปอยู่ที่ Worker 2 ได้ ${per} Core ต่อ Worker (วัดจริง) เอกสาร Spark บอกว่าการรวมไว้ในคอมพิวเตอร์ไม่กี่เครื่องเหมาะกับงานที่ใช้ CPU หนัก`,
    },
    result: {
      name: 'ผล',
      noEcTitle: (n) => `Executor ${n} ตัว: ไม่ได้ตั้ง executor.cores จึงได้ Executor เดียวต่อ Worker ที่ถูกเลือก`,
      ecTitle: (n, ec) => `Executor ${n} ตัว ตัวละ ${ec} Core`,
      noEcText: 'เมื่อไม่ตั้ง spark.executor.cores Master จะใส่ Core ทั้งหมดที่ได้ให้ Executor ตัวเดียวของ Worker นั้น (oneExecutorPerWorker) และเมื่อตั้งค่านี้แล้วเราจึงจะได้ Executor หลายตัวต่อ Worker',
      ecText: 'เมื่อตั้ง spark.executor.cores แล้ว ทุกก้อนที่แจกจะกลายเป็น Executor ใหม่ ทำให้ Worker ตัวเดียวมี Executor ได้หลายตัว (ถ้ามี Core และ Memory พอ) แต่ Executor หลายตัวก็แปลว่ามี JVM หลายตัว ซึ่งใช้ Memory มากกว่า Executor ตัวเดียวที่ใหญ่',
    },
    caption: 'อัลกอริทึมอ่านจาก Master.scheduleExecutorsOnWorkers (Spark 4.2.0) และทั้ง 6 กรณีรันจริงบน Standalone Cluster ที่มี Worker 3 ตัว ตัวละ 4 Core (exercises/11b_standalone_spread.py) ได้จำนวน Core ต่อ Worker และจำนวน Executor ตรงกับภาพ โดยสมมติว่าทุก Worker มี Memory พอ (ภาพไม่ได้จำลองเรื่อง Memory)',
  },
  en: {
    ecLabel: (id) => (id === null ? 'spark.executor.cores not set' : `executor.cores = ${id}`),
    title: 'How the Master hands out cores to an application: spread out or pack', defaultTag: ' (default)',
    svgLabel: (per, n) => `The Master gives out 6 cores: ${per} cores per Worker and ${n} executors`,
    head: (done, max) => `The Master hands out cores in order, number 1 to 6 (${done > 0 ? `${done} of ${max} given` : 'not started'})`,
    coresLine: (cores, given) => `${cores} cores (${given} given)`, total: (n) => `${n} cores in total`, executor: 'executor',
    riddle: { name: 'Problem', title: 'The app asks for 6 cores from a cluster with 3 Workers of 4 cores each', text: 'The Master must decide which Workers give those 6 cores, and how many executors to start. Two settings decide this: spark.deploy.spreadOutApps (set on the Master) and spark.executor.cores (set on the app).' },
    give: {
      name: 'Give',
      spreadTitle: 'spreadOutApps = true: go round the Workers, one chunk per round',
      packTitle: 'spreadOutApps = false: fill the first Worker first, then move to the next',
      spreadText: (ec, per) => `Each round gives ${ec} ${ec > 1 ? 'cores' : 'core'} to one Worker, then moves to the next Worker, until all 6 are given. The number in a box is the order of giving. The result is ${per} cores per Worker (measured). The Spark docs say that spreading usually works better for the data locality of HDFS.`,
      packText: (per) => `Worker 1 takes cores until it is full (4 cores) and the rest go to Worker 2. The result is ${per} cores per Worker (measured). The Spark docs say that packing onto few machines suits CPU-heavy jobs.`,
    },
    result: {
      name: 'Result',
      noEcTitle: (n) => `${n} executors: executor.cores is not set, so each chosen Worker gets one executor`,
      ecTitle: (n, ec) => `${n} executors with ${ec} ${ec > 1 ? 'cores' : 'core'} each`,
      noEcText: 'When spark.executor.cores is not set, the Master gives all the cores it got to one single executor of that Worker (oneExecutorPerWorker). Set it to get several executors per Worker.',
      ecText: 'When spark.executor.cores is set, every chunk handed out is a new executor. So one Worker can have several executors (if it has enough cores and memory). Several executors mean several JVMs, which use more memory than one big executor.',
    },
    caption: 'The algorithm is read from Master.scheduleExecutorsOnWorkers (Spark 4.2.0), and all 6 cases were run on a real standalone cluster with 3 Workers of 4 cores each (exercises/11b_standalone_spread.py). The cores per Worker and the number of executors match the picture. We assume every Worker has enough memory (the picture does not model memory).',
  },
};

export default function StandaloneSpreadLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [spread, setSpread] = useState(true);
  const [ec, setEc] = useState<number | null>(null);
  const events = useMemo(() => plan(spread, ec), [spread, ec]);
  const duration = 1.4 + events.length * STEP + 2.2;
  const clock = useClock(duration);
  const { t } = clock;
  const at = (i: number) => 1.2 + i * STEP;
  const done = events.filter((_, i) => t >= at(i));
  const cur = [...events].reverse().find((_, i) => t >= at(events.length - 1 - i));
  const perWorker = Array.from({ length: WORKERS }, (_, w) => done.filter((e) => e.w === w).reduce((a, e) => a + e.n, 0));
  const finalPer = Array.from({ length: WORKERS }, (_, w) => events.filter((e) => e.w === w).reduce((a, e) => a + e.n, 0));
  const nExec = ec === null ? finalPer.filter((c) => c > 0).length : events.length;

  const wx = (w: number) => 20 + w * 290;
  const sq = 56;

  const per = finalPer.join(' · ');
  const marks: Mark[] = [
    { at: 0, ...T.riddle },
    {
      at: at(0),
      name: T.give.name,
      title: spread ? T.give.spreadTitle : T.give.packTitle,
      text: spread ? T.give.spreadText(ec ?? 1, per) : T.give.packText(per),
    },
    {
      at: at(events.length - 1) + STEP,
      name: T.result.name,
      title: ec === null ? T.result.noEcTitle(nExec) : T.result.ecTitle(nExec, ec),
      text: ec === null ? T.result.noEcText : T.result.ecText,
    },
  ];

  return (
    <figure className="viz lg">
      <div className="viz-title">{T.title}</div>
      <div className="viz-steps" role="group" aria-label="spark.deploy.spreadOutApps">
        {([true, false] as const).map((v) => (
          <button key={String(v)} type="button" aria-pressed={spread === v} onClick={() => { setSpread(v); clock.restart(); }}>spreadOutApps = {String(v)}{v ? T.defaultTag : ''}</button>
        ))}
      </div>
      <div className="viz-steps" role="group" aria-label="spark.executor.cores">
        {EC.map((o) => (
          <button key={String(o.id)} type="button" aria-pressed={ec === o.id} onClick={() => { setEc(o.id); clock.restart(); }}>{T.ecLabel(o.id)}</button>
        ))}
      </div>
      <div className="viz-box">
        <svg viewBox="0 0 880 330" role="img" aria-label={T.svgLabel(finalPer.join(', '), nExec)}>
          <rect className="band" x="10" y="10" width="860" height="310" rx="12" />
          <text className="b" x="30" y="40">{T.head(done.reduce((a, e) => a + e.n, 0), MAX)}</text>
          {Array.from({ length: WORKERS }, (_, w) => {
            const active = cur?.w === w && t < at(events.indexOf(cur)) + STEP * 0.9;
            // executor outlines
            const mine = events.filter((e) => e.w === w);
            const groups: { from: number; len: number; shown: number }[] = [];
            if (ec === null) {
              const total = mine.reduce((a, e) => a + e.n, 0);
              if (total > 0) groups.push({ from: 0, len: total, shown: perWorker[w] });
            } else {
              mine.forEach((e) => groups.push({ from: e.first, len: e.n, shown: t >= at(e.order - 1) ? e.n : 0 }));
            }
            return (
              <g key={w} transform={`translate(${wx(w)} 56)`}>
                <rect width="270" height="240" rx="12" fill="var(--surface)" fillOpacity="0.6" stroke={active ? 'var(--accent)' : 'var(--line-strong)'} strokeWidth={active ? 3.5 : 1.8} strokeDasharray={active ? undefined : '7 5'} />
                <text className="b" x="16" y="26" style={{ fontSize: 14 }}>Worker {w + 1}</text>
                <text className="s" x="16" y="46">{T.coresLine(CORES, perWorker[w])}</text>
                {groups.map((g, gi) =>
                  g.shown > 0 ? (
                    <rect key={gi} x={14 + g.from * (sq + 4) - 4} y={72} width={g.shown * (sq + 4) + 4} height={sq + 40} rx="10" fill="color-mix(in srgb, var(--k2) 10%, var(--surface))" stroke="var(--k2)" strokeWidth="2.5" />
                  ) : null,
                )}
                {Array.from({ length: CORES }, (_, k) => {
                  const e = mine.find((x) => k >= x.first && k < x.first + x.n);
                  const shown = e && t >= at(e.order - 1);
                  const flash = e ? 1 - smooth(prog(t, at(e.order - 1), at(e.order - 1) + 0.7)) : 0;
                  return (
                    <g key={k} transform={`translate(${14 + k * (sq + 4)} 78)`}>
                      <rect width={sq - 4} height={sq - 4} rx="7" fill={shown ? 'var(--k2)' : 'var(--surface)'} stroke={shown ? 'var(--k2)' : 'var(--line-strong)'} strokeWidth="2" />
                      {shown && e && <text x={(sq - 4) / 2} y={(sq - 4) / 2 + 7} textAnchor="middle" className="big num" style={{ fill: 'var(--on-key, #fff)', fontSize: 20 }}>{e.order}</text>}
                      {shown && flash > 0.02 && <rect x="-4" y="-4" width={sq + 4} height={sq + 4} rx="9" fill="none" stroke="var(--accent)" strokeWidth="3" opacity={flash} />}
                    </g>
                  );
                })}
                {groups.map((g, gi) =>
                  g.shown > 0 ? <text key={`l${gi}`} className="s b" x={14 + g.from * (sq + 4) + 4} y={72 + sq + 34} style={{ fill: 'var(--k2)' }}>{T.executor}</text> : null,
                )}
                <text className="s m" x="16" y="214">{T.total(perWorker[w])}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <ClockControls clock={clock} marks={marks} lang={lang} />
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
