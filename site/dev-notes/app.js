// Dev only: browser half of the "Notes" app (see integration.mjs). Everything is drawn inside the toolbar's own shadow
// root, so the site's CSS cannot touch it and it never lands in a build.
//
// While the app is on, the page is in "comment mode": a click, a right click or a drag over text picks a target instead of
// doing what it normally does, and the target gets a note. Notes are kept by the server, this file only shows them.
import { defineToolbarApp } from 'astro/toolbar';

const EVENT = {
  list: 'garden:notes:list',
  add: 'garden:notes:add',
  patch: 'garden:notes:patch',
  remove: 'garden:notes:remove',
  all: 'garden:notes:all',
};
const CATEGORIES = [
  ['fact', 'ข้อเท็จจริง'],
  ['wording', 'ภาษา'],
  ['layout', 'หน้าตา'],
  ['lab', 'Lab'],
  ['idea', 'ไอเดีย'],
];
const CATEGORY_LABEL = Object.fromEntries(CATEGORIES);
const SHAPES = new Set(['path', 'circle', 'rect', 'line', 'ellipse', 'polygon', 'polyline', 'text', 'tspan', 'use']);
const PAUSE_EVENTS = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'dblclick', 'auxclick', 'touchstart', 'touchend'];

const CSS = `
:host { all: initial; }
[hidden] { display: none !important; }
.root, .root * { box-sizing: border-box; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", "Noto Sans Thai", "Noto Sans", sans-serif; }
.root { position: fixed; inset: 0; pointer-events: none; z-index: 2147483000; color: #e6e7ec; font-size: 13px; line-height: 1.45; }
.layer, .layer > * { pointer-events: none; }
.hl { position: fixed; background: rgba(255, 196, 0, .34); border-bottom: 2px solid #ffc400; border-radius: 2px; }
.hl.draft { background: rgba(123, 108, 246, .3); border-color: #7b6cf6; }
.box { position: fixed; border: 2px dashed #ffc400; border-radius: 6px; background: rgba(255, 196, 0, .07); }
.box.draft { border-color: #7b6cf6; background: rgba(123, 108, 246, .1); }
.badge { position: fixed; min-width: 22px; height: 22px; padding: 0 6px; border-radius: 11px; background: #ffc400; color: #1b1500; font-weight: 700; font-size: 12px; display: grid; place-items: center; box-shadow: 0 1px 4px rgba(0,0,0,.45); pointer-events: auto; cursor: pointer; border: 0; }
.badge[data-state="resolved"] { background: #3ddc97; color: #04281a; }
.hover { position: fixed; border: 2px solid #7b6cf6; background: rgba(123, 108, 246, .12); border-radius: 4px; }
.hover-label { position: absolute; left: -2px; bottom: 100%; margin-bottom: 2px; padding: 1px 7px; border-radius: 4px; background: #7b6cf6; color: #fff; font-size: 11px; white-space: nowrap; max-width: 60vw; overflow: hidden; text-overflow: ellipsis; }
.hover-label.below { bottom: auto; top: 100%; margin: 2px 0 0; }

.pop, .panel { position: fixed; pointer-events: auto; background: #13151a; color: #e6e7ec; border: 1px solid #343841; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,.5); }
.pop { width: 340px; max-width: calc(100vw - 16px); padding: 14px; display: flex; flex-direction: column; gap: 10px; }
.pop-target { color: #9aa0ad; font-size: 12px; overflow-wrap: anywhere; max-height: 4.4em; overflow: hidden; }
.pop-target b { color: #e6e7ec; font-weight: 600; }
.row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.row .grow { flex: 1; }
select, textarea, input { font: inherit; color: inherit; background: #0b0c10; border: 1px solid #343841; border-radius: 8px; padding: 7px 9px; }
select:focus, textarea:focus, input:focus { outline: 2px solid #7b6cf6; outline-offset: -1px; }
textarea { width: 100%; min-height: 84px; resize: vertical; }
.btn { font: inherit; border: 1px solid #343841; background: #1d2027; color: #e6e7ec; border-radius: 8px; padding: 6px 12px; cursor: pointer; }
.btn:hover { background: #262a33; }
.btn.primary { background: #7b6cf6; border-color: #7b6cf6; color: #fff; }
.btn.primary:hover { background: #8d80f8; }
.btn.danger { color: #ff8a8a; }
.btn.ghost { border-color: transparent; background: transparent; }
.chip { display: inline-block; padding: 1px 8px; border-radius: 99px; background: #262a33; color: #c7cad3; font-size: 11px; }
.chip.warn { background: #3a2f0a; color: #ffd76a; }
.chip.ok { background: #0e3325; color: #6be3a8; }
.note-text { white-space: pre-wrap; overflow-wrap: anywhere; }
.reply { border-left: 3px solid #343841; padding: 2px 0 2px 10px; white-space: pre-wrap; overflow-wrap: anywhere; }
.reply.claude { border-color: #7b6cf6; }
.reply small { display: block; color: #9aa0ad; }
.flash { animation: flash .5s; }
@keyframes flash { 30% { outline: 2px solid #ff8a8a; } }

.panel { right: 16px; bottom: 84px; width: 300px; max-width: calc(100vw - 32px); max-height: min(60vh, 520px); display: flex; flex-direction: column; overflow: hidden; }
.panel-head { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-bottom: 1px solid #343841; }
.panel-head strong { font-size: 15px; }
.panel-head .grow { flex: 1; }
.panel-list { overflow: auto; margin: 0; padding: 0; list-style: none; }
.panel-item { display: flex; gap: 10px; padding: 9px 12px; border-bottom: 1px solid #22252d; cursor: pointer; }
.panel-item:hover { background: #1a1d24; }
.panel-item .n { flex: none; width: 22px; height: 22px; border-radius: 11px; background: #ffc400; color: #1b1500; font-weight: 700; font-size: 12px; display: grid; place-items: center; }
.panel-item[data-state="resolved"] .n { background: #3ddc97; color: #04281a; }
.panel-item .t { overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow-wrap: anywhere; }
.panel-item .meta { color: #9aa0ad; font-size: 11px; margin-top: 2px; }
.panel-hint { padding: 10px 12px; color: #9aa0ad; font-size: 12px; }
.panel-foot { padding: 6px 12px; border-top: 1px solid #343841; }
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

// replaceChildren turns null into the text "null" and an array into "[object ...]", so drop and flatten first.
const fill = (parent, ...kids) => parent.replaceChildren(...kids.flat().filter((k) => k != null && k !== false));

const clean = (s) => s.replace(/\s+/g, ' ').trim();
const strip = (s) => s.replace(/\s+/g, '');
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

// A short CSS path that finds the element again after a reload. It stops at the first element with an id.
function cssPath(el) {
  const parts = [];
  for (let n = el; n && n.nodeType === 1 && n !== document.documentElement; n = n.parentElement) {
    if (n.id) {
      parts.unshift('#' + CSS.escape(n.id));
      break;
    }
    let part = n.localName;
    const same = n.parentElement ? [...n.parentElement.children].filter((c) => c.localName === n.localName) : [];
    if (same.length > 1) part += `:nth-of-type(${same.indexOf(n) + 1})`;
    parts.unshift(part);
    if (n === document.body) break;
  }
  return parts.join(' > ');
}

// What Claude needs to find the source: the React island's file. Astro 7 did not tag any element with its .astro file
// here (data-astro-source-file was absent on every page checked), so astroFile stays empty unless a later version adds it,
// and an element of an .astro page is found again by its classes, text and selector.
function describeElement(el) {
  const island = el.closest('astro-island');
  const componentUrl = island?.getAttribute('component-url') ?? '';
  const component = componentUrl ? decodeURIComponent(componentUrl.split('?')[0]).replace(/^.*\/src\//, 'src/') : '';
  const tagged = el.closest('[data-astro-source-file]');
  const cls = [...el.classList].slice(0, 3).map((c) => '.' + c).join('');
  const own = el.localName + cls;
  const label = component ? `${component.split('/').pop().replace(/\.[jt]sx?$/, '')} › ${own}` : own;
  return {
    tag: el.localName,
    selector: cssPath(el),
    label,
    snippet: clip(clean(el.textContent ?? ''), 120),
    component,
    astroFile: tagged?.getAttribute('data-astro-source-file') ?? '',
    astroLoc: tagged?.getAttribute('data-astro-source-loc') ?? '',
  };
}

function describeSelection(sel) {
  const range = sel.getRangeAt(0);
  const quote = clean(sel.toString()).slice(0, 500);
  const node = range.commonAncestorContainer;
  const host = node.nodeType === 1 ? node : node.parentElement;
  const block = host.closest('p,li,td,th,h1,h2,h3,h4,h5,figcaption,blockquote,pre,summary,dd,dt,div,section') ?? host;
  const text = clean(block.textContent ?? '');
  const at = text.indexOf(quote);
  return {
    target: {
      kind: 'text',
      quote,
      prefix: at >= 0 ? text.slice(Math.max(0, at - 30), at) : '',
      suffix: at >= 0 ? text.slice(at + quote.length, at + quote.length + 30) : '',
      ...describeElement(block),
    },
    range: range.cloneRange(),
  };
}

function context() {
  const root = document.documentElement;
  const current = [...document.querySelectorAll('[data-step]')].findIndex((s) => s.classList.contains('is-current'));
  return {
    viewport: { w: innerWidth, h: innerHeight },
    theme: root.dataset.theme ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
    lang: root.lang,
    view: root.dataset.view ?? '',
    step: root.dataset.view === 'steps' && current >= 0 ? current + 1 : 0,
    sourceFile: document.querySelector('.dev-editor')?.dataset.file ?? '',
  };
}

// The words of the page in one string, so a quote picked in an earlier visit can be found again as a Range.
function buildIndex() {
  const nodes = [];
  let full = '';
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (!n.parentElement || n.parentElement.closest('astro-dev-toolbar,script,style,textarea,noscript') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    nodes.push({ node: n, start: full.length });
    full += n.data;
  }
  return { nodes, full };
}

function pointAt(index, off, isEnd) {
  const { nodes } = index;
  let lo = 0;
  let hi = nodes.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (nodes[mid].start <= off) lo = mid;
    else hi = mid - 1;
  }
  if (isEnd && off === nodes[lo].start && lo > 0) lo -= 1;
  const { node, start } = nodes[lo];
  return [node, Math.min(off - start, node.length)];
}

function findRange(index, t) {
  const tokens = t.quote.split(' ').filter(Boolean).map(escapeRe);
  if (!tokens.length || !index.nodes.length) return null;
  const re = new RegExp(tokens.join('\\s*'), 'g');
  const want = strip(t.prefix ?? '').slice(-12);
  // The same words can be on the page twice (a summary that is also in a header hidden in this reading mode), so the
  // order of preference is: shown and after the same words, shown, after the same words, anything.
  let first = null;
  let afterOnly = null;
  let shown = null;
  for (let m = re.exec(index.full), n = 0; m && n < 60; m = re.exec(index.full), n++) {
    const range = document.createRange();
    range.setStart(...pointAt(index, m.index, false));
    range.setEnd(...pointAt(index, m.index + m[0].length, true));
    const after = !want || strip(index.full.slice(Math.max(0, m.index - 80), m.index)).endsWith(want);
    const visible = rectsOf(range).length > 0;
    if (visible && after) return range;
    first ??= range;
    if (after) afterOnly ??= range;
    if (visible) shown ??= range;
    if (m[0].length === 0) re.lastIndex += 1;
  }
  return shown ?? afterOnly ?? first;
}

const rectsOf = (range) => [...range.getClientRects()].filter((r) => r.width > 1 && r.height > 1);

export default defineToolbarApp({
  init(canvas, app, server) {
    canvas.append(h('style', {}, CSS));
    const root = h('div', { class: 'root', hidden: true });
    const layer = h('div', { class: 'layer' });
    const hoverBox = h('div', { class: 'hover', hidden: true });
    const hoverLabel = h('span', { class: 'hover-label' });
    hoverBox.append(hoverLabel);
    const pop = h('div', { class: 'pop', hidden: true });
    const panel = h('div', { class: 'panel', hidden: true });
    root.append(layer, hoverBox, panel, pop);
    canvas.append(root);
    // Keys typed in the notes must not reach the page: the lesson player listens for arrow keys.
    ['keydown', 'keyup', 'keypress'].forEach((t) => root.addEventListener(t, (e) => e.stopPropagation()));

    let on = false;
    let comments = [];
    let hoverEl = null;
    let hoverStack = [];
    let draft = null; // { target, range?, el?, x, y }
    let openId = null;
    let showDone = false;
    let live = []; // one entry per note of this page: { c, n, range?, el?, status, nodes[] }
    let index = null;
    let frame = 0;
    let lastPos = null;

    const here = () => location.pathname;
    const mine = () => comments.filter((c) => c.path === here()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const inUi = (e) => e.composedPath().some((n) => n === root || n.localName === 'astro-dev-toolbar');

    // ---- hover -------------------------------------------------------------------------------------------------
    const pick = (el) => {
      let n = el;
      while (SHAPES.has(n.localName) && n.parentElement) n = n.parentElement;
      return n;
    };
    function placeHover() {
      if (!on || !hoverEl || draft) {
        hoverBox.hidden = true;
        return;
      }
      const r = hoverEl.getBoundingClientRect();
      hoverBox.hidden = false;
      Object.assign(hoverBox.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
      hoverLabel.textContent = describeElement(hoverEl).label;
      hoverLabel.classList.toggle('below', r.top < 24);
    }
    function setHover(el) {
      hoverEl = el;
      hoverStack = [];
      placeHover();
    }

    // ---- drawing the notes of this page ------------------------------------------------------------------------
    function locate(c) {
      const t = c.target;
      if (t.kind === 'text') {
        index ??= buildIndex();
        const range = findRange(index, t);
        return range ? { range } : { lost: true };
      }
      let el = null;
      try {
        el = t.selector ? document.querySelector(t.selector) : null;
      } catch {
        el = null;
      }
      return el ? { el } : { lost: true };
    }

    function rectsFor(entry) {
      if (entry.range) return rectsOf(entry.range);
      if (entry.el?.isConnected) {
        const r = entry.el.getBoundingClientRect();
        return r.width > 1 && r.height > 1 ? [r] : [];
      }
      return [];
    }

    // Moves the drawn parts to where their target is now (scroll, resize). The number of boxes of a wrapped text can change.
    function reposition() {
      frame = 0;
      for (const entry of live) {
        entry.nodes.forEach((n) => n.remove());
        entry.nodes = [];
        if (!on || (entry.c.status === 'resolved' && !showDone)) continue;
        const rects = rectsFor(entry);
        entry.visible = rects.length > 0;
        if (!rects.length) continue;
        const state = entry.c.status;
        rects.forEach((r) => {
          const part = h('div', { class: entry.range ? 'hl' : 'box' });
          Object.assign(part.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
          entry.nodes.push(part);
        });
        const r0 = rects[0];
        const left = entry.range ? r0.left - 10 : r0.right - 12;
        const badge = h('button', { class: 'badge', 'data-state': state, title: clip(entry.c.text, 80), onclick: () => openThread(entry.c.id, badge) }, String(entry.n));
        Object.assign(badge.style, { left: Math.max(2, Math.min(innerWidth - 26, left)) + 'px', top: Math.max(2, r0.top - 12) + 'px' });
        entry.nodes.push(badge);
        layer.append(...entry.nodes);
      }
      drawDraft();
      placeHover();
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(reposition);
    };

    let draftNodes = [];
    function drawDraft() {
      draftNodes.forEach((n) => n.remove());
      draftNodes = [];
      if (!draft || !on) return;
      const rects = draft.range ? rectsOf(draft.range) : draft.el?.isConnected ? [draft.el.getBoundingClientRect()] : [];
      rects.forEach((r) => {
        const part = h('div', { class: (draft.range ? 'hl' : 'box') + ' draft' });
        Object.assign(part.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
        draftNodes.push(part);
      });
      layer.append(...draftNodes);
    }

    // Rebuilds everything: after the list of notes changes, or after the page changed under the notes.
    function render() {
      layer.replaceChildren();
      index = null;
      live = mine().map((c, i) => ({ c, n: i + 1, nodes: [], ...locate(c) }));
      const open = live.filter((e) => e.c.status === 'open').length;
      app.toggleNotification(open > 0 ? { state: true, level: 'info' } : { state: false });
      reposition();
      renderPanel();
      if (openId && !comments.some((c) => c.id === openId)) closePop();
      else if (openId && !pop.hidden && !draft) openThread(openId);
    }

    // ---- panel -------------------------------------------------------------------------------------------------
    function renderPanel() {
      panel.hidden = !on;
      if (!on) return;
      const items = live.filter((e) => showDone || e.c.status === 'open');
      const doneCount = live.filter((e) => e.c.status === 'resolved').length;
      const openCount = live.length - doneCount;
      fill(panel,
        h('div', { class: 'panel-head' }, h('strong', {}, 'Notes'), h('span', { class: 'chip' }, `${openCount} ค้างอยู่`), h('span', { class: 'grow' })),
        items.length
          ? h(
              'ul',
              { class: 'panel-list' },
              items.map((e) => {
                const where = e.lost ? 'หาจุดนี้ไม่เจอ' : e.visible === false ? 'ซ่อนอยู่ในโหมดนี้' : '';
                return h(
                  'li',
                  { class: 'panel-item', 'data-state': e.c.status, onclick: (ev) => jump(e, ev.currentTarget) },
                  h('span', { class: 'n' }, String(e.n)),
                  h('div', {}, h('div', { class: 't' }, e.c.text), h('div', { class: 'meta' }, [CATEGORY_LABEL[e.c.category] ?? e.c.category, where, e.c.replies?.length ? `${e.c.replies.length} ตอบ` : ''].filter(Boolean).join(' · '))),
                );
              }),
            )
          : h('div', { class: 'panel-hint' }, 'คลิกส่วนที่มีปัญหา หรือลากคลุมข้อความ แล้วเขียนว่าผิดตรงไหน คลิกขวาก็ได้ ลูกศรขึ้นและลงเปลี่ยนชั้นของ element ที่เลือก'),
        doneCount || showDone ? h('div', { class: 'panel-foot' }, h('button', { class: 'btn ghost', onclick: () => ((showDone = !showDone), render()) }, showDone ? 'ซ่อนที่แก้แล้ว' : `ดูที่แก้แล้ว (${doneCount})`)) : null,
      );
    }

    function jump(entry, anchor) {
      const el = entry.el ?? entry.range?.startContainer?.parentElement;
      if (el?.isConnected) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      setTimeout(() => openThread(entry.c.id, anchor), el ? 450 : 0);
    }

    // ---- popover -----------------------------------------------------------------------------------------------
    function place(x, y) {
      const r = pop.getBoundingClientRect();
      const left = Math.max(8, Math.min(innerWidth - r.width - 8, x));
      const top = y + 16 + r.height > innerHeight - 8 ? Math.max(8, y - r.height - 12) : y + 16;
      Object.assign(pop.style, { left: left + 'px', top: top + 'px' });
    }
    function closePop() {
      pop.hidden = true;
      pop.replaceChildren();
      draft = null;
      openId = null;
      drawDraft();
      placeHover();
    }
    const draftText = () => pop.querySelector('textarea[data-draft]')?.value.trim() ?? '';

    function openDraft(d) {
      draft = d;
      openId = null;
      hoverBox.hidden = true;
      const t = d.target;
      const select = h('select', {}, CATEGORIES.map(([v, label]) => h('option', { value: v }, label)));
      const area = h('textarea', { 'data-draft': true, placeholder: 'เขียนว่าตรงนี้มีปัญหาอะไร หรืออยากให้เป็นแบบไหน' });
      const save = () => {
        const text = area.value.trim();
        if (!text) return area.classList.add('flash');
        server.send(EVENT.add, { comment: { path: here(), category: select.value, text, target: t, context: context() } });
        getSelection()?.removeAllRanges();
        closePop();
      };
      area.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) save();
        if (e.key === 'Escape') closePop();
      });
      fill(pop,
        h('div', { class: 'pop-target' }, t.kind === 'text' ? ['ข้อความ ', h('b', {}, `“${clip(t.quote, 110)}”`)] : [h('b', {}, t.label), t.snippet ? ` · ${clip(t.snippet, 70)}` : '']),
        h('div', { class: 'row' }, select),
        area,
        h('div', { class: 'row' }, h('span', { class: 'grow' }), h('button', { class: 'btn', onclick: closePop }, 'ยกเลิก'), h('button', { class: 'btn primary', onclick: save }, 'บันทึก (Ctrl+Enter)')),
      );
      pop.hidden = false;
      place(d.x, d.y);
      drawDraft();
      area.focus();
    }

    function openThread(id, anchor) {
      const c = comments.find((x) => x.id === id);
      if (!c) return;
      draft = null;
      drawDraft();
      openId = id;
      const entry = live.find((e) => e.c.id === id);
      const resolved = c.status === 'resolved';
      const reply = h('textarea', { placeholder: 'ตอบหรือเพิ่มข้อมูล', style: 'min-height:52px' });
      const send = () => {
        const text = reply.value.trim();
        if (text) server.send(EVENT.patch, { id, reply: text });
      };
      reply.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send();
        if (e.key === 'Escape') closePop();
      });
      const where = entry?.lost ? 'หาจุดนี้ไม่เจอ ข้อความอาจถูกแก้ไปแล้ว' : entry?.visible === false ? 'จุดนี้ซ่อนอยู่ในโหมดนี้ เช่น อยู่คนละ step' : '';
      fill(pop,
        h('div', { class: 'row' }, h('span', { class: 'chip' }, `#${entry?.n ?? ''}`), h('span', { class: 'chip warn' }, CATEGORY_LABEL[c.category] ?? c.category), h('span', { class: resolved ? 'chip ok' : 'chip' }, resolved ? 'แก้แล้ว' : 'ค้างอยู่'), h('span', { class: 'grow' }), h('button', { class: 'btn ghost', onclick: closePop }, '✕')),
        h('div', { class: 'pop-target' }, c.target.kind === 'text' ? ['ข้อความ ', h('b', {}, `“${clip(c.target.quote, 110)}”`)] : [h('b', {}, c.target.label), c.target.snippet ? ` · ${clip(c.target.snippet, 70)}` : '']),
        where ? h('div', { class: 'pop-target' }, where) : null,
        h('div', { class: 'note-text' }, c.text),
        (c.replies ?? []).map((r) => h('div', { class: 'reply ' + (r.by === 'claude' ? 'claude' : '') }, h('small', {}, r.by === 'claude' ? 'Claude' : 'คุณ'), r.text)),
        reply,
        h(
          'div',
          { class: 'row' },
          h('button', { class: 'btn danger', onclick: () => (server.send(EVENT.remove, { id }), closePop()) }, 'ลบ'),
          h('span', { class: 'grow' }),
          h('button', { class: 'btn', onclick: () => server.send(EVENT.patch, { id, status: resolved ? 'open' : 'resolved' }) }, resolved ? 'เปิดใหม่' : 'Resolve'),
          h('button', { class: 'btn primary', onclick: send }, 'ตอบ'),
        ),
      );
      pop.hidden = false;
      // A refresh of the list (a reply arrived) rebuilds the card in the place it already had.
      const r = anchor?.getBoundingClientRect?.();
      if (r) lastPos = { x: r.left, y: r.bottom - 8 };
      lastPos ??= { x: innerWidth / 2, y: 80 };
      place(lastPos.x, lastPos.y);
    }

    // ---- picking on the page -----------------------------------------------------------------------------------
    // While the app is on, the page does not get the pointer events, so a lab or a link is not triggered by a pick.
    PAUSE_EVENTS.forEach((type) =>
      document.addEventListener(
        type,
        (e) => {
          if (on && !inUi(e)) e.stopPropagation();
        },
        true,
      ),
    );

    document.addEventListener(
      'mousemove',
      (e) => {
        if (!on || draft || inUi(e) || !(e.target instanceof Element)) return;
        const el = pick(e.target);
        if (el !== hoverEl) setHover(el);
      },
      true,
    );

    function onPick(e) {
      if (!on || inUi(e) || !(e.target instanceof Element)) return;
      e.preventDefault();
      e.stopPropagation();
      if (draft && draftText()) {
        pop.querySelector('textarea')?.classList.add('flash');
        return;
      }
      const sel = getSelection();
      if (sel && !sel.isCollapsed && sel.toString().trim()) {
        const { target, range } = describeSelection(sel);
        openDraft({ target, range, x: e.clientX, y: e.clientY });
        return;
      }
      const el = hoverEl && hoverEl.contains(e.target) ? hoverEl : pick(e.target);
      openDraft({ target: { kind: 'element', ...describeElement(el) }, el, x: e.clientX, y: e.clientY });
    }
    document.addEventListener('click', onPick, true);
    document.addEventListener('contextmenu', onPick, true);

    // Up and down arrows move the pick one level out or in, for a target that is hard to hit (a thin line, a tiny dot).
    document.addEventListener(
      'keydown',
      (e) => {
        if (!on || draft || !hoverEl || inUi(e)) return;
        if (e.key === 'Escape') return closePop();
        if (e.key === 'ArrowUp' && hoverEl.parentElement && hoverEl !== document.body) {
          e.preventDefault();
          hoverStack.push(hoverEl);
          hoverEl = hoverEl.parentElement;
          placeHover();
        } else if (e.key === 'ArrowDown' && hoverStack.length) {
          e.preventDefault();
          hoverEl = hoverStack.pop();
          placeHover();
        }
      },
      true,
    );

    // ---- keeping up with the page and the file ------------------------------------------------------------------
    window.addEventListener('scroll', schedule, { passive: true, capture: true });
    window.addEventListener('resize', schedule);
    let settle = 0;
    new MutationObserver((records) => {
      if (records.every((m) => (m.target.nodeType === 1 ? m.target : m.target.parentElement)?.closest?.('astro-dev-toolbar'))) return;
      clearTimeout(settle);
      settle = setTimeout(() => comments.length && render(), 300);
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
    // The file may have been changed by Claude (a reply, a resolved note) while the page stayed open.
    window.addEventListener('focus', () => server.send(EVENT.list, {}));

    server.on(EVENT.all, (data) => {
      comments = Array.isArray(data?.comments) ? data.comments : [];
      render();
    });
    app.addEventListener('app-toggled', (event) => {
      on = event.detail.state === true;
      root.hidden = !on;
      if (on) server.send(EVENT.list, {});
      else {
        closePop();
        hoverEl = null;
        getSelection()?.removeAllRanges();
      }
      render();
    });
    server.send(EVENT.list, {});
  },
});
