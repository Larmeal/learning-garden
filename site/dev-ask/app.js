// Dev only: browser half of the "Ask" app (see integration.mjs). Everything is drawn inside the toolbar's own shadow root,
// so the site's CSS cannot touch it and it never lands in a build.
//
// While the app is on, a panel sits beside the page. Highlight text on the page (the usual way, by dragging) and the text
// is attached to the question box with a marker over it. The question goes to the dev server, which asks the `claude`
// program of this computer and streams the answer back.
//
// Nothing about a conversation is kept here except which session is open: the messages are read back from the session
// files of Claude Code each time (see integration.mjs), so a chat started in the VS Code extension shows up in the list
// and can be continued, and the other way round.
import { defineToolbarApp } from 'astro/toolbar';

const EVENT = {
  hello: 'garden:ask:hello',
  ready: 'garden:ask:ready',
  send: 'garden:ask:send',
  cancel: 'garden:ask:cancel',
  out: 'garden:ask:out',
  list: 'garden:ask:list',
  listed: 'garden:ask:listed',
  open: 'garden:ask:open',
  opened: 'garden:ask:opened',
  rename: 'garden:ask:rename',
  renamed: 'garden:ask:renamed',
};
const PREFS = 'garden:ask:prefs:v2';
const ASK_PREFIX = 'หน้าที่เปิดอยู่:'; // the first line of every question that buildPrompt writes
const NORMAL_WIDTH = 400;
const MODELS = [
  ['', 'ค่าเริ่มต้น'],
  ['sonnet', 'Sonnet'],
  ['opus', 'Opus'],
  ['haiku', 'Haiku'],
];
const TOOL_LABEL = { Read: 'อ่าน', Grep: 'ค้นหา', Glob: 'หาไฟล์', Bash: 'คำสั่ง', Edit: 'แก้ไฟล์', Write: 'เขียนไฟล์', WebFetch: 'เปิดเว็บ', WebSearch: 'ค้นเว็บ' };
// Shortcuts that appear while some text is picked. Each one is sent as it is written here.
const QUICK = [
  ['หมายความว่าอะไร', 'ส่วนที่ฉันเลือกหมายความว่าอะไร อธิบายให้เข้าใจง่าย'],
  ['ยกตัวอย่าง', 'ยกตัวอย่างให้เห็นภาพหน่อย'],
  ['ทำไมถึงเป็นแบบนี้', 'ทำไมถึงเป็นแบบนี้ ถ้าไม่เป็นแบบนี้จะเกิดอะไรขึ้น'],
  ['ถามเช็กความเข้าใจ', 'ช่วยถามคำถามเช็กความเข้าใจส่วนนี้ให้หน่อย ทีละข้อ'],
];

const CSS = `
:host { all: initial; }
[hidden] { display: none !important; }
.root, .root * { box-sizing: border-box; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", "Noto Sans Thai", "Noto Sans", sans-serif; }
.root { --bg: #13151a; --bg2: #0b0c10; --fg: #e6e7ec; --muted: #9aa0ad; --dim: #6f7684; --line: #343841; --line2: #22252d; --btn: #1d2027; --btnh: #262a33; --accent: #7b6cf6; --accent-h: #8d80f8; --accent-bg: #1a1730; --accent-line: #4a42a8; --accent-fg: #c9c4f6; --accent-dim: #8d86d8; --ok-bg: #0e3325; --ok-fg: #6be3a8; --warn-bg: #3a2f0a; --warn-fg: #ffd76a; --err: #ff8a8a; --hl: rgba(123, 108, 246, .3); --shadow: rgba(0,0,0,.5);
  position: fixed; inset: 0; pointer-events: none; z-index: 2147483000; color: var(--fg); font-size: 13px; line-height: 1.55; }
.root.light { --bg: #ffffff; --bg2: #f4f5f7; --fg: #1b1d24; --muted: #5b6270; --dim: #8a91a0; --line: #d3d7df; --line2: #e6e8ed; --btn: #f1f2f5; --btnh: #e5e7ec; --accent: #6a5af0; --accent-h: #5a49e6; --accent-bg: #efedff; --accent-line: #b9b2f7; --accent-fg: #3b30a8; --accent-dim: #6b62c8; --ok-bg: #d9f3e6; --ok-fg: #116b44; --warn-bg: #fff0c2; --warn-fg: #7a5a00; --err: #c53030; --hl: rgba(106, 90, 240, .25); --shadow: rgba(30,35,50,.22); }
.layer, .layer > * { pointer-events: none; }
.hl { position: fixed; background: var(--hl); border-bottom: 2px solid var(--accent); border-radius: 2px; }

.panel { position: fixed; right: 16px; bottom: 84px; width: var(--w, ${NORMAL_WIDTH}px); max-width: calc(100vw - 16px); height: min(74vh, 680px); display: flex; flex-direction: column; overflow: hidden; pointer-events: auto; background: var(--bg); border: 1px solid var(--line); border-radius: 12px; box-shadow: 0 10px 30px var(--shadow); }
.panel[data-wide] { height: min(88vh, 900px); }
.panel[data-side="left"] { right: auto; left: 16px; }
.grip { position: absolute; top: 0; bottom: 0; left: 0; width: 7px; cursor: ew-resize; z-index: 2; touch-action: none; }
.panel[data-side="left"] .grip { left: auto; right: 0; }
.grip:hover, .grip.drag { background: var(--accent); opacity: .5; }
.head { display: flex; align-items: center; gap: 4px; padding: 7px 8px 7px 10px; border-bottom: 1px solid var(--line); }
.head .title { flex: 1; min-width: 0; font-weight: 600; font-size: 13.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sub .chip { flex: none; }
.sub { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; padding: 5px 10px; border-bottom: 1px solid var(--line2); font-size: 11.5px; color: var(--muted); }
.grow { flex: 1; }
.chip { display: inline-block; padding: 1px 8px; border-radius: 99px; background: var(--btn); color: var(--muted); font-size: 11px; max-width: 190px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.chip.warn { background: var(--warn-bg); color: var(--warn-fg); }
.chip.ok { background: var(--ok-bg); color: var(--ok-fg); }
.chip.ask { background: var(--accent-bg); color: var(--accent-fg); }
.btn { font: inherit; border: 1px solid var(--line); background: var(--btn); color: var(--fg); border-radius: 8px; padding: 5px 11px; cursor: pointer; }
.btn:hover { background: var(--btnh); }
.btn:disabled { opacity: .5; cursor: default; }
.btn.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
.btn.primary:hover:not(:disabled) { background: var(--accent-h); }
.btn.ghost { border-color: transparent; background: transparent; padding: 4px 8px; color: var(--muted); }
.btn.ghost:hover { color: var(--fg); background: var(--btn); }
.btn.ghost[aria-pressed="true"] { color: var(--accent); }
select { font: inherit; font-size: 12px; color: var(--fg); background: var(--btn); border: 1px solid var(--line); border-radius: 8px; padding: 3px 6px; }

.msgs { flex: 1; overflow: auto; padding: 12px; display: flex; flex-direction: column; gap: 14px; }
.hint { color: var(--muted); font-size: 12.5px; }
.hint p { margin: 0 0 8px; }
.msg { overflow-wrap: anywhere; }
.msg.user { border-left: 3px solid var(--accent); padding-left: 10px; white-space: pre-wrap; }
.quote { color: var(--muted); font-size: 12px; margin-bottom: 4px; white-space: normal; }
.quote b { color: var(--fg); font-weight: 600; }
.quote small { display: block; color: var(--dim); }
.err { color: var(--err); white-space: pre-wrap; margin-top: 4px; }
.think { color: var(--muted); }
.think::after { content: "…"; animation: blink 1s infinite; }
@keyframes blink { 50% { opacity: .2; } }

.tool { margin: 0 0 8px; border: 1px solid var(--line2); border-radius: 8px; background: var(--bg2); font-size: 12px; }
.tool > summary { cursor: pointer; list-style: none; padding: 5px 9px; display: flex; gap: 8px; align-items: center; color: var(--muted); }
.tool > summary::-webkit-details-marker { display: none; }
.tool > summary::before { content: "▸"; color: var(--dim); font-size: 10px; }
.tool[open] > summary::before { content: "▾"; }
.tool .name { color: var(--fg); font-weight: 600; flex: none; }
.tool .detail { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: ui-monospace, "Cascadia Code", Consolas, monospace; font-size: 11.5px; }
.tool .st { flex: none; font-size: 11px; }
.tool .st.run { animation: blink 1s infinite; }
.tool .st.bad { color: var(--err); }
.tool .body { border-top: 1px solid var(--line2); padding: 7px 9px; display: flex; flex-direction: column; gap: 6px; }
.tool .body b { color: var(--dim); font-weight: 600; font-size: 11px; }
.tool pre { margin: 0; padding: 0; max-height: 220px; overflow: auto; font-family: ui-monospace, "Cascadia Code", Consolas, monospace; font-size: 11.5px; white-space: pre-wrap; overflow-wrap: anywhere; color: var(--muted); }

.md p { margin: 0 0 8px; white-space: pre-wrap; }
.md p:last-child, .md ul:last-child, .md ol:last-child, .md .code:last-child { margin-bottom: 0; }
.md ul, .md ol { margin: 0 0 8px; padding-left: 20px; }
.md li { margin: 2px 0; }
.md-h { font-weight: 700; margin: 10px 0 4px; font-size: 14px; }
.md code { font-family: ui-monospace, "Cascadia Code", Consolas, monospace; font-size: 12px; background: var(--bg2); border: 1px solid var(--line2); border-radius: 4px; padding: 0 4px; }
.code { margin: 0 0 8px; border: 1px solid var(--line2); border-radius: 8px; background: var(--bg2); overflow: hidden; }
.code-head { display: flex; align-items: center; justify-content: space-between; padding: 2px 4px 2px 10px; border-bottom: 1px solid var(--line2); color: var(--dim); font-size: 11px; }
.code-head .btn { font-size: 11px; padding: 1px 8px; }
.code pre { margin: 0; padding: 9px 10px; overflow: auto; }
.code pre code { background: none; border: 0; padding: 0; font-size: 12px; white-space: pre; }

.list { flex: 1; overflow: auto; }
.row-wrap { display: flex; align-items: flex-start; border-bottom: 1px solid var(--line2); }
.row-wrap[aria-current="true"] { background: var(--accent-bg); }
.row-wrap:hover { background: var(--btn); }
.row-wrap[aria-current="true"]:hover { background: var(--accent-bg); }
.row-item { flex: 1; min-width: 0; display: block; text-align: left; font: inherit; color: inherit; background: none; border: 0; padding: 9px 4px 9px 12px; cursor: pointer; }
.row-wrap > .btn { flex: none; margin: 6px 6px 0 0; opacity: .55; }
.row-wrap:hover > .btn { opacity: 1; }
.row-wrap.edit { padding: 8px 10px; gap: 6px; align-items: center; }
.edit-input { flex: 1; min-width: 0; font: inherit; color: inherit; background: var(--bg2); border: 1px solid var(--accent-line); border-radius: 8px; padding: 5px 8px; }
.edit-input:focus { outline: 2px solid var(--accent); outline-offset: -1px; }
.head .title[title] { cursor: text; }
.head .edit-input { font-weight: 600; font-size: 13px; }
.row-item .t { overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow-wrap: anywhere; }
.row-item .meta { display: flex; gap: 6px; align-items: center; margin-top: 3px; color: var(--dim); font-size: 11px; flex-wrap: wrap; }

.foot { border-top: 1px solid var(--line); padding: 8px 10px 10px; display: flex; flex-direction: column; gap: 7px; }
.pick { display: flex; gap: 8px; align-items: flex-start; background: var(--accent-bg); border: 1px solid var(--accent-line); border-radius: 8px; padding: 6px 8px; }
.pick .t { flex: 1; font-size: 12px; color: var(--accent-fg); overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow-wrap: anywhere; }
.pick .t small { display: block; color: var(--accent-dim); }
.quick { display: flex; gap: 6px; flex-wrap: wrap; }
.quick .btn { font-size: 12px; padding: 3px 9px; border-radius: 99px; }
textarea { font: inherit; color: inherit; width: 100%; min-height: 58px; max-height: 160px; resize: vertical; background: var(--bg2); border: 1px solid var(--line); border-radius: 8px; padding: 7px 9px; }
textarea:focus { outline: 2px solid var(--accent); outline-offset: -1px; }
.row { display: flex; gap: 8px; align-items: center; }
.row small { color: var(--dim); }
@media (max-width: 520px) { .panel { right: 8px; left: 8px; width: auto; } .panel[data-side="left"] { left: 8px; } .grip { display: none; } }
`;

function h(tag, props = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') n.className = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (v === true) n.setAttribute(k, '');
    else if (v !== false && v != null) n.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) n.append(kid);
  return n;
}
// replaceChildren turns null into the text "null", so drop and flatten first.
const fill = (parent, ...kids) => parent.replaceChildren(...kids.flat().filter((k) => k != null && k !== false));
const clean = (s) => s.replace(/\s+/g, ' ').trim();
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

function ago(ms) {
  const s = Math.max(0, (Date.now() - ms) / 1000);
  if (s < 60) return 'เมื่อสักครู่';
  if (s < 3600) return `${Math.floor(s / 60)} นาทีที่แล้ว`;
  if (s < 86400) return `${Math.floor(s / 3600)} ชั่วโมงที่แล้ว`;
  if (s < 86400 * 14) return `${Math.floor(s / 86400)} วันที่แล้ว`;
  return new Date(ms).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
}
const sizeOf = (b) => (b >= 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`);

// ---- a small Markdown reader for the answers (no HTML is ever inserted: everything is built as nodes) -----------------
function inline(text) {
  const out = [];
  const re = /`([^`]+)`|\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] != null) out.push(h('code', {}, m[1]));
    else if (m[2] != null) out.push(h('strong', {}, m[2]));
    else out.push(m[3]); // a link shows its words only
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function copyButton(getText) {
  const b = h('button', { class: 'btn ghost', title: 'คัดลอก' }, 'Copy');
  b.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(getText());
      b.textContent = 'คัดลอกแล้ว';
    } catch {
      b.textContent = 'คัดลอกไม่ได้';
    }
    setTimeout(() => (b.textContent = 'Copy'), 1400);
  });
  return b;
}

function codeBlock(lang, body) {
  return h('div', { class: 'code' }, h('div', { class: 'code-head' }, h('span', {}, lang || 'code'), copyButton(() => body)), h('pre', {}, h('code', {}, body)));
}

function renderMd(src) {
  const nodes = [];
  const lines = src.split('\n');
  const isList = (l) => /^\s*([-*]|\d+\.)\s+/.test(l);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const fence = /^\s*```\s*([\w+#.-]*)/.exec(line);
    if (fence) {
      const body = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) body.push(lines[i++]);
      i++; // the closing fence, or the end of the text while the answer is still arriving
      nodes.push(codeBlock(fence[1], body.join('\n')));
      continue;
    }
    if (!line.trim()) {
      i++;
      continue;
    }
    const head = /^#{1,4}\s+(.*)$/.exec(line);
    if (head) {
      nodes.push(h('div', { class: 'md-h' }, inline(head[1])));
      i++;
      continue;
    }
    if (/^\s*\|/.test(line)) {
      const rows = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(lines[i++]);
      nodes.push(codeBlock('table', rows.join('\n')));
      continue;
    }
    if (isList(line)) {
      const ordered = /^\s*\d/.test(line);
      const items = [];
      for (let m; i < lines.length && (m = /^\s*(?:[-*]|\d+\.)\s+(.*)$/.exec(lines[i])); i++) items.push(h('li', {}, inline(m[1])));
      nodes.push(h(ordered ? 'ol' : 'ul', {}, items));
      continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^\s*(```|#{1,4}\s|\|)/.test(lines[i]) && !isList(lines[i])) para.push(lines[i++]);
    nodes.push(h('p', {}, inline(para.join('\n'))));
  }
  return nodes;
}

// ---- what the page says about the picked text ------------------------------------------------------------------------
function nearestHeading(el) {
  let found = null;
  for (const hd of document.querySelectorAll('h1,h2,h3')) {
    if (hd.closest('astro-dev-toolbar')) continue;
    if (hd.contains(el) || hd.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) found = hd;
    else break;
  }
  return found ? clip(clean(found.textContent ?? ''), 120) : '';
}

function componentOf(el) {
  const url = el.closest('astro-island')?.getAttribute('component-url') ?? '';
  return url ? decodeURIComponent(url.split('?')[0]).replace(/^.*\/src\//, 'src/') : '';
}

function describePick(sel) {
  const range = sel.getRangeAt(0);
  const quote = clean(sel.toString()).slice(0, 1500);
  const node = range.commonAncestorContainer;
  const host = node.nodeType === 1 ? node : node.parentElement;
  const block = host.closest('p,li,td,th,h1,h2,h3,h4,h5,figcaption,blockquote,pre,summary,dd,dt') ?? host;
  const text = clean(block.textContent ?? '');
  const at = text.indexOf(clean(quote));
  return {
    quote,
    before: at >= 0 ? text.slice(Math.max(0, at - 160), at) : '',
    after: at >= 0 ? text.slice(at + quote.length, at + quote.length + 160) : '',
    block: text.length > quote.length + 40 ? clip(text, 800) : '',
    heading: nearestHeading(host),
    component: componentOf(host),
    range: range.cloneRange(),
  };
}

function pageContext() {
  const root = document.documentElement;
  const current = [...document.querySelectorAll('[data-step]')].findIndex((s) => s.classList.contains('is-current'));
  return {
    lang: root.lang,
    step: root.dataset.view === 'steps' && current >= 0 ? current + 1 : 0,
    file: document.querySelector('.dev-editor')?.dataset.file ?? '',
  };
}

function buildPrompt(question, pick) {
  const ctx = pageContext();
  const lines = [`${ASK_PREFIX} ${location.pathname} (ภาษา ${ctx.lang || '-'}${ctx.step ? `, การ์ดที่ ${ctx.step}` : ''})`];
  if (ctx.file) lines.push(`ไฟล์บทเรียน: site/${ctx.file.replace(/^site\//, '')}`);
  if (pick) {
    if (pick.heading) lines.push(`หัวข้อที่อยู่ใกล้ที่สุด: ${pick.heading}`);
    if (pick.component) lines.push(`ส่วนนี้เป็น Lab/Component: ${pick.component}`);
    lines.push('', 'ข้อความที่ฉันเลือกบนหน้า:', '"""', pick.quote, '"""');
    if (pick.before || pick.after) lines.push(`(ข้อความรอบ ๆ: …${pick.before} [ส่วนที่เลือก] ${pick.after}…)`);
    if (pick.block) lines.push(`(ทั้งย่อหน้า: ${pick.block})`);
  }
  lines.push('', `คำถาม: ${question}`);
  return lines.join('\n');
}

// The reverse of buildPrompt, for a question read back from a session file: show what the owner wrote and the text they picked.
function unwrapPrompt(text) {
  if (!text.startsWith(ASK_PREFIX)) return { text, quote: null };
  const q = /\n"""\n([\s\S]*?)\n"""/.exec(text);
  const heading = /\nหัวข้อที่อยู่ใกล้ที่สุด: (.*)/.exec(text);
  const at = text.lastIndexOf('\nคำถาม: ');
  return { text: at >= 0 ? text.slice(at + 8) : text, quote: q ? { text: q[1], heading: heading ? heading[1] : '' } : null };
}

function fromHistory(m) {
  if (m.role === 'user') {
    const u = unwrapPrompt(m.text);
    return { role: 'user', text: u.text, quote: u.quote };
  }
  return m;
}

// ---- remembered settings (the conversation itself is in Claude Code's own session files) ------------------------------
function loadPrefs() {
  try {
    localStorage.removeItem('garden:ask:v1'); // the first version of this app kept whole conversations here
    const d = JSON.parse(localStorage.getItem(PREFS) ?? 'null');
    if (d && typeof d === 'object') return { side: 'right', width: null, model: '', session: '', ...d };
  } catch {
    /* an empty or private window: use the defaults */
  }
  return { side: 'right', width: null, model: '', session: '' };
}

export default defineToolbarApp({
  init(canvas, app, server) {
    canvas.append(h('style', {}, CSS));
    const root = h('div', { class: 'root', hidden: true });
    const layer = h('div', { class: 'layer' });
    const panel = h('div', { class: 'panel' });
    root.append(layer, panel);
    canvas.append(root);
    // Keys typed in the panel must not reach the page: the lesson player listens for arrow keys.
    ['keydown', 'keyup', 'keypress'].forEach((t) => root.addEventListener(t, (e) => e.stopPropagation()));

    let on = false;
    const prefs = loadPrefs();
    // what the open conversation is: its session id, whether Claude already has that session, and what to show of it
    const chat = { session: prefs.session, resume: Boolean(prefs.session), title: '', messages: [], info: null, ask: true, truncated: false, loading: false, missing: false };
    let view = 'chat'; // or 'history'
    let sessions = null;
    let ready = null; // { ok, reason? } from the server
    let picked = null;
    let current = null; // { id, reply, stopped }
    let frame = 0;
    let hlNodes = [];
    let renaming = ''; // the session id whose name is being typed in the history list
    let renamingHead = false; // the name of the open chat is being typed in the header
    let notice = '';
    let noticeTimer = 0;
    const say = (text) => {
      notice = text;
      clearTimeout(noticeTimer);
      noticeTimer = setTimeout(() => ((notice = ''), on && renderHead()), 9000);
      if (on) renderHead();
    };

    const savePrefs = () => {
      try {
        localStorage.setItem(PREFS, JSON.stringify({ side: prefs.side, width: prefs.width, model: prefs.model, session: chat.resume ? chat.session : '' }));
      } catch {
        /* storage is blocked: the settings last until the page is closed */
      }
    };
    const inUi = (e) => e.composedPath().some((n) => n === root || n.localName === 'astro-dev-toolbar');

    // ---- the marker over the picked text ---------------------------------------------------------------------------
    function drawPick() {
      frame = 0;
      hlNodes.forEach((n) => n.remove());
      hlNodes = [];
      if (!on || !picked) return;
      for (const r of picked.range.getClientRects()) {
        if (r.width < 2 || r.height < 2) continue;
        const part = h('div', { class: 'hl' });
        Object.assign(part.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
        hlNodes.push(part);
      }
      layer.append(...hlNodes);
    }
    const scheduleDraw = () => (frame ||= requestAnimationFrame(drawPick));

    // ---- theme: the same as the site ------------------------------------------------------------------------------
    const applyTheme = () => {
      const t = document.documentElement.dataset.theme;
      root.classList.toggle('light', t ? t === 'light' : !matchMedia('(prefers-color-scheme: dark)').matches);
    };
    new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
    applyTheme();

    // ---- panel skeleton ------------------------------------------------------------------------------------------------
    const grip = h('div', { class: 'grip', title: 'ลากเพื่อปรับความกว้าง' });
    const head = h('div', { class: 'head' });
    const sub = h('div', { class: 'sub', hidden: true });
    const body = h('div', { class: 'msgs' });
    const pickBox = h('div', {});
    const quick = h('div', { class: 'quick' });
    const area = h('textarea', { placeholder: 'เลือกข้อความบนหน้าแล้วถามได้เลย หรือพิมพ์ถามเรื่องหน้านี้' });
    const sendBtn = h('button', { class: 'btn primary', onclick: () => submit(area.value) }, 'ส่ง');
    const stopBtn = h('button', { class: 'btn', onclick: stop }, 'หยุด');
    const status = h('small', {}, '');
    const foot = h('div', { class: 'foot' }, pickBox, quick, area, h('div', { class: 'row' }, status, h('span', { class: 'grow' }), stopBtn, sendBtn));
    panel.append(grip, head, sub, body, foot);

    area.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) {
        e.preventDefault();
        submit(area.value);
      }
    });

    // dragging the edge changes the width, and it is remembered
    grip.addEventListener('pointerdown', (e) => {
      grip.setPointerCapture(e.pointerId);
      grip.classList.add('drag');
      const move = (ev) => {
        const w = prefs.side === 'left' ? ev.clientX - 16 : innerWidth - ev.clientX - 16;
        prefs.width = Math.round(Math.max(320, Math.min(w, Math.min(1000, innerWidth - 32))));
        applySize();
      };
      const up = () => {
        grip.classList.remove('drag');
        grip.removeEventListener('pointermove', move);
        grip.removeEventListener('pointerup', up);
        savePrefs();
      };
      grip.addEventListener('pointermove', move);
      grip.addEventListener('pointerup', up);
    });
    function applySize() {
      panel.style.setProperty('--w', (prefs.width ?? NORMAL_WIDTH) + 'px');
      panel.toggleAttribute('data-wide', (prefs.width ?? NORMAL_WIDTH) > NORMAL_WIDTH + 60);
    }
    const toggleWide = () => {
      prefs.width = (prefs.width ?? NORMAL_WIDTH) > NORMAL_WIDTH + 60 ? null : Math.min(780, Math.round(innerWidth * 0.6));
      applySize();
      savePrefs();
    };

    // ---- header ---------------------------------------------------------------------------------------------------------
    function renderHead() {
      const model = h(
        'select',
        { title: 'เลือก model สำหรับคำถามถัดไป', onchange: (e) => ((prefs.model = e.target.value), savePrefs()) },
        MODELS.map(([v, label]) => h('option', { value: v, selected: v === prefs.model }, label)),
      );
      const heading = nameField(chat.title, () => renamingHead, (v) => (renamingHead = v), chat.session, 'title');
      fill(
        head,
        h('button', { class: 'btn ghost', title: 'ประวัติแชต', 'aria-pressed': String(view === 'history'), onclick: toggleHistory }, '☰'),
        view === 'history' ? h('span', { class: 'title' }, 'ประวัติแชต') : heading,
        model,
        h('button', { class: 'btn ghost', title: 'ย้ายไปอีกฝั่ง', onclick: () => ((prefs.side = prefs.side === 'left' ? 'right' : 'left'), savePrefs(), renderPanel()) }, '⇆'),
        h('button', { class: 'btn ghost', title: 'ขยายหรือย่อ', onclick: toggleWide }, '⤢'),
        h('button', { class: 'btn ghost', title: 'แชตใหม่', onclick: newChat }, '＋'),
      );
      const info = chat.info;
      const notes = [];
      if (info) notes.push(info.auth === 'login' ? h('span', { class: 'chip ok', title: 'ใช้ login ของ Claude Code ในเครื่องนี้' }, `login · ${info.model}`) : h('span', { class: 'chip warn', title: 'โปรแกรม claude ใช้ API key ซึ่งคิดเงินตามจำนวน token' }, `API key · ${info.model}`));
      if (chat.resume && !chat.ask && view === 'chat') notes.push(h('span', { class: 'chip warn', title: 'เซสชันนี้ไม่ได้เริ่มจาก Ask: Claude จำทุกอย่างในนั้น และคำตอบของ Ask จะถูกต่อท้ายเข้าไปในเซสชันเดียวกัน' }, 'เซสชันจาก Claude Code'));
      if (chat.truncated && view === 'chat') notes.push(h('span', { class: 'chip', title: 'แสดงเฉพาะข้อความล่าสุด ส่วนที่เหลืออยู่ในไฟล์เซสชัน' }, 'แสดงข้อความล่าสุด'));
      if (notice) notes.push(h('span', {}, notice));
      sub.hidden = !notes.length;
      fill(sub, notes);
    }

    // The name of the open chat in the header: double-click to type a new one. Enter saves it, Escape leaves it as it was.
    function nameField(text, isEditing, setEditing, session, cls) {
      if (!isEditing()) {
        return h(
          'span',
          {
            class: cls,
            title: session && chat.resume ? 'ดับเบิลคลิกเพื่อเปลี่ยนชื่อ' : null,
            ondblclick: () => {
              if (!session || !chat.resume) return say('ตั้งชื่อได้หลังส่งข้อความแรก เพราะเซสชันยังไม่มีไฟล์ของ Claude Code');
              setEditing(true);
              renderHead();
              head.querySelector('.edit-input')?.select();
            },
          },
          text || 'แชตใหม่',
        );
      }
      return nameInput(text, session, () => (setEditing(false), renderHead()));
    }

    function nameInput(text, session, done) {
      const input = h('input', { class: 'edit-input', value: text, maxlength: '100', 'aria-label': 'ชื่อเซสชัน' });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') done();
        else if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) {
          e.preventDefault();
          const title = input.value.trim();
          if (title && title !== text) server.send(EVENT.rename, { session, title });
          done();
        }
      });
      input.addEventListener('blur', () => setTimeout(done, 120));
      queueMicrotask(() => input.focus());
      return input;
    }

    // ---- messages ------------------------------------------------------------------------------------------------------
    function renderTool(p) {
      const state = p.result == null ? (current ? 'run' : '') : p.isError ? 'bad' : '';
      const card = h(
        'details',
        { class: 'tool', open: p.open === true },
        h('summary', {}, h('span', { class: 'name' }, TOOL_LABEL[p.name] ?? p.name), h('span', { class: 'detail' }, p.detail), h('span', { class: `st ${state}` }, p.result == null ? (current ? 'กำลังทำ' : '') : p.isError ? 'ผิดพลาด' : '✓')),
        h('div', { class: 'body' }, p.input ? [h('b', {}, 'คำสั่ง'), h('pre', {}, p.input)] : null, p.result != null ? [h('b', {}, 'ผลลัพธ์'), h('pre', {}, p.result || '(ว่าง)')] : null),
      );
      // a card that is rebuilt while the answer arrives stays open if the owner opened it
      card.addEventListener('toggle', () => (p.open = card.open));
      return card;
    }

    function renderMessage(m) {
      if (m.role === 'user') {
        return h('div', { class: 'msg user' }, m.quote ? h('div', { class: 'quote' }, h('b', {}, `“${clip(m.quote.text, 200)}”`), m.quote.heading ? h('small', {}, m.quote.heading) : null) : null, m.text);
      }
      const last = m.parts[m.parts.length - 1];
      const waiting = m.state === 'streaming' && (!last || last.type === 'tool');
      return h(
        'div',
        { class: 'msg' },
        m.parts.map((p) => (p.type === 'tool' ? renderTool(p) : h('div', { class: 'md' }, renderMd(p.text)))),
        waiting ? h('div', { class: 'think' }, m.parts.length ? 'กำลังทำต่อ' : 'กำลังคิด') : null,
        m.state === 'error' || m.state === 'stopped' ? h('div', { class: 'err' }, m.state === 'stopped' ? `หยุดแล้ว${m.error ? ` (${m.error})` : ''}` : m.error || 'ตอบไม่สำเร็จ') : null,
      );
    }

    const nearBottom = () => body.scrollHeight - body.scrollTop - body.clientHeight < 60;
    function renderMessages() {
      const stick = nearBottom();
      if (chat.loading) fill(body, h('div', { class: 'hint' }, 'กำลังโหลดแชต…'));
      else if (chat.missing) fill(body, h('div', { class: 'hint' }, h('p', {}, 'ไม่พบเซสชันนี้ในโฟลเดอร์ของ Claude Code (อาจถูกลบไปแล้ว) เริ่มแชตใหม่ได้เลย')));
      else if (!chat.messages.length) {
        fill(
          body,
          h(
            'div',
            { class: 'hint' },
            h('p', {}, 'ลากคลุมข้อความบนหน้าที่อ่านอยู่ จะมีแถบสีม่วงขึ้นทับข้อความนั้น แล้วเลือกปุ่มลัดหรือพิมพ์คำถามของคุณ'),
            h('p', {}, 'คำตอบมาจาก Claude Code ที่ล็อกอินอยู่ในคอมพิวเตอร์เครื่องนี้ อ่านไฟล์ใน repo ได้ แต่แก้ไฟล์หรือสั่งคำสั่งไม่ได้'),
            h('p', {}, 'แชตถูกเก็บโดย Claude Code เอง กดปุ่ม ☰ เพื่อดูแชตเก่าและคุยต่อได้ รวมถึงแชตที่เริ่มจาก VS Code'),
          ),
        );
      } else fill(body, chat.messages.map(renderMessage));
      if (stick) body.scrollTop = body.scrollHeight;
    }
    // While an answer arrives only its own block is rebuilt.
    function renderLast() {
      if (view !== 'chat') return;
      const stick = nearBottom();
      const last = body.lastElementChild;
      const m = chat.messages[chat.messages.length - 1];
      if (!last || !m) return renderMessages();
      last.replaceWith(renderMessage(m));
      if (stick) body.scrollTop = body.scrollHeight;
    }

    function renderHistory() {
      if (sessions == null) return fill(body, h('div', { class: 'hint' }, 'กำลังโหลดรายการ…'));
      if (!sessions.length) return fill(body, h('div', { class: 'hint' }, 'ยังไม่มีแชตของโฟลเดอร์นี้'));
      fill(
        body,
        h(
          'div',
          { class: 'list' },
          sessions.map((s) =>
            s.id === renaming
              ? h('div', { class: 'row-wrap edit' }, nameInput(s.title, s.id, () => ((renaming = ''), renderHistory())))
              : h(
                  'div',
                  { class: 'row-wrap', 'aria-current': String(s.id === chat.session) },
                  h(
                    'button',
                    { class: 'row-item', onclick: () => openSession(s) },
                    h('div', { class: 't' }, s.title),
                    h('div', { class: 'meta' }, ago(s.mtime), '·', sizeOf(s.size), s.ask ? h('span', { class: 'chip ask' }, 'Ask') : null, s.recent ? h('span', { class: 'chip warn', title: 'เพิ่งมีการใช้งานเซสชันนี้เมื่อไม่นานมานี้ อาจยังเปิดอยู่ที่อื่น' }, 'ใช้งานอยู่?') : null),
                  ),
                  h('button', { class: 'btn ghost', title: 'เปลี่ยนชื่อ', onclick: () => ((renaming = s.id), renderHistory()) }, '✎'),
                ),
          ),
        ),
      );
    }

    function renderFoot() {
      const busy = current != null;
      const blocked = ready && ready.ok === false;
      foot.hidden = view !== 'chat';
      fill(
        pickBox,
        picked
          ? h('div', { class: 'pick' }, h('div', { class: 't' }, `“${clip(picked.quote, 220)}”`, picked.heading ? h('small', {}, picked.heading) : null), h('button', { class: 'btn ghost', title: 'เอาข้อความนี้ออก', onclick: () => clearPick(true) }, '✕'))
          : null,
      );
      fill(quick, picked && !busy && !blocked ? QUICK.map(([label, text]) => h('button', { class: 'btn', onclick: () => submit(text) }, label)) : null);
      area.disabled = blocked || chat.loading;
      sendBtn.disabled = busy || blocked || chat.loading;
      stopBtn.hidden = !busy;
      status.textContent = blocked ? ready.reason : busy ? 'กำลังตอบ…' : 'Enter ส่ง, Shift+Enter ขึ้นบรรทัดใหม่';
    }

    function renderPanel() {
      panel.hidden = !on;
      panel.dataset.side = prefs.side;
      applySize();
      if (!on) return;
      renderHead();
      if (view === 'history') renderHistory();
      else renderMessages();
      renderFoot();
    }

    // ---- sessions ----------------------------------------------------------------------------------------------------------
    function toggleHistory() {
      view = view === 'history' ? 'chat' : 'history';
      if (view === 'history') server.send(EVENT.list, {});
      renderPanel();
    }

    function openSession(s) {
      if (current) stop();
      Object.assign(chat, { session: s.id, resume: true, title: s.title, messages: [], info: null, ask: s.ask, truncated: false, loading: true, missing: false });
      view = 'chat';
      server.send(EVENT.open, { session: s.id });
      savePrefs();
      renderPanel();
    }

    function newChat() {
      if (current) stop();
      Object.assign(chat, { session: '', resume: false, title: '', messages: [], info: null, ask: true, truncated: false, loading: false, missing: false });
      view = 'chat';
      savePrefs();
      renderPanel();
      area.focus({ preventScroll: true });
    }

    server.on(EVENT.listed, (m) => {
      sessions = Array.isArray(m?.sessions) ? m.sessions : [];
      if (on && view === 'history') renderHistory();
    });

    server.on(EVENT.renamed, (m) => {
      if (!m) return;
      if (m.error) return say(`เปลี่ยนชื่อไม่สำเร็จ: ${m.error}`);
      const row = sessions?.find((s) => s.id === m.session);
      if (row) row.title = m.title;
      if (m.session === chat.session) chat.title = m.title;
      if (m.recent) say('เปลี่ยนชื่อแล้ว แต่เซสชันนี้เพิ่งถูกใช้งาน ถ้ายังเปิดอยู่ใน VS Code ชื่ออาจถูกเขียนทับ ให้พิมพ์ /rename ที่นั่นด้วย');
      if (on) {
        renderHead();
        if (view === 'history') renderHistory();
      }
    });

    server.on(EVENT.opened, (m) => {
      if (!m || m.session !== chat.session || !chat.loading) return;
      chat.loading = false;
      if (m.title) chat.title = m.title;
      if (m.missing) {
        Object.assign(chat, { resume: false, missing: true });
        savePrefs();
      } else if (m.messages) {
        chat.messages = m.messages.map(fromHistory);
        chat.ask = m.ask !== false;
        chat.truncated = m.truncated === true;
        if (!chat.title) chat.title = clip(chat.messages.find((x) => x.role === 'user')?.text ?? '', 60);
      }
      if (on) renderPanel();
      body.scrollTop = body.scrollHeight;
    });

    // ---- picking text on the page -----------------------------------------------------------------------------------
    function clearPick(redraw) {
      picked = null;
      drawPick();
      if (redraw) renderFoot();
    }
    function capture(e) {
      if (!on || inUi(e)) return;
      setTimeout(() => {
        const sel = getSelection();
        if (!sel || sel.isCollapsed || !sel.rangeCount || clean(sel.toString()).length < 2) return; // a click elsewhere keeps the pick
        const range = sel.getRangeAt(0);
        const host = range.commonAncestorContainer.nodeType === 1 ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement;
        if (!host || host.closest('astro-dev-toolbar,textarea,input,.dev-editor')) return;
        picked = describePick(sel);
        drawPick();
        if (view === 'history') {
          view = 'chat';
          renderPanel();
        } else renderFoot();
        area.focus({ preventScroll: true });
      }, 0);
    }
    document.addEventListener('mouseup', capture, true);
    document.addEventListener('keyup', (e) => e.shiftKey && capture(e), true);
    window.addEventListener('scroll', scheduleDraw, { passive: true, capture: true });
    window.addEventListener('resize', scheduleDraw);

    // ---- asking ---------------------------------------------------------------------------------------------------------
    function submit(text) {
      const question = text.trim();
      if (!question || current || chat.loading || (ready && ready.ok === false)) return;
      if (!chat.session) Object.assign(chat, { session: crypto.randomUUID(), resume: false, missing: false });
      const id = `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      chat.messages.push({ role: 'user', text: question, quote: picked ? { text: picked.quote, heading: picked.heading } : null });
      const reply = { role: 'assistant', parts: [], state: 'streaming' };
      chat.messages.push(reply);
      if (!chat.title) chat.title = clip(question, 60);
      current = { id, reply, stopped: false, breakText: false };
      server.send(EVENT.send, { id, session: chat.session, resume: chat.resume, model: prefs.model, prompt: buildPrompt(question, picked) });
      area.value = '';
      clearPick(false);
      renderHead();
      renderMessages();
      renderFoot();
      body.scrollTop = body.scrollHeight;
    }

    function stop() {
      if (!current) return;
      current.stopped = true;
      server.send(EVENT.cancel, { id: current.id });
    }

    server.on(EVENT.out, (m) => {
      if (!current || m?.id !== current.id) return;
      const r = current.reply;
      const last = r.parts[r.parts.length - 1];
      if (m.kind === 'init') {
        chat.resume = true;
        chat.info = { model: m.model, auth: m.auth };
        savePrefs();
        if (on) renderHead();
      } else if (m.kind === 'turn') current.breakText = true;
      else if (m.kind === 'delta') {
        if (last?.type === 'text' && !current.breakText) last.text += m.text;
        else r.parts.push({ type: 'text', text: m.text });
        current.breakText = false;
      } else if (m.kind === 'tool') {
        if (!r.parts.some((p) => p.type === 'tool' && p.id === m.toolId)) r.parts.push({ type: 'tool', id: m.toolId, name: m.name, detail: m.detail, input: m.input, result: null, isError: false });
      } else if (m.kind === 'toolresult') {
        const part = r.parts.find((p) => p.type === 'tool' && p.id === m.toolId);
        if (part) Object.assign(part, { result: m.text, isError: m.isError });
      } else if (m.kind === 'done') {
        r.state = 'done';
        if (!r.parts.some((p) => p.type === 'text') && m.text) r.parts.push({ type: 'text', text: m.text });
      } else if (m.kind === 'error') {
        r.state = current.stopped ? 'stopped' : 'error';
        r.error = current.stopped ? '' : m.message;
      }
      if (m.kind === 'done' || m.kind === 'error') {
        current = null;
        if (on) renderFoot();
      }
      if (on) renderLast();
    });

    server.on(EVENT.ready, (m) => {
      ready = m;
      if (on) renderFoot();
    });

    app.addEventListener('app-toggled', (event) => {
      on = event.detail.state === true;
      root.hidden = !on;
      if (on) {
        server.send(EVENT.hello, {});
        // a conversation that was open before the page was loaded comes back from Claude Code's session file
        if (chat.resume && chat.session && !chat.messages.length && !chat.loading && !chat.missing) {
          chat.loading = true;
          server.send(EVENT.open, { session: chat.session });
        }
        applyTheme();
        renderPanel();
        area.focus({ preventScroll: true });
      } else {
        clearPick(false);
        getSelection()?.removeAllRanges();
      }
      drawPick();
    });
  },
});
