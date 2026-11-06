// @ts-check
import { defineConfig } from 'astro/config';
import { access, readFile, writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

import react from '@astrojs/react';
import mdx from '@astrojs/mdx';

// Dev only (`astro dev`): the View | Edit switch on a lesson page reads and writes that lesson's .mdx file through
// /__edit. It is never part of a build. Safeguards:
//   - loopback host only, and a custom header that a cross-site form cannot send;
//   - only .mdx files under src/content;
//   - a save is refused when the text does not compile, and rolled back when the page then fails to render,
//     so a broken page never stays on disk.
function devEditor() {
  let root = '';
  const LOCAL = new Set(['localhost', '127.0.0.1', '[::1]']);
  const sleep = (/** @type {number} */ ms) => new Promise((r) => setTimeout(r, ms));
  // eslint-disable-next-line no-control-regex
  const plain = (/** @type {unknown} */ e) => String(e instanceof Error ? e.message : e).replace(/\u001b\[[0-9;]*m/g, '').trim().slice(0, 600);

  return {
    name: 'garden-dev-editor',
    apply: /** @type {'serve'} */ ('serve'),
    configResolved(/** @type {{ root: string }} */ config) {
      root = config.root;
    },
    configureServer(/** @type {import('vite').ViteDevServer} */ server) {
      // Run the text through the same plugins that compile the page, without writing it.
      // Call the compile step of Astro's own MDX plugin directly (the same code that builds the page), without the other
      // Vite plugins, so nothing is written and nothing else can interfere. If the plugin cannot be found the check is
      // skipped, and the render check below still protects the page.
      async function compileError(/** @type {string} */ abs, /** @type {string} */ text) {
        const plugin = /** @type {any} */ (server.config.plugins.find((p) => p.name === '@mdx-js/rolldown'));
        const handler = typeof plugin?.transform === 'function' ? plugin.transform : plugin?.transform?.handler;
        if (!handler) return null;
        try {
          await handler.call({}, text, abs);
          return null;
        } catch (e) {
          const loc = /** @type {any} */ (e)?.loc;
          const at = loc?.line ? ` (line ${loc.line}${loc.column ? `, column ${loc.column}` : ''})` : '';
          return plain(e) + at;
        }
      }

      // The frontmatter must pass the schema of src/content.config.ts (loaded from that file, not copied) and every slug in
      // `requires` must be a lesson that exists. The dev server keeps serving the page when this is wrong, but the next
      // start of `astro dev` and `npm run build` fail, so it is refused here.
      async function frontmatterError(/** @type {string} */ abs, /** @type {string} */ text) {
        const m = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
        if (!m) return 'the file must start with a frontmatter block between two --- lines';
        let data;
        try {
          const { parse } = await import('yaml');
          data = parse(m[1]);
        } catch (e) {
          return `the frontmatter is not valid YAML: ${plain(e)}`;
        }
        try {
          const mod = await server.ssrLoadModule('/src/content.config.ts');
          const english = abs.includes(`${sep}lessons-en${sep}`);
          const collection = /** @type {any} */ (mod).collections?.[english ? 'lessonsEn' : 'lessons'];
          const schema = typeof collection?.schema === 'function' ? collection.schema({ image: () => ({}) }) : collection?.schema;
          if (schema) {
            const result = schema.safeParse(data);
            if (!result.success) {
              return `the frontmatter does not match the schema: ${result.error.issues.map((/** @type {any} */ i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ')}`;
            }
            data = result.data;
          }
        } catch (e) {
          return `could not check the frontmatter against the schema: ${plain(e)}`;
        }
        const requires = Array.isArray(data?.requires) ? data.requires : [];
        if (requires.length) {
          const rel = abs.slice(resolve(root, 'src/content').length + 1).split(sep);
          const dir = resolve(root, 'src/content', rel[0], rel[1]);
          for (const slug of requires) {
            const found = await Promise.any([access(resolve(dir, `${slug}.mdx`)), access(resolve(dir, slug, 'index.mdx'))]).then(
              () => true,
              () => false,
            );
            if (!found) return `requires lists "${slug}", which is not a lesson of this subject`;
          }
        }
        return null;
      }

      async function getPage(/** @type {string} */ host, /** @type {string} */ page) {
        try {
          const r = await fetch(`http://${host}${page}`, { redirect: 'manual' });
          const body = await r.text();
          // A page is sent as a stream. When something fails halfway the status is already 200 and the page just stops,
          // so a healthy page is one that status 200 AND ends with </html>.
          return { status: r.status, body, complete: /<\/html>\s*$/i.test(body) };
        } catch (e) {
          return { status: 0, body: plain(e), complete: false };
        }
      }
      // The words a reader sees. Attributes of the React islands change on every request, so whole bodies cannot be compared.
      const visibleText = (/** @type {string} */ body) => body.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const pageProblem = (/** @type {{ status: number; body: string; complete: boolean }} */ r) => {
        if (r.status === 200 && !r.complete) return 'the page stopped rendering halfway (the text probably uses something that does not exist, such as a variable or a component that is not imported)';
        const text = visibleText(r.body);
        return `the page answered with status ${r.status}${text ? `: ${text.slice(0, 300)}` : ''}`;
      };

      // Writing the file makes the dev server tell every browser tab to reload, and a page that fails for a moment makes
      // it pop up its error overlay over the editor. While the editor saves, that would cut the page off before it hears
      // whether the save was good, so full-reload and error messages are held back during a save and for a moment after
      // it. The editor shows the problem itself, and reloads the page itself when the learner presses View.
      let quietUntil = 0;
      const hush = (/** @type {any} */ channel) => {
        if (!channel || typeof channel.send !== 'function' || channel.__gardenHushed) return;
        const send = channel.send.bind(channel);
        channel.send = (/** @type {any[]} */ ...args) => {
          const payload = args[0];
          if (Date.now() < quietUntil && payload && typeof payload === 'object' && (payload.type === 'full-reload' || payload.type === 'error')) return;
          return send(...args);
        };
        channel.__gardenHushed = true;
      };
      hush(server.ws);
      hush(/** @type {any} */ (server).hot);
      for (const env of Object.values(/** @type {any} */ (server).environments ?? {})) hush(/** @type {any} */ (env).hot);

      server.middlewares.use('/__edit', async (req, res) => {
        const send = (/** @type {number} */ code, /** @type {object} */ body) => {
          res.statusCode = code;
          res.setHeader('content-type', 'application/json; charset=utf-8');
          res.end(JSON.stringify(body));
        };
        try {
          const hostHeader = req.headers.host ?? '';
          if (!LOCAL.has(hostHeader.replace(/:\d+$/, '')) || req.headers['x-garden-edit'] !== '1') return send(403, { ok: false, error: 'forbidden' });

          const allowed = resolve(root, 'src/content') + sep;
          const pick = (/** @type {unknown} */ file) => {
            if (typeof file !== 'string') return null;
            const abs = resolve(root, file);
            return abs.startsWith(allowed) && abs.endsWith('.mdx') ? abs : null;
          };

          if (req.method === 'GET') {
            const q = new URL(req.url ?? '/', 'http://localhost').searchParams;
            const abs = pick(q.get('file'));
            if (!abs) return send(400, { ok: false, error: 'bad file' });
            return send(200, { ok: true, text: await readFile(abs, 'utf8') });
          }

          if (req.method === 'POST') {
            const chunks = [];
            let size = 0;
            for await (const c of req) {
              size += c.length;
              if (size > 2_000_000) return send(413, { ok: false, error: 'too large' });
              chunks.push(c);
            }
            const { file, text, page } = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            const abs = pick(file);
            if (!abs || typeof text !== 'string' || typeof page !== 'string' || !page.startsWith('/') || page.startsWith('//')) return send(400, { ok: false, error: 'bad request' });

            const previous = await readFile(abs, 'utf8');
            if (previous === text) return send(200, { ok: true, unchanged: true });

            // 1. Does it compile? Nothing is written if not.
            const bad = await compileError(abs, text);
            if (bad) return send(422, { ok: false, stage: 'compile', error: bad });
            const badFront = await frontmatterError(abs, text);
            if (badFront) return send(422, { ok: false, stage: 'frontmatter', error: badFront });

            // 2. Write it, then watch the page until it has changed or fails. A failing page rolls the file back.
            quietUntil = Date.now() + 60_000;
            try {
              const before = await getPage(hostHeader, page);
              await writeFile(abs, text, 'utf8');
              let problem = null;
              const wasText = visibleText(before.body);
              for (let i = 0; i < 17; i++) {
                await sleep(300);
                const now = await getPage(hostHeader, page);
                if (now.status !== 200 || !now.complete) {
                  problem = pageProblem(now);
                  break;
                }
                // The new text is on the page and the page is whole: it rendered. (A change that adds no visible words,
                // such as a comment, waits out the loop and passes.)
                if (before.status === 200 && visibleText(now.body) !== wasText) break;
              }
              if (problem) {
                await writeFile(abs, previous, 'utf8');
                return send(422, { ok: false, stage: 'render', error: problem });
              }
              return send(200, { ok: true });
            } finally {
              // the file watcher reports our writes a little later: keep holding reloads back until those have passed
              quietUntil = Date.now() + 3000;
            }
          }
          return send(405, { ok: false, error: 'method not allowed' });
        } catch (e) {
          return send(500, { ok: false, error: plain(e) });
        }
      });
    },
  };
}

// On GitHub Pages the site lives at https://<owner>.github.io/<repo>/, so the workflow sets
// SITE_URL and BASE_PATH. Locally both are unset and the site is served from the root.
// https://astro.build/config
export default defineConfig({
  site: process.env.SITE_URL,
  base: process.env.BASE_PATH,
  integrations: [react(), mdx()],
  vite: { plugins: [devEditor()] },
});
