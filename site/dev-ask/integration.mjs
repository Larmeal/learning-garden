// Dev only (`astro dev`, never part of a build): the "Ask" app of the Astro dev toolbar.
//
// The owner highlights text on a lesson page and asks Claude what it means. The browser half is app.js. This file is the
// server half: it starts the `claude` program that is installed on this computer (the same one the VS Code extension
// starts) in print mode, hands it the question and streams the answer back to the page.
//
// Nothing is stored by this app. A conversation is a Claude Code session, and Claude Code already keeps every session of
// this folder in ~/.claude/projects/<folder>/<id>.jsonl. The page lists those files (so a chat started in the VS Code
// extension can be continued here, and the other way round) and reads one back to show it. It only reads them, except that
// renaming a chat appends the two title lines that `/rename` of Claude Code writes (see renameSession).
//
// The login is the one `claude` already has on this computer. No token is read, stored or forwarded, and the app does not
// exist in a build, so it never reaches the published site. Safeguards:
//   - the app is switched off when the dev server listens on anything other than this computer (`astro dev --host`);
//   - Claude only gets the read tools (Read, Grep, Glob), so it cannot edit a file or run a command;
//   - no MCP server is started, a request has a time limit, and at most two run at once;
//   - only <id>.jsonl files of this folder's own project directory are read, and the id must be a UUID.
import { spawn } from 'node:child_process';
import { appendFile, open, readdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

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
const ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="#fff" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"><circle cx="10" cy="10" r="7.2"/><path d="M7.7 8.2a2.4 2.4 0 1 1 3.4 2.2c-.7.35-1.1.85-1.1 1.6"/><circle cx="10" cy="14.2" r=".6" fill="#fff"/></svg>';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const REQUEST_ID = /^[A-Za-z0-9_-]{1,64}$/;
const MODEL = /^[A-Za-z0-9._\-[\]]{1,60}$/;
const MAX_PROMPT = 24_000;
const MAX_RUNNING = 2;
const TIME_LIMIT_MS = 5 * 60 * 1000;
const TOOLS = 'Read,Grep,Glob';
const ASK_PREFIX = 'หน้าที่เปิดอยู่:'; // the first line app.js puts in every question
const RECENT_MS = 2 * 60 * 1000;
const MAX_SESSIONS = 60;
const MAX_HISTORY = 80; // messages sent to the page when a session is opened
const RESULT_LIMIT = 4000;

const SYSTEM_PROMPT = `You are the tutor of the Learning Garden, a personal learning site that its owner reads in a browser while running it on their own computer. The owner highlights a part of a lesson page and asks what it means. Your job is to teach that part.

Answer in Thai, the way a teacher talks to one reader: whole sentences with ordinary connectors, "เรา" or "คุณ", no greeting, no emoji, no polite particles such as "ครับ" or "ค่ะ", no em dash. Keep technical terms in English and start every English word in Thai prose with a capital letter (Dimension, Rule, Dataset), except inside backticks and code. Use Markdown for code, short lists and the occasional bold word, and do not put a bold label at the start of every list item.

How to teach:
- The message names the page, the lesson file, the nearest heading and the highlighted text. Start from what the highlighted text says, in plain words. Add one short example or picture in words when it helps, then say how it connects to what comes before or after it in the lesson.
- Read the lesson file when you need more than the quote. For a claim of a lesson, subjects/<subject>/docs/verified-findings.md says whether it was run, read from source or is the author's opinion, and subjects/<subject>/code/ has the exercise that checks it. Use Read, Grep and Glob only.
- Never invent a fact. If the lesson looks wrong, unclear or contradicts itself, say so and say where. If you are not sure, say what you are unsure about.
- Keep answers short unless the owner asks for depth. When the owner asks to test their understanding, ask one question at a time and wait for the answer.
- You cannot change files in this chat. If the owner wants the page changed, say what you would change and where, and tell them to ask Claude Code to do it.`;

// ---- Claude Code's own session files -----------------------------------------------------------------------------------
const claudeHome = () => process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude');

// Claude Code names the folder of a project after its path with every character that is not a letter or digit turned into
// "-". The drive letter may be either case on Windows, so the match ignores case.
async function projectDir(cwd) {
  const key = cwd.replace(/[\\/]+$/, '').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  const root = join(claudeHome(), 'projects');
  try {
    for (const name of await readdir(root)) if (name.toLowerCase() === key) return join(root, name);
  } catch {
    /* Claude Code has never run on this computer */
  }
  return '';
}

async function readSlice(path, start, length) {
  const fh = await open(path, 'r');
  try {
    const buf = Buffer.alloc(length);
    const { bytesRead } = await fh.read(buf, 0, length, start);
    return buf.toString('utf8', 0, bytesRead);
  } finally {
    await fh.close();
  }
}

const textOfContent = (c) => (typeof c === 'string' ? c : Array.isArray(c) ? c.filter((b) => b?.type === 'text').map((b) => b.text ?? '').join('\n') : '');

// What the owner typed in a "user" line of a session, or '' for a line that is a tool result, a note of the program or a
// command. Reminders and the editor's own tags are not the owner's words.
function userTextOf(j) {
  if (j.type !== 'user' || j.isMeta || j.isSidechain) return '';
  const c = j.message?.content;
  if (Array.isArray(c) && c.some((b) => b?.type === 'tool_result')) return '';
  const text = textOfContent(c)
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '')
    .replace(/<(ide_[a-z_]+)>[\s\S]*?<\/\1>/g, '')
    .trim();
  if (!text || /^<(command-|local-command)/.test(text) || text.startsWith('[Request interrupted')) return '';
  return text;
}

const parse = (line) => {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
};
// A line of a conversation starts with its parent's id, and the lines of an attachment start the same way. The "type" key can
// come after a very long message, so it is not looked for here: parse() and the checks on the result do that.
const isChatLine = (line) => line.startsWith('{"parentUuid"') && !line.slice(0, 400).includes('"attachment":');

// The question inside the prompt that app.js builds, for a title.
function questionOf(text) {
  if (!text.startsWith(ASK_PREFIX)) return text;
  const at = text.lastIndexOf('\nคำถาม: ');
  return at >= 0 ? text.slice(at + 8) : text;
}

async function summarize(dir, name) {
  const file = join(dir, name);
  const st = await stat(file);
  const headSize = Math.min(st.size, 200_000);
  const head = (await readSlice(file, 0, headSize)).split('\n');
  if (headSize < st.size) head.pop(); // the last line was cut
  let first = '';
  let customTitle = '';
  for (const line of head) {
    if (line.startsWith('{"type":"custom-title"')) customTitle = parse(line)?.customTitle ?? customTitle;
    if (first || !line.startsWith('{') || !isChatLine(line)) continue;
    const j = parse(line);
    first = j ? userTextOf(j) : '';
  }
  const tailStart = Math.max(0, st.size - 300_000);
  const tail = (await readSlice(file, tailStart, st.size - tailStart)).split('\n');
  if (tailStart > 0) tail.shift();
  let aiTitle = '';
  let named = ''; // the last name in the tail wins over one from the head: the owner may have renamed the session since
  for (let i = tail.length - 1; i >= 0 && !(aiTitle && named); i--) {
    const line = tail[i];
    if (!aiTitle && line.startsWith('{"type":"ai-title"')) aiTitle = parse(line)?.aiTitle ?? '';
    else if (!named && line.startsWith('{"type":"custom-title"')) named = parse(line)?.customTitle ?? '';
  }
  customTitle = named || customTitle;
  const ask = first.startsWith(ASK_PREFIX);
  const title = (customTitle || (ask ? questionOf(first) : aiTitle || first) || '(ไม่มีชื่อ)').replace(/\s+/g, ' ').trim().slice(0, 140);
  return { id: name.slice(0, -6), title, mtime: st.mtimeMs, size: st.size, ask, recent: Date.now() - st.mtimeMs < RECENT_MS };
}

async function listSessions(cwd) {
  const dir = await projectDir(cwd);
  if (!dir) return [];
  const names = (await readdir(dir)).filter((n) => n.endsWith('.jsonl') && UUID.test(n.slice(0, -6)));
  const rows = await Promise.all(names.map((n) => summarize(dir, n).catch(() => null)));
  return rows.filter(Boolean).sort((a, b) => b.mtime - a.mtime).slice(0, MAX_SESSIONS);
}

// A short line for the tool that Claude is using, so the page can show "reading X".
function describeTool(block, cwd) {
  const input = block?.input ?? {};
  let pick = String(input.file_path ?? input.path ?? input.pattern ?? input.command ?? input.description ?? input.url ?? input.query ?? '');
  // show a file as the path from the repo root, with forward slashes
  const root = cwd.replace(/\\/g, '/').replace(/\/?$/, '/');
  pick = pick.replace(/\\/g, '/');
  if (root.length > 1 && pick.toLowerCase().startsWith(root.toLowerCase())) pick = pick.slice(root.length);
  let raw = '';
  try {
    raw = JSON.stringify(input, null, 2).slice(0, 1500);
  } catch {
    /* an input that cannot be shown */
  }
  return { id: String(block?.id ?? ''), name: String(block?.name ?? ''), detail: pick.replace(/\s+/g, ' ').slice(0, 200), input: raw };
}

const resultText = (content) => textOfContent(content).slice(0, RESULT_LIMIT);

// The last messages of a session, in the shape the page draws: { role: 'user', text } and { role: 'assistant', parts },
// where a part is { type: 'text', text } or { type: 'tool', id, name, detail, input, result, isError }. Only the end of the
// file is read: a session of a long day can be tens of megabytes.
async function loadSession(cwd, id) {
  const dir = await projectDir(cwd);
  const file = dir && UUID.test(id) ? join(dir, `${id}.jsonl`) : '';
  let st;
  try {
    st = file ? await stat(file) : null;
  } catch {
    st = null;
  }
  if (!st) return null;
  let window = 4_000_000;
  let built;
  let start = 0;
  for (;;) {
    start = Math.max(0, st.size - window);
    const lines = (await readSlice(file, start, st.size - start)).split('\n');
    if (start > 0) lines.shift();
    built = buildMessages(lines, cwd);
    if (built.messages.length >= 30 || start === 0 || window >= 16_000_000) break;
    window *= 2;
  }
  const first = built.firstUser;
  const title = (await summarize(dir, `${id}.jsonl`).catch(() => null))?.title ?? '';
  return { title, messages: built.messages.slice(-MAX_HISTORY), truncated: built.messages.length > MAX_HISTORY || start > 0, ask: first.startsWith(ASK_PREFIX), size: st.size };
}

function buildMessages(lines, cwd) {
  const messages = [];
  const tools = new Map(); // tool_use id -> the part that shows it
  let reply = null;
  let firstUser = '';
  for (const line of lines) {
    if (!line.startsWith('{') || !isChatLine(line)) continue;
    const j = parse(line);
    if (!j || j.isSidechain) continue;
    if (j.type === 'user') {
      const c = j.message?.content;
      if (Array.isArray(c)) {
        for (const b of c) {
          if (b?.type !== 'tool_result') continue;
          const part = tools.get(b.tool_use_id);
          if (part) Object.assign(part, { result: resultText(b.content), isError: b.is_error === true });
        }
      }
      const text = userTextOf(j);
      if (text) {
        firstUser ||= text;
        messages.push({ role: 'user', text: text.slice(0, 8000) });
        reply = null;
      }
    } else if (j.type === 'assistant') {
      const c = j.message?.content;
      if (!Array.isArray(c)) continue;
      for (const b of c) {
        if (b?.type === 'text' && b.text?.trim()) {
          if (!reply) messages.push((reply = { role: 'assistant', parts: [], state: 'done' }));
          reply.parts.push({ type: 'text', text: b.text });
        } else if (b?.type === 'tool_use') {
          if (!reply) messages.push((reply = { role: 'assistant', parts: [], state: 'done' }));
          const part = { type: 'tool', ...describeTool(b, cwd), result: null, isError: false };
          tools.set(b.id, part);
          reply.parts.push(part);
        }
      }
    }
  }
  return { messages, firstUser };
}

// Renaming a session is what /rename of Claude Code does: it appends a custom-title line (and an agent-name line) to the
// session file. Nothing already in the file is changed. A session that is open in another program may write its old name
// again on its next turn, which is why the page warns about a session that was used a moment ago.
async function renameSession(cwd, id, title) {
  const dir = await projectDir(cwd);
  const file = dir && UUID.test(id) ? join(dir, `${id}.jsonl`) : '';
  let st;
  try {
    st = file ? await stat(file) : null;
  } catch {
    st = null;
  }
  if (!st) return { missing: true };
  const NL = String.fromCharCode(10);
  const last = st.size > 0 ? await readSlice(file, st.size - 1, 1) : NL;
  const lines = [{ type: 'custom-title', sessionId: id, customTitle: title }, { type: 'agent-name', agentName: title, sessionId: id }];
  await appendFile(file, (last === NL ? '' : NL) + lines.map((l) => JSON.stringify(l)).join(NL) + NL, 'utf8');
  return { ok: true, recent: Date.now() - st.mtimeMs < RECENT_MS };
}

export default function gardenAsk() {
  let cwd = '';
  let allowed = true;
  const running = new Map(); // request id -> child process

  return {
    name: 'garden-ask',
    hooks: {
      'astro:config:setup': ({ command, config, addDevToolbarApp }) => {
        if (command !== 'dev') return;
        cwd = fileURLToPath(new URL('..', config.root)); // the repo root, so Claude can read subjects/ as well as site/
        addDevToolbarApp({ id: 'garden:ask', name: 'Ask', icon: ICON, entrypoint: new URL('./app.js', import.meta.url) });
      },
      'astro:server:setup': ({ server, toolbar }) => {
        const host = server.config.server.host;
        if (host && !LOCAL_HOSTS.has(String(host))) {
          allowed = false;
          console.warn(`[garden-ask] switched off: the dev server listens on ${host}, and Ask would let anyone on the network start Claude.`);
        }
        const out = (id, payload) => toolbar.send(EVENT.out, { ...payload, id }); // the request id always wins

        toolbar.on(EVENT.hello, () => {
          toolbar.send(EVENT.ready, allowed ? { ok: true } : { ok: false, reason: 'dev server เปิดให้เครื่องอื่นในเครือข่ายเข้าถึงได้ (--host) จึงปิด Ask ไว้' });
        });

        toolbar.on(EVENT.list, async () => {
          if (!allowed) return toolbar.send(EVENT.listed, { sessions: [] });
          try {
            toolbar.send(EVENT.listed, { sessions: await listSessions(cwd) });
          } catch (e) {
            toolbar.send(EVENT.listed, { sessions: [], error: String(e.message ?? e).slice(0, 300) });
          }
        });

        toolbar.on(EVENT.open, async (p) => {
          const session = typeof p?.session === 'string' && UUID.test(p.session) ? p.session : '';
          if (!allowed || !session) return toolbar.send(EVENT.opened, { session, error: 'bad request' });
          try {
            const data = await loadSession(cwd, session);
            toolbar.send(EVENT.opened, data ? { session, ...data } : { session, missing: true });
          } catch (e) {
            toolbar.send(EVENT.opened, { session, error: String(e.message ?? e).slice(0, 300) });
          }
        });

        toolbar.on(EVENT.rename, async (p) => {
          const session = typeof p?.session === 'string' && UUID.test(p.session) ? p.session : '';
          const title = typeof p?.title === 'string' ? [...p.title].map((c) => (c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127 ? ' ' : c)).join('').replace(/\s+/g, ' ').trim().slice(0, 100) : '';
          if (!allowed || !session || !title) return toolbar.send(EVENT.renamed, { session, error: 'ชื่อว่างหรือคำขอไม่ถูกต้อง' });
          try {
            const r = await renameSession(cwd, session, title);
            toolbar.send(EVENT.renamed, r.ok ? { session, title, recent: r.recent } : { session, error: 'ไม่พบไฟล์ของเซสชันนี้' });
          } catch (e) {
            toolbar.send(EVENT.renamed, { session, error: String(e.message ?? e).slice(0, 300) });
          }
        });

        toolbar.on(EVENT.cancel, (p) => {
          const child = running.get(p?.id);
          if (child) child.kill();
        });

        toolbar.on(EVENT.send, (p) => {
          const id = typeof p?.id === 'string' && REQUEST_ID.test(p.id) ? p.id : '';
          if (!id) return;
          if (!allowed) return out(id, { kind: 'error', message: 'Ask ปิดอยู่ เพราะ dev server เปิดให้เครื่องอื่นเข้าถึงได้' });
          const session = typeof p.session === 'string' && UUID.test(p.session) ? p.session : '';
          const prompt = typeof p.prompt === 'string' ? p.prompt.slice(0, MAX_PROMPT) : '';
          const model = typeof p.model === 'string' && MODEL.test(p.model) ? p.model : '';
          if (!session || !prompt.trim()) return out(id, { kind: 'error', message: 'คำขอไม่ครบ' });
          if (running.has(id) || running.size >= MAX_RUNNING) return out(id, { kind: 'error', message: 'กำลังตอบคำถามอื่นอยู่ รอให้จบก่อน' });
          run({ id, session, prompt, model, resume: p.resume === true });
        });

        // One run of `claude -p`. A resume of a session that is gone is started again as a new session with that id.
        function run({ id, session, prompt, model, resume }) {
          const args = [
            '-p',
            '--output-format', 'stream-json',
            '--include-partial-messages',
            '--verbose',
            '--tools', TOOLS,
            '--strict-mcp-config',
            '--disable-slash-commands',
            '--append-system-prompt', SYSTEM_PROMPT,
            ...(model ? ['--model', model] : []),
            resume ? '--resume' : '--session-id', session,
          ];
          let child;
          try {
            child = spawn('claude', args, { cwd, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
          } catch (e) {
            return out(id, { kind: 'error', message: `เปิดโปรแกรม claude ไม่ได้: ${e.message}` });
          }
          running.set(id, child);
          const timer = setTimeout(() => child.kill(), TIME_LIMIT_MS);
          let buffer = '';
          let errText = '';
          let finished = false;
          let sawText = false;

          const finish = (payload) => {
            if (finished) return;
            finished = true;
            out(id, payload);
          };
          const handle = (line) => {
            const j = parse(line);
            if (!j) return;
            if (j.type === 'system' && j.subtype === 'init') {
              out(id, { kind: 'init', model: String(j.model ?? ''), auth: j.apiKeySource === 'none' ? 'login' : String(j.apiKeySource ?? '') });
            } else if (j.type === 'stream_event') {
              const d = j.event?.delta;
              if (j.event?.type === 'message_start') out(id, { kind: 'turn' }); // a new message of Claude, for example after a tool
              else if (j.event?.type === 'content_block_delta' && d?.type === 'text_delta' && d.text) {
                sawText = true;
                out(id, { kind: 'delta', text: d.text });
              }
            } else if (j.type === 'assistant') {
              for (const block of j.message?.content ?? []) if (block.type === 'tool_use') {
                const t = describeTool(block, cwd);
                out(id, { kind: 'tool', toolId: t.id, name: t.name, detail: t.detail, input: t.input });
              }
            } else if (j.type === 'user') {
              for (const b of Array.isArray(j.message?.content) ? j.message.content : []) {
                if (b?.type === 'tool_result') out(id, { kind: 'toolresult', toolId: String(b.tool_use_id ?? ''), text: resultText(b.content), isError: b.is_error === true });
              }
            } else if (j.type === 'result') {
              const message = String(j.result ?? '');
              if (j.is_error && resume && /no conversation found/i.test(message)) errText += message; // run() starts it again below
              else if (j.is_error) finish({ kind: 'error', message: (message || 'Claude ตอบไม่สำเร็จ').slice(0, 1200) });
              else finish({ kind: 'done', text: message, costUsd: Number(j.total_cost_usd) || 0 });
            }
          };

          child.stdout.setEncoding('utf8');
          child.stdout.on('data', (chunk) => {
            buffer += chunk;
            let nl;
            while ((nl = buffer.indexOf('\n')) >= 0) {
              const line = buffer.slice(0, nl).trim();
              buffer = buffer.slice(nl + 1);
              if (line) handle(line);
            }
          });
          child.stderr.setEncoding('utf8');
          child.stderr.on('data', (c) => (errText = (errText + c).slice(-3000)));
          child.on('error', (e) => {
            clearTimeout(timer);
            running.delete(id);
            finish({ kind: 'error', message: e.code === 'ENOENT' ? 'หาโปรแกรม claude ไม่เจอ ติดตั้ง Claude Code และล็อกอินก่อน แล้วเปิด dev server ใหม่' : `เรียก claude ไม่สำเร็จ: ${e.message}` });
          });
          child.on('close', (code, signal) => {
            clearTimeout(timer);
            running.delete(id);
            if (buffer.trim()) handle(buffer.trim());
            if (finished) return;
            if (resume && !sawText && /no conversation found/i.test(errText)) return run({ id, session, prompt, model, resume: false });
            if (signal) return finish({ kind: 'error', message: 'หยุดแล้ว' });
            finish({ kind: 'error', message: (errText.trim() || `claude จบด้วย code ${code} โดยไม่มีคำตอบ`).slice(-1200) });
          });
          child.stdin.on('error', () => {});
          child.stdin.end(prompt);
        }
      },
      'astro:server:done': () => {
        for (const child of running.values()) child.kill();
        running.clear();
      },
    },
  };
}
