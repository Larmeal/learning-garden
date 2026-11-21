import { useState } from 'react';
import { Banner } from '../iceberg/ib';
import { Seg, Tile, Arrow, type Lang } from '../devops/dv';
import data from './ingress.json';

// Shows:      one door (the ingress controller, a Pod running nginx) with a list of rules on it, and three Services behind it. The reader picks a request (a host name and a path), the request card
//             walks to the door, the rule it matches lights up, and the card ends at a Service, or at the door's own 404.
// Because:    host and path matching, "longest path wins" and "/apix is not under /api" are about WHICH rule a request meets first. A table of results hides that, a lit-up rule shows it.
// Control:    the request (six of them, those of the exercise).
// Conclusion: an Ingress is a list of rules. The controller reads them and routes by Host and by path prefix, and it forwards the whole path unchanged.
//
// The six requests and what answered (code and body) are the results printed by exercises/07b_ingress.py (ingress.json). Which rule is lit is computed in the browser by the same rule (longest prefix of whole segments).

const RULES = [
  { host: 'shop.test', path: '/', svc: 'shop' },
  { host: 'shop.test', path: '/api', svc: 'api' },
  { host: 'blog.test', path: '/', svc: 'blog' },
];
type Row = { host: string; path: string; code: string; body: string };
const ROWS = data.routes as Row[];
const prefix = (rule: string, path: string) => rule === '/' || path === rule || path.startsWith(rule + '/');
function match(host: string, path: string) {
  const c = RULES.map((r, i) => ({ r, i })).filter(({ r }) => r.host === host && prefix(r.path, path));
  c.sort((a, b) => b.r.path.length - a.r.path.length);
  return c[0]?.i ?? -1;
}
const SVC = ['shop', 'api', 'blog'];

const TEXT: Record<Lang, { title: string; caption: string; req: string; door: string; rules: string; reply: string; no: string; note: (r: Row, i: number) => string }> = {
  th: {
    title: 'เลือกคำขอ แล้วดูว่ากฎข้อไหนของ Ingress ตรงกับมัน และคำขอไปจบที่ Service ไหน',
    caption: 'คำขอทั้งหกแบบและคำตอบ (รหัส กับเนื้อความ) คือผลที่พิมพ์ออกมาจากการรันจริงในแบบฝึก 07b กับ ingress-nginx v1.11.2 ส่วนกฎที่ถูกไฮไลต์คำนวณในเบราว์เซอร์ด้วยหลักเดียวกัน (Prefix ของ Path ตามส่วน ยาวที่สุดชนะ)',
    req: 'คำขอ', door: 'ingress-nginx (Pod ตัวหนึ่ง)', rules: 'กฎของ Ingress', reply: 'คำตอบ', no: 'ไม่มีกฎที่ตรง',
    note: (r, i) => i < 0 ? (r.host === 'other.test' ? 'ไม่มีกฎสำหรับ Host นี้ จึงได้หน้า 404 ของตัว Controller เอง' : 'ไม่มีกฎที่ตรง') : r.path === '/apix' ? 'กฎ /api ใช้กับ /api และ /api/... เท่านั้น /apix จึงตกไปที่กฎ / ของ shop ซึ่งไม่มีไฟล์นี้ (404 จาก Pod ไม่ใช่จาก Controller)' : r.path.startsWith('/api') && i === 1 ? 'ตรงทั้งกฎ / และ /api กฎที่ Path ยาวกว่าชนะ และ Controller ส่ง Path เต็ม /api/x/ ไปให้ Pod (ไม่ตัด Prefix ทิ้ง)' : `ตรงกฎข้อที่ ${i + 1} จึงส่งต่อไปที่ Service ${SVC[i]}`,
  },
  en: {
    title: 'Pick a request and see which Ingress rule it matches, and which Service it ends at',
    caption: 'The six requests and the answers (code and body) are what a real run of exercise 07b printed, with ingress-nginx v1.11.2. The lit rule is computed in the browser with the same rule (path prefix by whole segments, longest wins).',
    req: 'request', door: 'ingress-nginx (one Pod)', rules: 'Ingress rules', reply: 'reply', no: 'no rule matches',
    note: (r, i) => i < 0 ? (r.host === 'other.test' ? 'There is no rule for this host, so the controller answers with its own 404 page.' : 'No rule matches.') : r.path === '/apix' ? 'The /api rule covers /api and /api/... only. /apix falls to the / rule of shop, which has no such file (a 404 from the Pod, not from the controller).' : r.path.startsWith('/api') && i === 1 ? 'Both the / rule and the /api rule match. The longer path wins, and the controller sends the whole path /api/x/ to the Pod (the prefix is not stripped).' : `It matches rule ${i + 1}, so it is passed on to Service ${SVC[i]}.`,
  },
};

export default function IngressLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [k, setK] = useState(0);
  const row = ROWS[k];
  const m = match(row.host, row.path);
  const ok = row.code === '200';
  return (
    <figure className="viz lg ib-fig">
      <div className="viz-title">{T.title}</div>
      <Seg label={T.req} options={ROWS.map((r, i) => ({ id: String(i), text: `${r.host}${r.path}` }))} value={String(k)} onChange={(v) => setK(Number(v))} />
      <div className="viz-box">
        <svg viewBox="0 0 880 390" role="img" aria-label={T.title}>
          <Tile x={14} y={140} w={160} h={84} title={`Host: ${row.host}`} sub={`GET ${row.path}`} state="on" />
          <Arrow x1={176} y1={182} x2={232} y2={182} />
          <rect className="ib-node" x={236} y={20} width={380} height={290} rx={14} />
          <text x={252} y={48} className="ib-n">{T.door}</text>
          <text x={252} y={72} className="ib-s">{T.rules}</text>
          {RULES.map((r, i) => (
            <g key={i}>
              <rect className={i === m ? 'nw-cell on' : 'nw-cell'} x={252} y={84 + i * 52} width={348} height={42} rx={8} style={i === m ? { strokeWidth: 3.5 } : { opacity: 0.6 }} />
              <text x={266} y={110 + i * 52} className="ib-m" style={{ fill: 'var(--fg)' }}>{r.host}{r.path}  →  {r.svc}</text>
            </g>
          ))}
          <text x={252} y={262} className="ib-s">default backend → 404</text>
          <rect className={m < 0 ? 'nw-cell bad' : 'nw-cell'} x={252} y={272} width={348} height={30} rx={8} style={m < 0 ? { strokeWidth: 3.5 } : { opacity: 0.4 }} />
          {SVC.map((n, i) => (
            <g key={n}>
              <Arrow x1={618} y1={96 + i * 52} x2={668} y2={60 + i * 90} op={i === m ? 1 : 0.15} />
              <Tile x={670} y={30 + i * 90} w={190} h={60} title={`Service ${n}`} state={i === m ? 'ok' : 'skip'} />
            </g>
          ))}
          <Arrow x1={618} y1={287} x2={668} y2={330} bad op={m < 0 ? 1 : 0.15} />
          <rect className={m < 0 ? 'nw-cell bad' : 'nw-cell'} x={670} y={300} width={190} height={60} rx={10} style={m < 0 ? undefined : { opacity: 0.4 }} />
          <text x={765} y={336} textAnchor="middle" className="ib-n">404 Controller</text>
          <Banner y={324} text={`${T.reply}: ${row.code} ${row.body.startsWith('<') ? (row.body.startsWith('<HTML>') ? '(404 from the Pod)' : '(404 from the controller)') : row.body}`} w={560} />
          <text x={20} y={376} className="ib-s" style={{ fill: ok ? 'var(--k2)' : 'var(--ib-bad)' }}>{ok ? '✓ 200' : `✗ ${row.code}`}</text>
        </svg>
      </div>
      <p className="viz-now"><strong>{row.host}{row.path}</strong><span>{T.note(row, m)}</span></p>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
