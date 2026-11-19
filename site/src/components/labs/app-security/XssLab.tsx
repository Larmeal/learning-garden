import { useState } from 'react';
import { Key } from '../data-security/ds';
import { Shield } from './bits';
import type { Lang } from '../spark/stepper';
import data from './xss.json';

// Shows:      the HTML a page ends up with for a user's text in three places (HTML text, a quoted attribute, a JavaScript string), with and without the right
//             output encoding, what the HTML parser builds out of it (an element or an event attribute nobody wrote), and what a Content Security Policy
//             then decides about the inline script.
// Because:    XSS is about where in the page the text lands, and the right encoding differs by place. The same payload that is harmless in one place breaks out
//             in another. A list of parsed elements makes the difference visible in a way that a rule of thumb does not.
// Control:    the place (3), what the user typed (honest or the attack for that place), the encoding (none, the right one) and the CSP (off, nonce, unsafe-inline).
// Conclusion: the right encoding for the place keeps the text as text. If something slips through, a nonce based CSP stops the inline script, and unsafe-inline gives that wall up.
//
// The pages and what the parser found are those of exercises/09_xss.py --write (xss.json), from Python's html.parser. The CSP results (blocked with a nonce,
// allowed with unsafe-inline) are the ones that exercise asserts with a model of the rule. No real browser was used.

type Ctx = 'html' | 'attr' | 'js';
type Csp = 'off' | 'nonce' | 'unsafe';
type Case = { ctx: string; payload: string; evil: boolean; enc: string; html: string; tags: string[]; handlers: string[]; injected: boolean; textHasPayload: boolean };
const CASES = data.cases as Case[];
const CSP_RUNS = data.cspInlineRuns as Record<Csp, boolean>;

const TEXT: Record<Lang, {
  title: string; ctx: string; ctxs: Record<Ctx, string>; typed: string; honest: string; attack: string; enc: string; encs: [string, string]; csp: string; csps: Record<Csp, string>;
  legend: { color: string; text: string; ring?: boolean }[]; page: string; scene: { browser: string; evil: string; cookie: string; text: string; script: string; stolen: string; held: string };
  page2?: string; parsed: string; none: string; injectedTag: string; runs: string; blocked: string; harmless: string; why: Record<string, string>; caption: string;
  safeEnc: Record<Ctx, string>;
}> = {
  th: {
    title: 'เลือกว่าข้อความของผู้ใช้ไปอยู่ตรงไหนของหน้า พิมพ์อะไร เข้ารหัสผลลัพธ์ไหม และมี CSP หรือไม่ แล้วดูว่า Browser สร้างอะไรขึ้นมาและ Script รันไหม',
    ctx: 'อยู่ตรงไหน', ctxs: { html: 'เนื้อหา HTML', attr: 'Attribute', js: 'ใน <script>' }, typed: 'ผู้ใช้พิมพ์', honest: 'ข้อความปกติ', attack: 'ข้อความโจมตี',
    enc: 'Encode ตอนแสดง', encs: ['ไม่ Encode', 'Encode ให้ตรงที่'], csp: 'CSP', csps: { off: 'ไม่มี', nonce: 'nonce', unsafe: "'unsafe-inline'" },
    legend: [{ color: 'var(--ib-bad)', text: 'สิ่งที่ผู้โจมตีทำให้เกิดขึ้น' }, { color: 'var(--accent)', text: 'ข้อความของผู้ใช้ในหน้า' }],
    scene: { browser: 'หน้าที่ผู้อ่านเห็นใน Browser', evil: 'evil.test (ของผู้โจมตี)', cookie: 'Cookie ของผู้อ่าน', text: 'แสดงเป็นตัวหนังสือ', script: 'Script ของผู้โจมตีรันอยู่ในหน้านี้', stolen: 'Cookie ถูกส่งออกไป', held: 'Script อยู่ในหน้า แต่ CSP ไม่ให้รัน' },
    page: 'HTML ที่ Server ส่งออกไป', parsed: 'สิ่งที่ Browser สร้างขึ้นจาก HTML นั้น', none: '(ไม่มี Element หรือ Attribute ที่ไม่ได้ตั้งใจ)', injectedTag: 'ของที่ไม่มีใครเขียน', runs: 'Script ของผู้โจมตีรัน', blocked: 'CSP บล็อกไว้ เพราะ Script ไม่มี nonce', harmless: 'ข้อความถูกแสดงเป็นข้อความ ไม่มีอะไรรัน',
    why: { html: 'Encode เป็น &lt; แล้ว < ไม่เริ่ม Tag', attr: 'Encode เครื่องหมาย " ทำให้ค่าไม่ถูกปิดก่อนเวลา', js: 'json.dumps ใส่ค่าเป็นสตริงเดียว และเขียน < เป็น \\u003c ทำให้ </script> ปิดบล็อกไม่ได้' },
    safeEnc: { html: 'html.escape', attr: 'html.escape (และใส่ " ครอบค่าเสมอ)', js: 'json.dumps ที่เขียน < เป็น \\u003c' },
    caption: 'หน้า HTML และ Element ที่ Parser ของ Python สร้างขึ้นมาจากการรันจริงในแบบฝึก 09 ส่วนผลของ CSP คือโมเดลของกฎที่เขียนในแบบฝึก ไม่ได้รันใน Browser จริง',
  },
  en: {
    title: 'Pick where the user\'s text lands in the page, what is typed, whether the output is encoded and whether there is a CSP, and see what the browser builds and whether a script runs',
    ctx: 'where', ctxs: { html: 'HTML text', attr: 'an attribute', js: 'inside <script>' }, typed: 'user types', honest: 'honest text', attack: 'the attack',
    enc: 'Encode on output', encs: ['no encoding', 'the right encoding'], csp: 'CSP', csps: { off: 'none', nonce: 'nonce', unsafe: "'unsafe-inline'" },
    legend: [{ color: 'var(--ib-bad)', text: 'what the attacker made happen' }, { color: 'var(--accent)', text: "the user's text in the page" }],
    scene: { browser: 'the page the reader sees in the browser', evil: "evil.test (the attacker's)", cookie: "the reader's cookie", text: 'shown as text', script: "the attacker's script is running in this page", stolen: 'the cookie is sent out', held: 'the script is in the page, but CSP does not let it run' },
    page: 'the HTML the server sends', parsed: 'what the browser builds from that HTML', none: '(no element or attribute that nobody meant)', injectedTag: 'nobody wrote this', runs: "The attacker's script runs", blocked: 'The CSP blocks it, because the script has no nonce', harmless: 'The text is shown as text and nothing runs',
    why: { html: 'Encoded as &lt;, the < does not start a tag', attr: 'Encoding the " keeps the value from ending early', js: 'json.dumps writes the value as a single string and < as \\u003c, so </script> cannot close the block' },
    safeEnc: { html: 'html.escape', attr: 'html.escape (and always put " around the value)', js: 'json.dumps with < written as \\u003c' },
    caption: 'The pages and the elements the Python parser built come from a real run of exercise 09. The CSP results are the model of the rule written in the exercise, not run in a real browser.',
  },
};

export default function XssLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const [ctx, setCtx] = useState<Ctx>('html');
  const [evil, setEvil] = useState(true);
  const [safe, setSafe] = useState(false);
  const [csp, setCsp] = useState<Csp>('off');
  const c = CASES.find((x) => x.ctx === ctx && x.evil === evil && x.enc === (safe ? 'safe' : 'none'))!;
  const runs = c.injected && CSP_RUNS[csp];
  const blocked = c.injected && !CSP_RUNS[csp];
  const hi = { background: 'var(--accent)', color: 'var(--on-key, #fff)', borderRadius: 4, padding: '0 3px' } as const;
  // find the user's text inside the page, in the form it has there (as typed, HTML escaped, or as a JSON string)
  const esc = (x: string) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
  const forms = [JSON.stringify(c.payload).replace(/</g, '\\u003c'), JSON.stringify(c.payload), esc(c.payload), c.payload];
  const needle = forms.find((f) => c.html.includes(f)) ?? '';
  const at = needle ? c.html.indexOf(needle) : -1;
  const rendered = at < 0
    ? <span>{c.html}</span>
    : <><span>{c.html.slice(0, at)}</span><span style={hi}>{needle}</span><span>{c.html.slice(at + needle.length)}</span></>;
  return (
    <figure className="viz ib-fig">
      <div className="viz-title">{T.title}</div>
      <Key items={T.legend} />
      <div className="ib-controls" style={{ flexWrap: 'wrap' }}>
        <span className="ib-lbl">{T.ctx}</span>
        <span className="seg" role="group" aria-label={T.ctx}>
          {(['html', 'attr', 'js'] as Ctx[]).map((k) => <button key={k} type="button" aria-pressed={ctx === k} onClick={() => setCtx(k)}>{T.ctxs[k]}</button>)}
        </span>
        <span className="ib-lbl">{T.typed}</span>
        <span className="seg" role="group" aria-label={T.typed}>
          <button type="button" aria-pressed={!evil} onClick={() => setEvil(false)}>{T.honest}</button>
          <button type="button" aria-pressed={evil} onClick={() => setEvil(true)}>{T.attack}</button>
        </span>
      </div>
      <div className="ib-controls" style={{ flexWrap: 'wrap' }}>
        <span className="ib-lbl">{T.enc}</span>
        <span className="seg" role="group" aria-label={T.enc}>
          <button type="button" aria-pressed={!safe} onClick={() => setSafe(false)}>{T.encs[0]}</button>
          <button type="button" aria-pressed={safe} onClick={() => setSafe(true)}>{T.encs[1]}</button>
        </span>
        <span className="ib-lbl">{T.csp}</span>
        <span className="seg" role="group" aria-label={T.csp}>
          {(['off', 'nonce', 'unsafe'] as Csp[]).map((k) => <button key={k} type="button" aria-pressed={csp === k} onClick={() => setCsp(k)}>{T.csps[k]}</button>)}
        </span>
      </div>
      <div style={{ display: 'grid', gap: 12, marginBottom: 6 }}>
        <div style={{ border: '2px solid var(--line-strong)', borderRadius: 12, padding: 12, background: 'var(--surface)' }}>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 6 }}>{T.page}{safe ? `  ·  ${T.safeEnc[ctx]}` : ''}</div>
          <div style={{ fontFamily: 'var(--mono, monospace)', fontSize: 14, lineHeight: 1.6, wordBreak: 'break-all' }}>{rendered}</div>
        </div>
        <div style={{ border: '2px solid var(--line-strong)', borderRadius: 12, padding: 12, background: 'var(--surface)' }}>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 6 }}>{T.parsed}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {c.tags.map((t, i) => {
              const injected = c.injected && (ctx === 'html' ? t === 'script' : ctx === 'js' ? t === 'img' : false);
              return <span key={`${t}${i}`} className={injected ? 'ib-new' : 'ib-use'} style={{ padding: '2px 10px', borderRadius: 8, border: '2px solid var(--line-strong)', fontFamily: 'var(--mono, monospace)', fontSize: 14, ...(injected ? { borderColor: 'var(--ib-bad)', background: 'var(--surface)', color: 'var(--ib-bad)', fontWeight: 700 } : {}) }}>{`<${t}>`}{injected ? ` ${T.injectedTag}` : ''}</span>;
            })}
            {c.handlers.map((h) => <span key={h} style={{ padding: '2px 10px', borderRadius: 8, border: '2px solid var(--ib-bad)', color: 'var(--ib-bad)', fontFamily: 'var(--mono, monospace)', fontSize: 14, fontWeight: 700 }}>{h} {T.injectedTag}</span>)}
            {c.injected === false && c.handlers.length === 0 && <span style={{ color: 'var(--muted)', fontSize: 14 }}>{T.none}</span>}
          </div>
        </div>
        <div className="viz-box" style={{ margin: 0 }}>
          <svg viewBox="0 0 880 250" role="img" aria-label={T.scene.browser}>
            {/* the reader's browser */}
            <rect x={10} y={8} width={440} height={234} rx={12} fill="var(--surface)" stroke={runs ? 'var(--ib-bad)' : 'var(--line-strong)'} strokeWidth={runs ? 4 : 2.5} />
            <rect x={10} y={8} width={440} height={36} rx={12} fill="var(--accent-soft)" />
            <circle cx={30} cy={26} r={6} fill="var(--line-strong)" /><circle cx={50} cy={26} r={6} fill="var(--line-strong)" /><circle cx={70} cy={26} r={6} fill="var(--line-strong)" />
            <text x={92} y={31} className="ib-m" style={{ fontSize: 14 }}>shop.test/reviews</text>
            <rect x={316} y={16} width={126} height={22} rx={11} fill={csp === 'off' ? 'var(--surface)' : csp === 'nonce' ? 'var(--accent)' : 'color-mix(in srgb, var(--ib-bad) 25%, var(--surface))'} stroke={csp === 'unsafe' ? 'var(--ib-bad)' : 'var(--line-strong)'} strokeWidth={1.5} />
            <text x={379} y={32} textAnchor="middle" className="ib-m" style={{ fontSize: 12.5, fontWeight: 700, fill: csp === 'nonce' ? 'var(--on-key, #fff)' : 'var(--fg)' }}>{`CSP: ${T.csps[csp]}`}</text>
            <text x={26} y={72} className="ib-s" style={{ fontSize: 13.5 }}>{T.scene.browser}</text>
            <rect x={26} y={86} width={408} height={70} rx={10} fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth={2} />
            {runs ? (
              <g>
                <text x={42} y={116} style={{ fontSize: 26 }}>⚙️</text>
                <text x={84} y={112} className="ib-n" style={{ fontSize: 15.5, fontWeight: 700, fill: 'var(--ib-bad)' }}>{T.scene.script}</text>
                <text x={84} y={136} className="ib-m" style={{ fontSize: 13.5 }}>{c.payload.length > 36 ? c.payload.slice(0, 35) + '…' : c.payload}</text>
              </g>
            ) : blocked ? (
              <g>
                <text x={42} y={116} style={{ fontSize: 26 }}>⏸️</text>
                <text x={84} y={112} className="ib-n" style={{ fontSize: 15.5, fontWeight: 700 }}>{T.scene.held}</text>
                <text x={84} y={136} className="ib-m" style={{ fontSize: 13.5 }}>{c.payload.length > 36 ? c.payload.slice(0, 35) + '…' : c.payload}</text>
              </g>
            ) : (
              <g>
                <text x={42} y={112} className="ib-s" style={{ fontSize: 13 }}>{T.scene.text}</text>
                <text x={42} y={138} className="ib-m" style={{ fontSize: 16, fontWeight: 700 }}>{c.payload.length > 38 ? c.payload.slice(0, 37) + '…' : c.payload}</text>
              </g>
            )}
            <rect x={26} y={172} width={150} height={56} rx={10} fill="var(--surface)" stroke="var(--line-strong)" strokeWidth={2} />
            <text x={38} y={196} style={{ fontSize: 22 }}>🍪</text>
            <text x={70} y={196} className="ib-s" style={{ fontSize: 13 }}>{T.scene.cookie}</text>
            <text x={70} y={216} className="ib-m" style={{ fontSize: 13 }}>sid=ZXaH…</text>
            {/* the way out */}
            {runs ? (
              <g>
                <line x1={176} y1={200} x2={600} y2={200} stroke="var(--ib-bad)" strokeWidth={4} strokeDasharray="10 6" />
                <path d="M600,200 l-14,-8 l0,16 z" fill="var(--ib-bad)" transform="translate(14 0)" />
                <text x={388} y={188} textAnchor="middle" className="ib-n" style={{ fontSize: 15, fontWeight: 700, fill: 'var(--ib-bad)' }}>{`🍪 → ${T.scene.stolen}`}</text>
              </g>
            ) : null}
            {blocked ? (
              <g>
                <line x1={176} y1={200} x2={330} y2={200} stroke="var(--line-strong)" strokeWidth={4} strokeDasharray="10 6" />
                <Shield cx={350} cy={200} s={1.3} />
                <text x={388} y={176} className="ib-n" style={{ fontSize: 14.5, fontWeight: 700 }}>CSP</text>
              </g>
            ) : null}
            {/* the attacker's server */}
            <rect x={620} y={160} width={250} height={82} rx={12} fill="var(--surface)" stroke={runs ? 'var(--ib-bad)' : 'var(--line-strong)'} strokeWidth={runs ? 4 : 2} opacity={runs ? 1 : 0.6} />
            <text x={634} y={188} className="ib-n" style={{ fontSize: 15, fontWeight: 700 }}>{T.scene.evil}</text>
            {runs ? <text x={634} y={218} className="ib-m" style={{ fontSize: 14, fill: 'var(--ib-bad)', fontWeight: 700 }}>🍪 sid=ZXaH…</text> : <text x={634} y={218} className="ib-s" style={{ fontSize: 14 }}>—</text>}
          </svg>
        </div>
        <div style={{ border: `3px solid ${runs ? 'var(--ib-bad)' : 'var(--line-strong)'}`, borderRadius: 12, padding: 12, background: 'var(--surface)', fontWeight: 700 }}>
          {runs ? <span style={{ color: 'var(--ib-bad)' }}>✗ {T.runs}</span> : blocked ? <span>✓ {T.blocked}</span> : <span>✓ {T.harmless}</span>}
          {safe && !c.injected && <div style={{ fontWeight: 400, fontSize: 14, marginTop: 6 }}>{T.why[ctx]}</div>}
        </div>
      </div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
