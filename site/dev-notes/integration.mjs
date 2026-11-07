// Dev only (`astro dev`, never part of a build): the "Notes" app of the Astro dev toolbar.
//
// The learner points at a part of a page, writes what is wrong, and the note is saved to <repo>/.audit/comments.json
// (git-ignored: the repo is public). Claude reads that file when asked to audit the site and answers in `replies`.
// The browser half is app.js, this file is the server half: it keeps the file and broadcasts the full list after
// every change, so the page never holds state that the file does not have.
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const EVENT = {
  list: 'garden:notes:list',
  add: 'garden:notes:add',
  patch: 'garden:notes:patch',
  remove: 'garden:notes:remove',
  all: 'garden:notes:all',
};
const CATEGORIES = new Set(['fact', 'wording', 'layout', 'lab', 'idea']);
const ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"><path d="M3 4.5A1.5 1.5 0 0 1 4.5 3h11A1.5 1.5 0 0 1 17 4.5v7a1.5 1.5 0 0 1-1.5 1.5H9l-3.5 3v-3h-1A1.5 1.5 0 0 1 3 11.5v-7Z"/></svg>';

const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
const num = (v) => (Number.isFinite(v) ? v : 0);

// Only known fields are kept, each with a length limit: the payload comes from a web socket, not from trusted code.
function cleanTarget(t = {}) {
  return {
    kind: t.kind === 'text' ? 'text' : 'element',
    quote: str(t.quote, 600),
    prefix: str(t.prefix, 80),
    suffix: str(t.suffix, 80),
    tag: str(t.tag, 40),
    selector: str(t.selector, 600),
    label: str(t.label, 160),
    snippet: str(t.snippet, 200),
    component: str(t.component, 300),
    astroFile: str(t.astroFile, 400),
    astroLoc: str(t.astroLoc, 40),
  };
}

function cleanContext(c = {}) {
  const v = c.viewport ?? {};
  return {
    viewport: { w: num(v.w), h: num(v.h) },
    theme: str(c.theme, 20),
    lang: str(c.lang, 10),
    view: str(c.view, 20),
    step: num(c.step),
    sourceFile: str(c.sourceFile, 300),
  };
}

export default function gardenNotes() {
  let file = '';
  let queue = Promise.resolve();

  async function read() {
    try {
      const data = JSON.parse(await readFile(file, 'utf8'));
      return Array.isArray(data.comments) ? data.comments : [];
    } catch {
      return [];
    }
  }

  async function write(comments) {
    await mkdir(dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    await writeFile(tmp, JSON.stringify({ version: 1, comments }, null, 2) + '\n', 'utf8');
    await rename(tmp, file);
  }

  // One change at a time, each reading the file fresh (Claude may have edited it since the last change).
  const change = (fn) => {
    queue = queue.then(fn).catch((e) => console.error('[garden-notes]', e));
    return queue;
  };

  return {
    name: 'garden-notes',
    hooks: {
      'astro:config:setup': ({ command, config, addDevToolbarApp }) => {
        if (command !== 'dev') return;
        file = fileURLToPath(new URL('../.audit/comments.json', config.root));
        addDevToolbarApp({ id: 'garden:notes', name: 'Notes', icon: ICON, entrypoint: new URL('./app.js', import.meta.url) });
      },
      'astro:server:setup': ({ toolbar }) => {
        const broadcast = (comments) => toolbar.send(EVENT.all, { comments });

        toolbar.on(EVENT.list, () => change(async () => broadcast(await read())));

        toolbar.on(EVENT.add, (p) =>
          change(async () => {
            const c = p?.comment;
            const text = str(c?.text, 4000).trim();
            if (!text || typeof c?.path !== 'string') return;
            const comments = await read();
            comments.push({
              id: randomUUID().slice(0, 8),
              path: str(c.path, 300),
              createdAt: new Date().toISOString(),
              status: 'open',
              category: CATEGORIES.has(c.category) ? c.category : 'idea',
              text,
              target: cleanTarget(c.target),
              context: cleanContext(c.context),
              replies: [],
            });
            await write(comments);
            broadcast(comments);
          }),
        );

        toolbar.on(EVENT.patch, (p) =>
          change(async () => {
            const comments = await read();
            const c = comments.find((x) => x.id === p?.id);
            if (!c) return broadcast(comments);
            if (p.status === 'open' || p.status === 'resolved') c.status = p.status;
            const reply = str(p.reply, 4000).trim();
            if (reply) {
              c.replies ??= [];
              c.replies.push({ by: 'you', at: new Date().toISOString(), text: reply });
            }
            await write(comments);
            broadcast(comments);
          }),
        );

        toolbar.on(EVENT.remove, (p) =>
          change(async () => {
            const comments = (await read()).filter((x) => x.id !== p?.id);
            await write(comments);
            broadcast(comments);
          }),
        );
      },
    },
  };
}
