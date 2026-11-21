import { useState } from 'react';
import { Banner } from '../iceberg/ib';
import { Seg, type Lang } from '../devops/dv';
import data from './labels.json';

// Shows:      four Pods drawn as cards, each with its labels as small tags. The reader picks a selector and the cards that it selects light up while the others fade.
//             A second switch takes the label `app` away from Pod a2, and the selection changes without anyone touching the selector.
// Because:    a selector is a question asked again and again, not a list of names. The reader should see that "who is selected" is decided by the labels at this moment.
// Control:    the selector (six of them), and whether Pod a2 still has its `app` label.
// Conclusion: Services, ReplicaSets and `kubectl -l` never keep a list of Pods. They ask "whose labels match" every time.
//
// The four Pods and the six selectors are those of exercises/03_labels_api.py (labels.json holds the answers printed there). The browser evaluates the same selectors on the same labels.

type Sel = keyof typeof data.selectors;
const PODS: { name: string; labels: Record<string, string> }[] = [
  { name: 'a1', labels: { app: 'shop', tier: 'web', env: 'prod' } },
  { name: 'a2', labels: { app: 'shop', tier: 'web', env: 'dev' } },
  { name: 'a3', labels: { app: 'shop', tier: 'db', env: 'prod' } },
  { name: 'a4', labels: { app: 'blog', tier: 'web', env: 'prod' } },
];
const TESTS: Record<string, (l: Record<string, string>) => boolean> = {
  'app=shop': (l) => l.app === 'shop',
  'app=shop,tier=web': (l) => l.app === 'shop' && l.tier === 'web',
  'env!=dev': (l) => l.env !== 'dev',
  'tier in (web,db),app=blog': (l) => ['web', 'db'].includes(l.tier) && l.app === 'blog',
  '!env  (no env label)': (l) => l.env === undefined,
  'env  (has env label)': (l) => l.env !== undefined,
};
const KEYS = Object.keys(data.selectors) as Sel[];

const TEXT: Record<Lang, { title: string; caption: string; sel: string; a2: string; a2opts: [string, string]; picked: (n: number) => string; note: Record<string, string> }> = {
  th: {
    title: 'เลือก Selector แล้วดูว่า Pod ใบไหนถูกเลือก จากนั้นลองเอา Label ออกจาก Pod a2',
    caption: 'Pod สี่ตัวกับ Selector หกแบบมาจากแบบฝึก 03 ผลที่ตารางพิมพ์ออกมาตรงกับที่ภาพนี้คำนวณในเบราว์เซอร์ ส่วนการเอา Label app ออกจาก a2 ก็รันจริงในแบบฝึกเดียวกัน (kubectl label pod a2 app-) แล้ว app=shop เหลือ a1 กับ a3',
    sel: 'Selector', a2: 'Pod a2', a2opts: ['ยังมี app=shop', 'เอา app ออกแล้ว'],
    picked: (n) => `${n} จาก 4 ตัวถูกเลือก`,
    note: {
      'app=shop': 'เลือกทุก Pod ที่มี app เป็น shop',
      'app=shop,tier=web': 'เครื่องหมายจุลภาคคือ "และ": ต้องตรงทั้งสองข้อ',
      'env!=dev': 'รวม Pod ที่ไม่มี env เลยด้วย (ในที่นี้ทุกตัวมี env จึงเหลือ a1 a3 a4)',
      'tier in (web,db),app=blog': 'Selector แบบเซต: tier เป็น web หรือ db และ app เป็น blog',
      '!env  (no env label)': 'เลือก Pod ที่ไม่มี Label env เลย ซึ่งตอนนี้ไม่มีตัวไหน',
      'env  (has env label)': 'เลือก Pod ที่มี Label env ไม่ว่าค่าจะเป็นอะไร',
    },
  },
  en: {
    title: 'Pick a selector and see which Pod cards it selects, then take a label away from Pod a2',
    caption: 'The four Pods and six selectors are from exercise 03. The results the exercise printed match what this picture computes in the browser. Taking the app label off a2 was also run for real (kubectl label pod a2 app-), and app=shop then selects a1 and a3.',
    sel: 'selector', a2: 'Pod a2', a2opts: ['still has app=shop', 'app removed'],
    picked: (n) => `${n} of 4 Pods selected`,
    note: {
      'app=shop': 'selects every Pod whose app is shop',
      'app=shop,tier=web': 'a comma means "and": both parts must match',
      'env!=dev': 'also selects Pods that have no env at all (here every Pod has env, so a1 a3 a4 remain)',
      'tier in (web,db),app=blog': 'a set expression: tier is web or db, and app is blog',
      '!env  (no env label)': 'selects Pods with no env label at all, which is none right now',
      'env  (has env label)': 'selects Pods that have an env label, whatever its value',
    },
  },
};

export default function LabelsLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [sel, setSel] = useState<Sel>(KEYS[0]);
  const [gone, setGone] = useState(false);
  const pods = PODS.map((p) => (p.name === 'a2' && gone ? { ...p, labels: Object.fromEntries(Object.entries(p.labels).filter(([k]) => k !== 'app')) } : p));
  const hit = pods.map((p) => TESTS[sel](p.labels));
  const n = hit.filter(Boolean).length;
  return (
    <figure className="viz lg ib-fig">
      <div className="viz-title">{T.title}</div>
      <Seg label={T.sel} options={KEYS.map((k) => ({ id: k, text: k.split('  ')[0] }))} value={sel} onChange={setSel} />
      <Seg label={T.a2} options={[{ id: 'keep', text: T.a2opts[0] }, { id: 'gone', text: T.a2opts[1] }]} value={gone ? 'gone' : 'keep'} onChange={(v) => setGone(v === 'gone')} />
      <div className="viz-box">
        <svg viewBox="0 0 880 330" role="img" aria-label={T.title}>
          <text x={20} y={32} className="ib-m" style={{ fontSize: 17 }}>kubectl get pods -l "{sel.split('  ')[0]}"</text>
          {pods.map((p, i) => {
            const x = 20 + i * 214;
            const on = hit[i];
            return (
              <g key={p.name} style={{ opacity: on ? 1 : 0.45 }}>
                <rect className={on ? 'nw-cell on' : 'nw-cell'} x={x} y={56} width={196} height={190} rx={12} style={on ? { strokeWidth: 3.5 } : { strokeDasharray: '8 6' }} />
                <text x={x + 14} y={86} className="ib-n" style={{ fontSize: 20 }}>Pod {p.name}</text>
                {Object.entries(p.labels).map(([k, v], j) => (
                  <g key={k}>
                    <rect x={x + 14} y={104 + j * 40} width={168} height={30} rx={15} style={{ fill: on ? 'var(--accent-soft)' : 'var(--surface-2)', stroke: on ? 'var(--accent)' : 'var(--line-strong)', strokeWidth: 1.5 }} />
                    <text x={x + 98} y={124 + j * 40} textAnchor="middle" className="ib-m" style={{ fill: 'var(--fg)' }}>{k}={v}</text>
                  </g>
                ))}
                {p.name === 'a2' && gone && <text x={x + 98} y={236} textAnchor="middle" className="ib-s" style={{ fill: 'var(--ib-bad)' }}>app-</text>}
                <text x={x + 180} y={86} textAnchor="end" className="ib-n" style={{ fill: on ? 'var(--k2)' : 'var(--muted)' }}>{on ? '✓' : '✗'}</text>
              </g>
            );
          })}
          <Banner y={266} text={`${T.picked(n)}: ${pods.filter((_, i) => hit[i]).map((p) => p.name).join(' ') || '—'}`} />
        </svg>
      </div>
      <p className="viz-now"><strong>{sel.split('  ')[0]}</strong><span>{T.note[sel]}</span></p>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
