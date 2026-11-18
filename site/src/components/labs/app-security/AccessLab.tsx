import { useState } from 'react';
import { Legend } from '../iceberg/ib';
import type { Lang } from '../spark/stepper';
import data from './access.json';

// Shows:      three ways a server's own power gets used against it, each with the check that stops it: changing an order number (IDOR), a file name with ../ in it
//             (path traversal) and a URL the server is asked to fetch (SSRF). Pick the kind, an input, and whether the check is on, and see the response.
// Because:    all three have the same shape (the server does something for whoever asks) and the same fix (decide on the server, from what the request really means, not
//             from how it is spelled). Seeing the same request with the check off and on, and the other spellings of one address, makes that shape visible.
// Control:    the kind (3), the input (an id, a file name, one of seven spellings of an address) and the check (off, on).
// Conclusion: a request is judged by who asks and what it really points at. A blocklist of spellings fails (5 of 7 spellings of the same machine get through) and a parsed address does not.
//
// Everything comes from exercises/10_access_control.py --write (access.json): the orders, the real file reads in a throwaway folder, and the parsed addresses.

type Kind = 'idor' | 'path' | 'ssrf';
type Idor = { id: number; exists: boolean; open: { owner: string; total: number } | string | null; checked: { owner: string; total: number } | string | null };
type Ssrf = { url: string; naive: boolean; parsed: boolean; ip: string };
type PathCase = { name: string; naive: string | null; safe: string | null };
const IDOR = data.idor as Idor[];
const SSRF = data.ssrf as Ssrf[];
const PATHS = data.paths as PathCase[];

const TEXT: Record<Lang, {
  title: string; kind: string; kinds: Record<Kind, string>; check: string; off: string; on: string; checks: Record<Kind, [string, string]>; legend: { kind: 'new' | 'use' | 'skip' | 'node'; text: string }[];
  req: string; resp: string; idorLine: (id: number) => string; noOrder: string; forbidden: string; owner: (o: string, t: number) => string; walk: string; pathLine: (n: string) => string; refused: string;
  ssrfReach: (ip: string) => string; ssrfOk: string; ssrfBlock: string; ssrfHost: string; verdictBad: string; verdictOk: string; caption: string; notFound: string; secret: string;
}> = {
  th: {
    title: 'เลือกประเภทของคำขอ สิ่งที่ส่งไป และเปิดหรือปิดการตรวจ ดูว่า Server ตอบอะไรกลับมา',
    kind: 'ประเภท', kinds: { idor: 'IDOR (เลข Order)', path: 'Path Traversal (ชื่อไฟล์)', ssrf: 'SSRF (URL ที่ให้ Server ไปดึง)' }, check: 'การตรวจ', off: 'ปิด', on: 'เปิด',
    checks: { idor: ['ไม่เช็กเจ้าของ', 'เช็กเจ้าของ'], path: ['ต่อ Path ตรง ๆ', 'เทียบ Path ที่แปลงแล้วกับโฟลเดอร์'], ssrf: ['Blocklist ของข้อความ', 'แปลงเป็นเลขที่อยู่ก่อนเช็ก'] },
    legend: [{ kind: 'new', text: 'ข้อมูลที่ไม่ควรได้' }, { kind: 'use', text: 'ตอบถูกต้อง' }],
    req: 'คำขอ', resp: 'Server ตอบ', idorLine: (id) => `Ann (ล็อกอินอยู่) ขอ Order เลข ${id}`, noOrder: 'ไม่มี Order นี้ (404)', forbidden: '403 ไม่ใช่ของคุณ', owner: (o, t) => `ได้ Order ของ ${o} ยอด ${t}`,
    walk: 'เลขที่ไล่หาได้ 100 ถึง 104 ที่มีจริง', pathLine: (n) => `GET /files/${n}`, refused: 'ปฏิเสธ ออกนอกโฟลเดอร์', ssrfReach: (ip) => `แปลงเป็น ${ip}`, ssrfOk: 'ผ่านการตรวจ จึงไปดึง', ssrfBlock: 'ถูกบล็อก', ssrfHost: 'ที่อยู่ที่ได้จริง',
    verdictBad: 'ได้สิ่งที่ไม่ควรได้', verdictOk: 'ตอบถูกต้อง', notFound: 'ไม่พบ', secret: 'เนื้อไฟล์ลับ',
    caption: 'Order ไฟล์ และที่อยู่ที่ถูกแปลง มาจากการรันจริงในแบบฝึก 10 ข้อมูลทั้งหมดเป็นข้อมูลปลอมในโฟลเดอร์ชั่วคราว ไม่มีการเชื่อมต่อเครือข่าย',
  },
  en: {
    title: 'Pick the kind of request, what is sent, and whether the check is on, and see what the server answers',
    kind: 'Kind', kinds: { idor: 'IDOR (order number)', path: 'Path traversal (file name)', ssrf: 'SSRF (a URL the server fetches)' }, check: 'Check', off: 'off', on: 'on',
    checks: { idor: ['no owner check', 'owner check'], path: ['join the path as is', 'compare the resolved path with the folder'], ssrf: ['blocklist of text', 'resolve to an address first'] },
    legend: [{ kind: 'new', text: 'data that should not be returned' }, { kind: 'use', text: 'a correct answer' }],
    req: 'request', resp: 'the server answers', idorLine: (id) => `Ann (logged in) asks for order ${id}`, noOrder: 'No such order (404)', forbidden: '403 not yours', owner: (o, t) => `Gets ${o}'s order, total ${t}`,
    walk: 'ids found by counting from 100 to 104', pathLine: (n) => `GET /files/${n}`, refused: 'refused: outside the folder', ssrfReach: (ip) => `resolves to ${ip}`, ssrfOk: 'passes the check, so it is fetched', ssrfBlock: 'blocked', ssrfHost: 'address it really is',
    verdictBad: 'gets what it should not', verdictOk: 'answered correctly', notFound: 'not found', secret: 'contents of the secret file',
    caption: 'The orders, the files and the resolved addresses come from a real run of exercise 10. All the data is fake, in a temporary folder, and no network connection was made.',
  },
};

const mono = { fontFamily: 'var(--mono, monospace)', fontSize: 14, wordBreak: 'break-all' } as const;
const card = (bad: boolean) => ({ border: `3px solid ${bad ? 'var(--ib-bad)' : 'var(--line-strong)'}`, borderRadius: 12, padding: 12, background: 'var(--surface)' }) as const;

export default function AccessLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [kind, setKind] = useState<Kind>('idor');
  const [on, setOn] = useState(false);
  const [i, setI] = useState(2);
  const idx = Math.min(i, kind === 'idor' ? IDOR.length - 1 : kind === 'path' ? PATHS.length - 1 : SSRF.length - 1);

  let reqText = '', respText = '', bad = false, extra: React.ReactNode = null;
  if (kind === 'idor') {
    const r = IDOR[idx];
    const res = on ? r.checked : r.open;
    reqText = T.idorLine(r.id);
    if (res === null) respText = T.noOrder;
    else if (res === 'forbidden') respText = T.forbidden;
    else { const o = res as { owner: string; total: number }; respText = T.owner(o.owner, o.total); bad = o.owner !== 'ann'; }
    extra = <div style={{ fontSize: 14, color: 'var(--muted)' }}>{`${T.walk}: ${IDOR.filter((x) => x.exists).map((x) => x.id).join(', ')}`}</div>;
  } else if (kind === 'path') {
    const r = PATHS[idx];
    reqText = T.pathLine(r.name);
    const v = on ? r.safe : r.naive;
    if (v === 'refused') respText = T.refused;
    else if (v === null) respText = T.notFound;
    else { respText = v === 'TOP SECRET' ? `${T.secret}: ${v}` : v; bad = v === 'TOP SECRET'; }
  } else {
    const r = SSRF[idx];
    reqText = `POST /fetch  url=${r.url}`;
    const pass = on ? r.parsed : r.naive;
    bad = pass && r.ip !== '93.184.216.34' && !r.parsed;
    respText = pass ? T.ssrfOk : T.ssrfBlock;
    extra = <div style={{ fontSize: 14 }}>{`${T.ssrfHost}: `}<b style={mono}>{r.ip}</b>{bad ? '  (127.x / 169.254.x)' : ''}</div>;
  }
  const labels = kind === 'idor' ? IDOR.map((r) => String(r.id)) : kind === 'path' ? PATHS.map((p) => p.name) : SSRF.map((s) => s.url.replace('http://', '').replace('/admin', '').replace('/latest/meta-data/', ''));
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Legend items={T.legend} />
      <div className="ib-controls" style={{ flexWrap: 'wrap' }}>
        <span className="ib-lbl">{T.kind}</span>
        <span className="seg" role="group" aria-label={T.kind} style={{ flexWrap: 'wrap' }}>
          {(['idor', 'path', 'ssrf'] as Kind[]).map((k) => <button key={k} type="button" aria-pressed={kind === k} onClick={() => { setKind(k); setI(k === 'idor' ? 2 : k === 'path' ? 1 : 2); }}>{T.kinds[k]}</button>)}
        </span>
      </div>
      <div className="ib-controls" style={{ flexWrap: 'wrap' }}>
        <span className="seg" role="group" aria-label="input" style={{ flexWrap: 'wrap' }}>
          {labels.map((l, k) => <button key={l + k} type="button" aria-pressed={idx === k} onClick={() => setI(k)}>{l}</button>)}
        </span>
      </div>
      <div className="ib-controls" style={{ flexWrap: 'wrap' }}>
        <span className="ib-lbl">{T.check}</span>
        <span className="seg" role="group" aria-label={T.check}>
          <button type="button" aria-pressed={!on} onClick={() => setOn(false)}>{T.checks[kind][0]}</button>
          <button type="button" aria-pressed={on} onClick={() => setOn(true)}>{T.checks[kind][1]}</button>
        </span>
      </div>
      <div style={{ display: 'grid', gap: 12, marginBottom: 6 }}>
        <div style={card(false)}>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 6 }}>{T.req}</div>
          <div style={mono}>{reqText}</div>
        </div>
        <div style={card(bad)}>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 6 }}>{T.resp}</div>
          <div style={{ fontWeight: 700, marginBottom: 6, color: bad ? 'var(--ib-bad)' : undefined }}>{bad ? '✗ ' : '✓ '}{respText}</div>
          {extra}
          <div style={{ marginTop: 8, fontSize: 14, color: bad ? 'var(--ib-bad)' : 'var(--muted)' }}>{bad ? T.verdictBad : T.verdictOk}</div>
        </div>
      </div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
