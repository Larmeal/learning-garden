import { useState } from 'react';
import { Key } from '../data-security/ds';
import type { Lang } from '../spark/stepper';
import { Figure, Paper, Shield } from './bits';
import data from './access.json';

// Shows:      three ways a server's own power gets used against it, each drawn as a small scene with the check that stops it. IDOR: a shelf of order folders (100 to 104, some empty, some Ann's, one
//             Bob's) and Ann at the counter asking for a number. Path traversal: the one folder the server is allowed to serve, a fence around it, and a file name whose ../ walks out through the
//             fence to a secret file. SSRF: a server that fetches whatever URL it is given, and the seven spellings of one inside address that decide whether the fetch lands in the outside world
//             or inside the company network.
// Because:    all three have the same shape (the server does something for whoever asks) and the same fix (decide on the server, from what the request really points at, not from how it is
//             spelled). A shelf, a fence and a map make "who owns it", "where does it really end up" and "which address is this" something to look at, and the same request with the check off
//             and on shows what the check changes.
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
  title: string; kind: string; kinds: Record<Kind, string>; check: string; off: string; on: string; checks: Record<Kind, [string, string]>; legend: { color: string; text: string; ring?: boolean }[];
  resp: string; noOrder: string; forbidden: string; owner: (o: string, t: number) => string; refused: string; ssrfOk: string; ssrfBlock: string; ssrfHost: string; verdictBad: string; verdictOk: string; caption: string;
  notFound: string; secret: string; shelf: string; clerk: string; annAsks: (id: number) => string; mine: string; theirs: string; empty: string; fence: string; served: string; outside: string; walks: string; stops: string;
  inside: string; outer: string; server: string; fetches: string; resolves: string; passes: string; blocked: string; internalNote: string; user: string; list: string;
}> = {
  th: {
    title: 'เลือกประเภทของคำขอ สิ่งที่ส่งไป และเปิดหรือปิดการตรวจ ดูว่าคำขอไปจบที่ไหน และ Server ตอบอะไรกลับมา',
    kind: 'ประเภท', kinds: { idor: 'IDOR (เลข Order)', path: 'Path Traversal (ชื่อไฟล์)', ssrf: 'SSRF (URL ที่ให้ Server ไปดึง)' }, check: 'การตรวจ', off: 'ปิด', on: 'เปิด',
    checks: { idor: ['ไม่เช็กเจ้าของ', 'เช็กเจ้าของ'], path: ['ต่อ Path ตรง ๆ', 'เทียบ Path ที่แปลงแล้วกับโฟลเดอร์'], ssrf: ['Blocklist ของข้อความ', 'แปลงเป็นเลขที่อยู่ก่อนเช็ก'] },
    legend: [{ color: 'var(--ib-bad)', text: 'ข้อมูลที่ไม่ควรได้' }, { color: 'var(--accent)', text: 'ของของเราเอง หรือถูกกันไว้' }],
    resp: 'Server ตอบ', noOrder: 'ไม่มี Order นี้ (404)', forbidden: '403 ไม่ใช่ของคุณ', owner: (o, t) => `ได้ Order ของ ${o} ยอด ${t}`, refused: 'ปฏิเสธ ออกนอกโฟลเดอร์', ssrfOk: 'ผ่านการตรวจ Server จึงไปดึง', ssrfBlock: 'ถูกบล็อก Server ไม่ไปดึง', ssrfHost: 'ที่อยู่ที่ได้จริง',
    verdictBad: 'ได้สิ่งที่ไม่ควรได้', verdictOk: 'ตอบถูกต้อง', notFound: 'ไม่พบ', secret: 'เนื้อไฟล์ลับ',
    shelf: 'ตู้เก็บ Order', clerk: 'Server ที่หน้าตู้', annAsks: (id) => `Ann (ล็อกอินอยู่) ขอ Order เลข ${id}`, mine: 'ของ Ann', theirs: 'ของคนอื่น', empty: 'ว่าง',
    fence: 'โฟลเดอร์ที่ให้ดาวน์โหลดได้ (/files)', served: 'ไฟล์ที่ให้ดาวน์โหลด', outside: 'อยู่นอกโฟลเดอร์ (secret.txt)', walks: 'ชื่อไฟล์เดินออกนอกรั้ว', stops: 'ถูกกันไว้ที่รั้ว',
    inside: 'เครือข่ายภายใน (ที่คนข้างนอกเข้าไม่ถึง)', outer: 'อินเทอร์เน็ตข้างนอก', server: 'Server ที่ไปดึง URL ให้', fetches: 'ไปดึง', resolves: 'ที่อยู่ที่แท้จริงคือ', passes: 'ผ่านด่าน', blocked: 'ถูกบล็อก', internalNote: 'หน้า Admin และข้อมูลของเครื่อง', user: 'ผู้ใช้ส่ง URL', list: 'URL ที่ลอง',
    caption: 'Order ไฟล์ และที่อยู่ที่ถูกแปลง มาจากการรันจริงในแบบฝึก 10 ข้อมูลทั้งหมดเป็นข้อมูลปลอมในโฟลเดอร์ชั่วคราว ไม่มีการเชื่อมต่อเครือข่าย',
  },
  en: {
    title: 'Pick the kind of request, what is sent, and whether the check is on, and see where the request ends up and what the server answers',
    kind: 'Kind', kinds: { idor: 'IDOR (order number)', path: 'Path traversal (file name)', ssrf: 'SSRF (a URL the server fetches)' }, check: 'Check', off: 'off', on: 'on',
    checks: { idor: ['no owner check', 'owner check'], path: ['join the path as is', 'compare the resolved path with the folder'], ssrf: ['blocklist of text', 'resolve to an address first'] },
    legend: [{ color: 'var(--ib-bad)', text: 'data that should not be returned' }, { color: 'var(--accent)', text: 'our own, or kept out' }],
    resp: 'the server answers', noOrder: 'No such order (404)', forbidden: '403 not yours', owner: (o, t) => `Gets ${o}'s order, total ${t}`, refused: 'refused: outside the folder', ssrfOk: 'passes the check, so the server fetches it', ssrfBlock: 'blocked, the server does not fetch it', ssrfHost: 'the address it really is',
    verdictBad: 'gets what it should not', verdictOk: 'answered correctly', notFound: 'not found', secret: 'contents of the secret file',
    shelf: 'the order shelf', clerk: 'the server at the shelf', annAsks: (id) => `Ann (logged in) asks for order ${id}`, mine: "Ann's", theirs: "someone else's", empty: 'empty',
    fence: 'the folder that may be downloaded (/files)', served: 'files that may be downloaded', outside: 'outside the folder (secret.txt)', walks: 'the file name walks out through the fence', stops: 'stopped at the fence',
    inside: 'the internal network (out of reach from outside)', outer: 'the internet outside', server: 'the server that fetches URLs for users', fetches: 'fetches', resolves: 'the address it really is', passes: 'passes the gate', blocked: 'blocked', internalNote: 'the admin page and the machine data', user: 'the user sends a URL', list: 'URLs to try',
    caption: 'The orders, the files and the resolved addresses come from a real run of exercise 10. All the data is fake, in a temporary folder, and no network connection was made.',
  },
};

const isInternal = (ip: string) => ip.startsWith('127.') || ip === '::1' || ip.startsWith('169.254.');

export default function AccessLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [kind, setKind] = useState<Kind>('idor');
  const [on, setOn] = useState(false);
  const [i, setI] = useState(2);
  const idx = Math.min(i, kind === 'idor' ? IDOR.length - 1 : kind === 'path' ? PATHS.length - 1 : SSRF.length - 1);
  const bad = 'var(--ib-bad)', acc = 'var(--accent)';

  let scene: React.ReactNode = null;
  let verdict = '', isBad = false, respText = '';
  if (kind === 'idor') {
    const r = IDOR[idx];
    const res = on ? r.checked : r.open;
    if (res === null) respText = T.noOrder;
    else if (res === 'forbidden') respText = T.forbidden;
    else { const o = res as { owner: string; total: number }; respText = T.owner(o.owner, o.total); isBad = o.owner !== 'ann'; }
    verdict = isBad ? T.verdictBad : T.verdictOk;
    scene = (
      <g>
        <Figure cx={50} cy={80} r={14} />
        <text x={80} y={86} className="ib-n" style={{ fontWeight: 700, fontSize: 16 }}>Ann</text>
        <Paper x={14} y={140} w={250} h={64} text={T.annAsks(r.id)} max={26} size={14.5} />
        <line x1={270} y1={172} x2={340} y2={172} stroke="var(--line-strong)" strokeWidth={4} />
        <Figure cx={372} cy={140} r={13} fill="var(--muted)" />
        <text x={344} y={198} className="ib-s" style={{ fontSize: 13.5 }}>{T.clerk}</text>
        <text x={344} y={216} className="ib-s" style={{ fontSize: 13 }}>{on ? `✓ ${T.checks.idor[1]}` : `✗ ${T.checks.idor[0]}`}</text>
        <text x={470} y={42} className="ib-s" style={{ fontSize: 14 }}>{T.shelf}</text>
        {IDOR.map((o, k) => {
          const x = 470 + k * 80;
          const sel = k === idx;
          const mine = o.exists && (o.open as { owner: string } | null)?.owner === 'ann';
          return (
            <g key={o.id} opacity={o.exists ? 1 : 0.45}>
              <path d={`M${x},${64} h28 l8,10 h34 v92 h-70 z`} fill={mine ? 'var(--accent-soft)' : 'var(--surface)'} stroke={sel ? (isBad ? bad : acc) : 'var(--line-strong)'} strokeWidth={sel ? 4 : 2} strokeDasharray={o.exists ? undefined : '6 5'} />
              <text x={x + 35} y={106} textAnchor="middle" className="ib-n" style={{ fontWeight: 700, fontSize: 18 }}>{o.id}</text>
              <text x={x + 35} y={134} textAnchor="middle" className="ib-s" style={{ fontSize: 13.5 }}>{o.exists ? ((o.open as { owner: string }).owner === 'ann' ? T.mine : T.theirs) : T.empty}</text>
              {o.exists ? <text x={x + 35} y={154} textAnchor="middle" className="ib-m" style={{ fontSize: 13 }}>{(o.open as { owner: string }).owner}</text> : null}
              {sel ? <path d={`M${x + 35},${186} l-9,12 l18,0 z`} fill={isBad ? bad : acc} /> : null}
            </g>
          );
        })}
      </g>
    );
  } else if (kind === 'path') {
    const r = PATHS[idx];
    const v = on ? r.safe : r.naive;
    const out = r.name.startsWith('..');
    const gotSecret = v === 'TOP SECRET';
    if (v === 'refused') respText = T.refused;
    else if (v === null) respText = T.notFound;
    else respText = gotSecret ? `${T.secret}: ${v}` : v;
    isBad = gotSecret;
    verdict = isBad ? T.verdictBad : T.verdictOk;
    scene = (
      <g>
        <rect x={14} y={20} width={430} height={210} rx={14} fill="color-mix(in srgb, var(--accent) 7%, var(--surface))" stroke={acc} strokeWidth={3} strokeDasharray="10 7" />
        <text x={30} y={46} className="ib-n" style={{ fontWeight: 700, fontSize: 15 }}>{`📁 ${T.fence}`}</text>
        <text x={30} y={70} className="ib-s" style={{ fontSize: 13.5 }}>{T.served}</text>
        <Paper x={30} y={86} w={170} h={50} text="hello.txt" max={20} mono size={15} tone={!out && v ? 'ok' : 'plain'} />
        <Paper x={214} y={86} w={170} h={50} text="notes.txt" max={20} mono size={15} op={0.6} />
        <Paper x={30} y={160} w={400} h={52} text={`GET /files/${r.name}`} max={44} mono size={15} tone={out ? 'bad' : 'plain'} />
        <Paper x={560} y={86} w={290} h={80} title={T.outside} text="secret.txt  🔒" max={26} mono size={16} tone={gotSecret ? 'bad' : 'plain'} />
        {out ? (
          <g>
            <path d={`M${430},${186} C 500,186 500,126 560,126`} fill="none" stroke={on ? acc : bad} strokeWidth={4} strokeDasharray={on ? '8 6' : undefined} />
            {on ? <Shield cx={474} cy={156} s={1.1} /> : <path d="M560,126 l-14,-8 l0,16 z" fill={bad} />}
            <text x={472} y={214} className="ib-n" style={{ fontSize: 14, fontWeight: 700, fill: on ? acc : bad }}>{on ? T.stops : T.walks}</text>
          </g>
        ) : (
          <g>
            <path d="M120,160 l0,-24" stroke={acc} strokeWidth={4} />
            <path d="M120,136 l-8,12 l16,0 z" fill={acc} />
          </g>
        )}
      </g>
    );
  } else {
    const r = SSRF[idx];
    const pass = on ? r.parsed : r.naive;
    const internal = isInternal(r.ip);
    isBad = pass && internal && !r.parsed;
    respText = pass ? T.ssrfOk : T.ssrfBlock;
    verdict = isBad ? T.verdictBad : T.verdictOk;
    const dest = internal ? 'in' : 'out';
    const ty = dest === 'in' ? 150 : 64;
    scene = (
      <g>
        <Figure cx={40} cy={110} r={13} />
        <text x={66} y={116} className="ib-s" style={{ fontSize: 13.5 }}>{T.user}</text>
        <Paper x={10} y={150} w={226} h={74} text={r.url} max={24} mono size={14} />
        <line x1={238} y1={116} x2={300} y2={116} stroke="var(--line-strong)" strokeWidth={4} />
        <rect x={300} y={60} width={236} height={150} rx={12} fill="var(--surface)" stroke="var(--line-strong)" strokeWidth={2.5} />
        <text x={314} y={86} className="ib-n" style={{ fontWeight: 700, fontSize: 14.5 }}>{T.server}</text>
        <text x={314} y={116} className="ib-s" style={{ fontSize: 13 }}>{T.resolves}</text>
        <text x={314} y={140} className="ib-m" style={{ fontSize: 16, fontWeight: 700, fill: internal ? bad : 'var(--fg)' }}>{r.ip}</text>
        <rect x={314} y={158} width={208} height={36} rx={8} fill={pass ? 'color-mix(in srgb, var(--ib-bad) 8%, var(--surface))' : 'var(--accent-soft)'} stroke={pass ? (internal ? bad : 'var(--line-strong)') : acc} strokeWidth={2} />
        <text x={326} y={182} className="ib-n" style={{ fontSize: 13.5, fontWeight: 700 }}>{pass ? `✓ ${T.passes}` : `✗ ${T.blocked}`}</text>
        {/* the two worlds */}
        <rect x={600} y={14} width={266} height={92} rx={12} fill="var(--surface)" stroke="var(--line-strong)" strokeWidth={2} />
        <text x={614} y={40} className="ib-n" style={{ fontWeight: 700, fontSize: 14.5 }}>{`🌐 ${T.outer}`}</text>
        <text x={614} y={66} className="ib-m" style={{ fontSize: 13 }}>example.com</text>
        <text x={614} y={88} className="ib-m" style={{ fontSize: 13 }}>93.184.216.34</text>
        <rect x={600} y={120} width={266} height={110} rx={12} fill="color-mix(in srgb, var(--ib-bad) 8%, var(--surface))" stroke={isBad ? bad : 'var(--line-strong)'} strokeWidth={isBad ? 4 : 2} strokeDasharray="8 6" />
        <text x={614} y={146} className="ib-n" style={{ fontWeight: 700, fontSize: 14.5 }}>{`🏢 ${T.inside}`}</text>
        <text x={614} y={172} className="ib-m" style={{ fontSize: 13 }}>127.0.0.1  ·  ::1</text>
        <text x={614} y={192} className="ib-m" style={{ fontSize: 13 }}>169.254.169.254</text>
        <text x={614} y={216} className="ib-s" style={{ fontSize: 13 }}>{T.internalNote}</text>
        {/* the arrow lands where the address really is */}
        <path d={`M536,116 C 570,116 570,${ty + 14} 600,${ty + 14}`} fill="none" stroke={pass ? (isBad ? bad : acc) : 'var(--line)'} strokeWidth={4} strokeDasharray={pass ? undefined : '8 6'} />
        {pass ? <path d={`M600,${ty + 14} l-14,-8 l0,16 z`} fill={isBad ? bad : acc} /> : <text x={568} y={ty + 8} style={{ fontSize: 20, fontWeight: 700, fill: acc }}>✗</text>}
      </g>
    );
  }
  const labels = kind === 'idor' ? IDOR.map((r) => String(r.id)) : kind === 'path' ? PATHS.map((p) => p.name) : SSRF.map((s) => s.url.replace('http://', '').replace('/admin', '').replace('/latest/meta-data/', ''));
  return (
    <figure className="viz ib-fig lg">
      <div className="viz-title">{T.title}</div>
      <Key items={T.legend} />
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
      <div className="viz-box">
        <svg viewBox="0 0 880 330" role="img" aria-label={T.title}>
          {scene}
          <rect x={10} y={248} width={860} height={72} rx={12} fill={isBad ? 'color-mix(in srgb, var(--ib-bad) 10%, var(--surface))' : 'var(--surface)'} stroke={isBad ? bad : 'var(--line-strong)'} strokeWidth={isBad ? 3.5 : 2} />
          <text x={26} y={274} className="ib-s" style={{ fontSize: 13.5 }}>{T.resp}</text>
          <text x={26} y={302} style={{ fontSize: 18, fontWeight: 700, fill: isBad ? bad : 'var(--fg)' }}>{`${isBad ? '✗' : '✓'} ${respText}`}</text>
          <text x={854} y={302} textAnchor="end" style={{ fontSize: 15, fontWeight: 700, fill: isBad ? bad : acc }}>{verdict}</text>
        </svg>
      </div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
