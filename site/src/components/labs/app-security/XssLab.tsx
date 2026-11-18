import { useState } from 'react';
import { Legend } from '../iceberg/ib';
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
  legend: { kind: 'new' | 'use' | 'skip' | 'node'; text: string }[]; page: string; parsed: string; none: string; injectedTag: string; runs: string; blocked: string; harmless: string; why: Record<string, string>; caption: string;
  safeEnc: Record<Ctx, string>;
}> = {
  th: {
    title: 'เลือกว่าข้อความของผู้ใช้ไปอยู่ตรงไหนของหน้า พิมพ์อะไร เข้ารหัสผลลัพธ์ไหม และมี CSP หรือไม่ แล้วดูว่า Browser สร้างอะไรขึ้นมาและ Script รันไหม',
    ctx: 'อยู่ตรงไหน', ctxs: { html: 'เนื้อหา HTML', attr: 'Attribute', js: 'ใน <script>' }, typed: 'ผู้ใช้พิมพ์', honest: 'ข้อความปกติ', attack: 'ข้อความโจมตี',
    enc: 'Encode ตอนแสดง', encs: ['ไม่ Encode', 'Encode ให้ตรงที่'], csp: 'CSP', csps: { off: 'ไม่มี', nonce: 'nonce', unsafe: "'unsafe-inline'" },
    legend: [{ kind: 'new', text: 'สิ่งที่ผู้โจมตีทำให้เกิดขึ้น' }, { kind: 'use', text: 'ส่วนที่เราเขียนเอง' }],
    page: 'HTML ที่ Server ส่งออกไป', parsed: 'สิ่งที่ Browser สร้างขึ้นจาก HTML นั้น', none: '(ไม่มี Element หรือ Attribute ที่ไม่ได้ตั้งใจ)', injectedTag: 'ของที่ไม่มีใครเขียน', runs: 'Script ของผู้โจมตีรัน', blocked: 'CSP บล็อกไว้ เพราะ Script ไม่มี nonce', harmless: 'ข้อความถูกแสดงเป็นข้อความ ไม่มีอะไรรัน',
    why: { html: 'Encode เป็น &lt; แล้ว < ไม่เริ่ม Tag', attr: 'Encode เครื่องหมาย " ทำให้ค่าไม่ถูกปิดก่อนเวลา', js: 'json.dumps ใส่ค่าเป็นสตริงเดียว และเขียน < เป็น \\u003c ทำให้ </script> ปิดบล็อกไม่ได้' },
    safeEnc: { html: 'html.escape', attr: 'html.escape (และใส่ " ครอบค่าเสมอ)', js: 'json.dumps ที่เขียน < เป็น \\u003c' },
    caption: 'หน้า HTML และ Element ที่ Parser ของ Python สร้างขึ้นมาจากการรันจริงในแบบฝึก 09 ส่วนผลของ CSP คือโมเดลของกฎที่เขียนในแบบฝึก ไม่ได้รันใน Browser จริง',
  },
  en: {
    title: 'Pick where the user\'s text lands in the page, what is typed, whether the output is encoded and whether there is a CSP, and see what the browser builds and whether a script runs',
    ctx: 'where', ctxs: { html: 'HTML text', attr: 'an attribute', js: 'inside <script>' }, typed: 'user types', honest: 'honest text', attack: 'the attack',
    enc: 'Encode on output', encs: ['no encoding', 'the right encoding'], csp: 'CSP', csps: { off: 'none', nonce: 'nonce', unsafe: "'unsafe-inline'" },
    legend: [{ kind: 'new', text: 'what the attacker made happen' }, { kind: 'use', text: 'the part we wrote' }],
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
      <Legend items={T.legend} />
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
        <div style={{ border: `3px solid ${runs ? 'var(--ib-bad)' : 'var(--line-strong)'}`, borderRadius: 12, padding: 12, background: 'var(--surface)', fontWeight: 700 }}>
          {runs ? <span style={{ color: 'var(--ib-bad)' }}>✗ {T.runs}</span> : blocked ? <span>✓ {T.blocked}</span> : <span>✓ {T.harmless}</span>}
          {safe && !c.injected && <div style={{ fontWeight: 400, fontSize: 14, marginTop: 6 }}>{T.why[ctx]}</div>}
        </div>
      </div>
      <figcaption className="viz-caption">{T.caption}</figcaption>
    </figure>
  );
}
