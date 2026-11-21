import { useState } from 'react';
import { Lines } from '../iceberg/ib';
import { Seg, type Lang } from './dv';
import data from './observe.json';

// Shows:      the same sixty requests (the dots) seen through three lenses. Metrics: only totals and a histogram, every dot grey because a metric does not know which request it counted.
//             Logs: every dot has a status, and the chosen request has its own JSON lines in two services. Trace: the same request as a bar inside a bar, gateway around inventory, with the time of each.
// Because:    "metrics tell how many, logs tell which, traces tell where the time went" only becomes believable when the same request is looked at three times and one lens cannot answer what another can.
// Control:    the lens (metrics, logs, trace) and the request to follow (a fast one, a slow one, a failed one). Both change the picture.
// Conclusion: use a metric to notice that something is wrong, a log to find which requests, and a trace (a trace id carried between services) to see which service the time or the error came from.
//
// Every number is from one run of exercises/08_observability.py (observe.json): 60 requests (40 fast, 15 slow, 5 failed in a fixed shuffled order), the counters and cumulative buckets of /metrics, and the log lines of
// the first fast, first slow and first failed request. Milliseconds change a little from run to run.

type Lens = 'metrics' | 'logs' | 'trace';
type Pick = 'apple' | 'slow' | 'bad';
const items = data.items as string[];
const H = data.histogram as number[];
const B = data.buckets as number[];

const TEXT: Record<Lang, { title: string; caption: string; lens: string; lenses: Record<Lens, string>; pick: string; picks: Record<Pick, string>; reqs: string; counters: string; hist: string; mean: string; noname: string; logsOf: string; spans: string; gw: string; inv: string; who: Record<Lens, string>; legend: [string, string, string]; chosen: string; blind: string }> = {
  th: {
    title: 'เลือกมุมมอง (Metrics, Logs, Trace) และคำขอที่จะตาม ดูว่าแต่ละมุมมองตอบอะไรได้และตอบอะไรไม่ได้ กับคำขอ 60 ตัวชุดเดียวกัน',
    caption: 'ตัวเลขทั้งหมดมาจากการรันหนึ่งครั้งของแบบฝึก 08 (observe.json): คำขอ 60 ตัว (เร็ว 40 ช้า 15 พัง 5 เรียงแบบสุ่มด้วย Seed คงที่), ตัวนับกับ Bucket จาก /metrics และบรรทัด Log ของคำขอตัวอย่างสามตัว ตัวเลขมิลลิวินาทีเปลี่ยนเล็กน้อยทุกครั้งที่รัน',
    lens: 'มุมมอง', lenses: { metrics: 'Metrics', logs: 'Logs', trace: 'Trace' }, pick: 'ตามคำขอที่', picks: { apple: 'เร็ว', slow: 'ช้า', bad: 'พัง' },
    reqs: 'คำขอ 60 ตัว', counters: 'http_requests_total', hist: 'http_request_duration_seconds (สะสม)', mean: 'เวลาเฉลี่ย', noname: 'Metric ไม่รู้ว่าตัวไหนพัง รู้แค่ว่ามี 5 ตัว', logsOf: 'บรรทัด Log ของคำขอที่เลือก', spans: 'Span ที่ใช้ trace id เดียวกัน', gw: 'gateway', inv: 'inventory', legend: ['ปกติ', 'ช้า', 'พัง'], chosen: 'คำขอที่เลือก', blind: 'Metrics มองไม่เห็นความต่าง',
    who: { metrics: 'Metrics บอกว่า "มีกี่ตัว ช้าแค่ไหน" แต่ไม่ได้บอกว่าตัวไหน', logs: 'Logs บอกว่า "ตัวไหน" แต่ละ Service เขียนของตัวเอง', trace: 'Trace ผูกสอง Service ด้วย trace id เดียว เห็นว่าเวลาหรือ Error มาจากไหน' },
  },
  en: {
    title: 'Choose a lens (metrics, logs, trace) and a request to follow, and see what each lens can and cannot answer about the same sixty requests',
    caption: 'All numbers are from one run of exercise 08 (observe.json): 60 requests (40 fast, 15 slow, 5 failed in a shuffled order with a fixed seed), the counters and buckets of /metrics, and the log lines of three sample requests. Milliseconds change slightly on every run.',
    lens: 'lens', lenses: { metrics: 'metrics', logs: 'logs', trace: 'trace' }, pick: 'follow a request that is', picks: { apple: 'fast', slow: 'slow', bad: 'failed' },
    reqs: '60 requests', counters: 'http_requests_total', hist: 'http_request_duration_seconds (cumulative)', mean: 'mean time', noname: 'A metric does not know which one failed, only that 5 did', logsOf: 'the log lines of the chosen request', spans: 'spans that share one trace id', gw: 'gateway', inv: 'inventory', legend: ['normal', 'slow', 'failed'], chosen: 'chosen request', blind: 'metrics cannot tell it apart',
    who: { metrics: 'Metrics say "how many, how slow" but not which one', logs: 'Logs say "which one", each service writing its own', trace: 'A trace ties two services with one trace id and shows where the time or the error came from' },
  },
};

export default function ThreeViewsLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [lens, setLens] = useState<Lens>('logs');
  const [pick, setPick] = useState<Pick>('bad');
  const sample = (data.samples as Record<string, { index: number; gateway: Record<string, unknown>; inventory: Record<string, unknown> }>)[pick];
  const g = sample.gateway as { ms: number; span_id: string; trace_id: string };
  const iv = sample.inventory as { ms: number; span_id: string };
  const dotColor = (k: string) => (lens === 'metrics' ? 'var(--line-strong)' : k === 'bad' ? 'var(--ib-bad)' : k === 'slow' ? 'var(--accent)' : 'var(--k2)');
  const short = (o: Record<string, unknown>) => JSON.stringify(o).replace(/"/g, '').replace(/,/g, ', ');
  const scale = 440 / Math.max(g.ms, 1);
  return (
    <figure className="viz lg ib-fig">
      <div className="viz-title">{T.title}</div>
      <Seg label={T.lens} options={(['metrics', 'logs', 'trace'] as Lens[]).map((l) => ({ id: l, text: T.lenses[l] }))} value={lens} onChange={setLens} />
      <Seg label={T.pick} options={(['apple', 'slow', 'bad'] as Pick[]).map((p) => ({ id: p, text: T.picks[p] }))} value={pick} onChange={setPick} />
      <div className="viz-box">
        <svg viewBox="0 0 880 470" role="img" aria-label={T.title}>
          <text x={20} y={28} className="ib-t">{T.reqs}</text>
          {items.map((k, i) => {
            const cx = 38 + (i % 10) * 31, cy = 62 + Math.floor(i / 10) * 34;
            const sel = lens !== 'metrics' && i === sample.index;
            return (
              <g key={i}>
                {sel && <circle cx={cx} cy={cy} r={15} style={{ fill: 'none', stroke: 'var(--fg)', strokeWidth: 3, strokeDasharray: '4 3' }} />}
                <circle cx={cx} cy={cy} r={10} style={{ fill: dotColor(k) }} />
                {lens !== 'metrics' && k === 'bad' && <path d={`M${cx - 4},${cy - 4} l8,8 M${cx + 4},${cy - 4} l-8,8`} style={{ stroke: '#fff', strokeWidth: 2 }} />}
              </g>
            );
          })}
          {lens !== 'metrics' && (
            <g>
              <circle cx={30} cy={290} r={7} style={{ fill: 'var(--k2)' }} /><text x={44} y={295} className="ib-s">{T.legend[0]}</text>
              <circle cx={130} cy={290} r={7} style={{ fill: 'var(--accent)' }} /><text x={144} y={295} className="ib-s">{T.legend[1]}</text>
              <circle cx={230} cy={290} r={7} style={{ fill: 'var(--ib-bad)' }} /><text x={244} y={295} className="ib-s">{T.legend[2]}</text>
            </g>
          )}
          <line className="ib-line" x1={350} y1={20} x2={350} y2={330} />
          {lens === 'metrics' && (
            <g>
              <text x={372} y={28} className="ib-t">{T.counters}</text>
              <text x={372} y={58} className="ib-m" style={{ fill: 'var(--fg)', fontSize: 15 }}>status="200"   {data.counts['200']}</text>
              <rect x={372} y={66} width={(data.counts['200'] / 60) * 440} height={14} style={{ fill: 'var(--k2)' }} />
              <text x={372} y={104} className="ib-m" style={{ fill: 'var(--ib-bad)', fontSize: 15 }}>status="500"   {data.counts['500']}</text>
              <rect x={372} y={112} width={(data.counts['500'] / 60) * 440} height={14} style={{ fill: 'var(--ib-bad)' }} />
              <text x={372} y={162} className="ib-t">{T.hist}</text>
              {B.map((b, i) => (
                <g key={b}>
                  <text x={372} y={192 + i * 24} className="ib-m" style={{ fill: 'var(--fg)', fontSize: 14 }}>le={b}</text>
                  <rect x={450} y={178 + i * 24} width={(H[i] / 60) * 360} height={14} style={{ fill: 'var(--accent)' }} />
                  <text x={450 + (H[i] / 60) * 360 + 8} y={191 + i * 24} className="ib-m" style={{ fontSize: 14 }}>{H[i]}</text>
                </g>
              ))}
              <text x={372} y={192 + B.length * 24} className="ib-m" style={{ fill: 'var(--fg)', fontSize: 14 }}>+Inf</text>
              <rect x={450} y={178 + B.length * 24} width={360} height={14} style={{ fill: 'var(--accent)' }} />
              <text x={450 + 360 + 8 - 36} y={191 + B.length * 24 - 0} className="ib-m" style={{ fontSize: 14, fill: '#fff' }}>{H[H.length - 1]}</text>
              <text x={372} y={300} className="ib-n">{T.mean} {data.meanMs} ms</text>
              <text x={372} y={324} className="ib-s">{T.chosen}: {T.picks[pick]} · {T.blind}</text>
            </g>
          )}
          {lens === 'logs' && (
            <g>
              <text x={372} y={28} className="ib-t">{T.logsOf}</text>
              <rect className="ib-banner" x={366} y={42} width={494} height={110} rx={8} />
              <text x={376} y={62} className="ib-s">{T.gw}</text>
              <Lines x={376} y={80} text={short(sample.gateway)} max={58} lh={18} className="ib-m" />
              <rect className="ib-banner" x={366} y={166} width={494} height={110} rx={8} />
              <text x={376} y={186} className="ib-s">{T.inv}</text>
              <Lines x={376} y={204} text={short(sample.inventory)} max={58} lh={18} className="ib-m" />
            </g>
          )}
          {lens === 'trace' && (
            <g>
              <text x={372} y={28} className="ib-t">trace_id {g.trace_id}</text>
              <text x={372} y={52} className="ib-s">{T.spans}</text>
              <rect x={372} y={74} width={440} height={44} rx={6} className="nw-cell on" />
              <text x={382} y={102} className="ib-n">{T.gw} {g.span_id} · {g.ms} ms</text>
              <rect x={400} y={134} width={Math.max(6, iv.ms * scale)} height={44} rx={6} className={pick === 'bad' ? 'nw-cell bad' : 'nw-cell ok'} />
              <text x={408} y={162} className="ib-n" style={{ fill: 'var(--fg)' }}>{T.inv} {iv.span_id} · {iv.ms} ms</text>
              <path d="M386,118 v28 h10" style={{ stroke: 'var(--line-strong)', strokeWidth: 3, fill: 'none' }} />
            </g>
          )}
          <rect className="ib-banner" x={12} y={352} width={856} height={96} rx={10} />
          <Lines x={26} y={380} text={lens === 'metrics' ? `${T.who[lens]}. ${T.noname}.` : T.who[lens]} max={86} lh={24} className="ib-n" />
        </svg>
      </div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
