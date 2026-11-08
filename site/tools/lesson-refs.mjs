// Finds references to other lessons that are not links ("บทที่ 5", "บท 3", "lesson 4", "Lessons 2 and 3") and, with --fix, turns them
// into links to that lesson. A reference in running text, a table, a list or a quiz prop becomes [บทที่ 5](/spark/execution-model/).
//
//   node tools/lesson-refs.mjs            list what is not linked, and links that point nowhere (exit code 1 when there is any)
//   node tools/lesson-refs.mjs --fix      link every reference it can, then list the rest
//   node tools/lesson-refs.mjs --fix --dry-run   show what --fix would change without writing
//
// What counts as a lesson number is the `order` of a subject's main page, as CLAUDE.md says. The tool leaves alone:
//   - code blocks, inline code, text that is already a link, and HTML or JSX tags;
//   - a reference to a book chapter in Data Quality (the words DMBOK2, DQF, Ten Steps, Governance, FoDE, DDIA, DAMA, Medallion,
//     Contracts or "book" just before it, or the word "page" just after it);
//   - a line that holds `ref-ok` (write `{/* ref-ok */}` at the end of the line when the tool is wrong);
//   - headings and frontmatter, which it only reports.
// A reference that names another subject ("GX บทที่ 4", "lesson 3 of pytest") is linked to that subject.
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import GithubSlugger from 'github-slugger';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT = join(ROOT, 'src', 'content');
const args = new Set(process.argv.slice(2));
const FIX = args.has('--fix');
const DRY = args.has('--dry-run');
const WHY = args.has('--why');
const argv = process.argv.slice(2);
const BACKLINKS = argv.includes('--backlinks') ? argv[argv.indexOf('--backlinks') + 1] ?? '' : null;
const GRAPH = args.has('--graph');

// a book's name right before the number ("Ten Steps บทที่ 3", "หนังสือ: DDIA บทที่ 13", "book: DDIA chapter 13"), with no comma, full stop or
// bracket between them
const BOOK_JUST_BEFORE = /(?:DMBOK2|DQF|Ten Steps|Governance|FoDE|DDIA|DAMA|Medallion|Contracts|หนังสือ|\bbook)[^,;.()\n]{0,16}$/i;
const ALIASES = [
  [/great[ -]expectations|\bGX\b/i, 'great-expectations'],
  [/\bspark\b/i, 'spark'],
  [/\bpytest\b/i, 'pytest'],
  [/\bpydantic\b/i, 'pydantic'],
  [/data[ -]quality/i, 'data-quality'],
  [/music[ -]theory|ทฤษฎีดนตรี/i, 'music-theory'],
  [/\bguitar\b|กีต้าร์/i, 'guitar'],
];

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (f.endsWith('.mdx')) out.push(p);
  }
  return out;
}

// subject -> Map(order -> slug) and the set of every route (Thai and English)
const orders = {};
const routes = new Set();
// "<prefix>/<subject>" -> Map(lower case title -> route, or null when two pages share it); "<route of a lesson>" -> its sub-pages
const titlesOf = {};
const subPagesOf = {};
const everyTitle = { th: new Map(), en: new Map() };
// route -> the ids of its headings, made the way the built page makes them (github-slugger over the text of each ## to ###### line)
const idsOf = new Map();
function headingIds(text) {
  const slugger = new GithubSlugger();
  const ids = new Set();
  const lines = text.split(/\r?\n/);
  let front = lines[0] === '---';
  let fence = false;
  lines.forEach((l, i) => {
    if (front) {
      if (i > 0 && l === '---') front = false;
      return;
    }
    if (/^\s*```/.test(l)) fence = !fence;
    if (fence) return;
    const m = /^#{2,6}\s+(.*?)\s*#*\s*$/.exec(l);
    if (!m) return;
    const plain = m[1]
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/`([^`]*)`/g, '$1')
      .replace(/<[^>]+>/g, '')
      .replace(/\*\*/g, '')
      // the typography of the build: __x__ is strong text, and smartypants turns --- and -- into dashes, which the slug then drops
      .replace(/__([^_]+)__/g, '$1')
      .replace(/---/g, '\u2014')
      .replace(/--/g, '\u2013');
    ids.add(slugger.slug(plain));
  });
  return ids;
}
const titleOf = (text) => {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  const t = m && /^title:\s*(.+?)\s*$/m.exec(m[1]);
  return t ? t[1].replace(/^(["'])(.*)\1$/, '$2').trim() : '';
};
for (const coll of ['lessons', 'lessons-en']) {
  const dir = join(CONTENT, coll);
  if (!existsSync(dir)) continue;
  const prefix = coll === 'lessons-en' ? '/en' : '';
  for (const file of walk(dir)) {
    const rel = relative(dir, file).split(sep);
    const subject = rel[0];
    const isIndex = rel[rel.length - 1] === 'index.mdx';
    const slug = rel[1].replace(/\.mdx$/, '');
    const text = readFileSync(file, 'utf8');
    const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
    const title = titleOf(text).toLowerCase();
    const addTitle = (route) => {
      const map = (titlesOf[`${prefix}/${subject}`] ??= new Map());
      if (title) map.set(title, map.has(title) ? null : route);
      // for the lookup across subjects: a title used by two pages is ambiguous and links nowhere
      const all = everyTitle[coll === 'lessons-en' ? 'en' : 'th'];
      if (title) all.set(title, all.has(title) ? null : route);
    };
    if (rel.length === 2 || (rel.length === 3 && isIndex)) {
      routes.add(`${prefix}/${subject}/${slug}/`);
      idsOf.set(`${prefix}/${subject}/${slug}/`, headingIds(text));
      addTitle(`${prefix}/${subject}/${slug}/`);
      const o = m && /^order:\s*(\d+)/m.exec(m[1]);
      if (o && coll === 'lessons') (orders[subject] ??= new Map()).set(Number(o[1]), slug);
    } else if (rel.length === 3) {
      const route = `${prefix}/${subject}/${slug}/${rel[2].replace(/\.mdx$/, '')}/`;
      routes.add(route);
      idsOf.set(route, headingIds(text));
      addTitle(route);
      const subs = (subPagesOf[`${prefix}/${subject}/${slug}/`] ??= new Map());
      if (title) subs.set(title, route);
    }
  }
}

const urlOf = (subject, order, en) => {
  const slug = orders[subject]?.get(order);
  return slug ? `${en ? '/en' : ''}/${subject}/${slug}/` : null;
};

// a reference and the numbers chained to it: "บทที่ 5", "บทที่ 5 และ 7", "lessons 2 to 4"
// and, after it, the title of one of that lesson's pages in quotes: lesson 5, page "Walking the folders"
const REF = /(บทที่|บท|\b[Ll]essons?\b|\b[Cc]hapters?\b)(\s*)(\d+)((?:\s*(?:และ|ถึง|กับ|หรือ|,|and|to|or|-|–)\s*\d+)*)(?![\d.]\d)((?:,?\s*(?:หน้า|page)\s*[“"]([^”"\n]{2,100})[”"])?)/g;
// a page of the same subject named by its title in quotes: the page "Reasonability", หน้า "ความสมเหตุสมผล"
const TITLE_BEFORE = /((?:ในหน้า|หน้าย่อย|หน้า|บทเรื่อง|บท|\bpages?|\blessons?|\bthe)\s*)(["“'‘])([^"”'’\n]{3,100})(["”'’])/g;
const TITLE_AFTER = /(["“'‘])([^"”'’\n]{3,100})(["”'’])(\s*(?:หน้า|บท|\bpage\b|\blesson\b))/g;
const NUM = /(\s*(?:และ|ถึง|กับ|หรือ|,|and|to|or|-|–)\s*)(\d+)/g;
const TOKEN = /(\[[^\]]*\]\([^)]*\)|`[^`]*`|<\/?[A-Za-z][^>]*>)/;
// inside the props of a <Question> the text is a string, not Markdown, so a tag is not a thing to skip there
const TOKEN_PROPS = /(\[[^\]]*\]\([^)]*\)|`[^`]*`|options=\{\[[^\n]*?\]\}|\bcode="[^"]*")/;

function subjectNear(before, after, current) {
  const near = before.slice(-24);
  for (const [rx, id] of ALIASES) {
    if (id === current) continue;
    const b = new RegExp(`(?:${rx.source})\\s*$`, rx.flags).test(near);
    const a = new RegExp(`^\\s*(?:ของ|ใน|of|in|from)\\s+(?:${rx.source})`, rx.flags).test(after.slice(0, 40));
    if (b || a) return id;
  }
  return current;
}

const plainRx = new Map();
function plainTitleRx(ctx, pages) {
  const key = `${ctx.en ? 'en' : 'th'}/${ctx.subject}`;
  if (!plainRx.has(key)) {
    const titles = [...pages.keys()].filter((t) => t.length >= 5).sort((a, b) => b.length - a.length);
    const alt = titles.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    plainRx.set(key, new RegExp(`((?:ในหน้า|หน้าย่อย|หน้า|บทเรื่อง|บท|\\bpages?|\\blessons?)\\s+(?:(?:on|about|called|named|titled|เรื่อง)\\s+)?)(${alt})(?![\\w\\u0E00-\\u0E7F])`, 'gi'));
  }
  const rx = plainRx.get(key);
  rx.lastIndex = 0;
  return rx;
}

function linkLine(text, ctx) {
  // ctx: { subject, en, lineBase } ; returns { text, linked, left: [..] }
  const left = [];
  let linked = 0;
  const parts = text.split(ctx.inProps ? TOKEN_PROPS : TOKEN);
  for (let i = 1; i < parts.length; i += 2) {
    REF.lastIndex = 0;
    if (!ctx.inProps && parts[i].startsWith('<') && REF.test(parts[i])) left.push(`${parts[i].slice(0, 70)} (inside a tag: a link is not rendered there)`);
  }
  for (let i = 0; i < parts.length; i += 2) {
    const seg = parts[i];
    if (!seg) continue;
    let out = '';
    let last = 0;
    REF.lastIndex = 0;
    let m;
    while ((m = REF.exec(seg))) {
      const before = seg.slice(0, m.index);
      const afterAll = seg.slice(m.index + m[0].length);
      const whole = m[0];
      // a book chapter, not a lesson
      const isBook =
        (ctx.subject === 'data-quality' && BOOK_JUST_BEFORE.test(before)) ||
        /^\s*,?\s*(?:หน้า|page|pages|p\.)\s*\d/i.test(afterAll) ||
        /^\s*(?:ของเล่มเดียวกัน|ของหนังสือ|of the same book|of that book|of the book)/i.test(afterAll);
      if (isBook) {
        if (WHY) console.log(`skip book: ${ctx.file}: ${(before.slice(-30) + whole + afterAll.slice(0, 20)).replace(/\s+/g, ' ')}`);
        continue;
      }
      const subject = subjectNear(before, afterAll, ctx.subject);
      const first = Number(m[3]);
      const firstUrl = urlOf(subject, first, ctx.en);
      if (!firstUrl) {
        left.push(`${whole} (no lesson ${first} in ${subject})`);
        continue;
      }
      // "lesson 5, page "Title"": the whole phrase links to that page when the lesson has one with that title
      if (m[6]) {
        const sub = subPagesOf[firstUrl]?.get(m[6].trim().toLowerCase());
        if (sub) {
          out += seg.slice(last, m.index) + `[${whole}](${sub})`;
          last = m.index + whole.length;
          linked++;
          continue;
        }
        left.push(`${whole} (lesson ${first} has no page with that title)`);
      }
      const head = m[0].slice(0, m[0].length - m[5].length);
      let replaced = `[${m[1]}${m[2]}${m[3]}](${firstUrl})`;
      let ok = true;
      replaced += m[4].replace(NUM, (all, sep2, n) => {
        const u = urlOf(subject, Number(n), ctx.en);
        if (!u) {
          ok = false;
          return all;
        }
        return `${sep2}[${n}](${u})`;
      });
      if (!ok) left.push(`${whole} (a number in it has no lesson)`);
      out += seg.slice(last, m.index) + replaced;
      last = m.index + head.length;
      linked++;
    }
    parts[i] = out + seg.slice(last);
  }
  let result = parts.join('');
  // a page named by its title alone: a page of this subject first, then a page of another subject when the title is unique
  const pages = titlesOf[`${ctx.en ? '/en' : ''}/${ctx.subject}`];
  const lookup = (t) => {
    const k = t.trim().toLowerCase();
    const own = pages?.get(k);
    return own !== undefined ? own : (everyTitle[ctx.en ? 'en' : 'th'].get(k) ?? null);
  };
  {
    const again = result.split(ctx.inProps ? TOKEN_PROPS : TOKEN);
    for (let i = 0; i < again.length; i += 2) {
      again[i] = again[i]
        .replace(TITLE_BEFORE, (all, lead, q1, title, q2) => {
          const url = lookup(title);
          if (!url || url === ctx.self) return all;
          linked++;
          return `${lead}${q1}[${title}](${url})${q2}`;
        })
        .replace(TITLE_AFTER, (all, q1, title, q2, tail) => {
          const url = lookup(title);
          if (!url || url === ctx.self) return all;
          linked++;
          return `${q1}[${title}](${url})${q2}${tail}`;
        })
        // a title with no quotes after the word lesson or page: "บท ซ้อมอย่างมีหลัก", "the lesson Execution model"
        .replace(pages ? plainTitleRx(ctx, pages) : /(?!)/g, (all, lead, title) => {
          const url = lookup(title);
          if (!url || url === ctx.self) return all;
          linked++;
          return `${lead}[${title}](${url})`;
        });
    }
    result = again.join('');
  }
  // "the next lesson" and "the previous lesson" (one lesson, so it can be linked); "the earlier lessons" is not one lesson and stays as it is
  if (ctx.order) {
    const nextUrl = urlOf(ctx.subject, ctx.order + 1, ctx.en);
    const prevUrl = ctx.order > 1 ? urlOf(ctx.subject, ctx.order - 1, ctx.en) : null;
    const NEXT = /\b(?:the )?next lesson\b|บทถัดไป|บทต่อไป/gi;
    // Thai "บทก่อนหน้า" is left alone: Thai has no plural, and it usually means all the earlier lessons
    const PREV = /\b(?:the )?previous lesson\b|(?<!(?:สอง|สาม|สี่|ห้า|หก|เจ็ด|แปด|เก้า|สิบ|ทุก|\d)\s*)บทที่แล้ว/gi;
    const once = result.split(ctx.inProps ? TOKEN_PROPS : TOKEN);
    for (let i = 0; i < once.length; i += 2) {
      once[i] = once[i]
        .replace(NEXT, (all) => {
          if (!nextUrl) {
            left.push(`${all} (this is the last lesson of the subject)`);
            return all;
          }
          linked++;
          return `[${all}](${nextUrl})`;
        })
        .replace(PREV, (all) => {
          if (!prevUrl) {
            left.push(`${all} (this is the first lesson of the subject)`);
            return all;
          }
          linked++;
          return `[${all}](${prevUrl})`;
        });
    }
    result = once.join('');
  }
  return { text: result, linked, left };
}

let totalLinked = 0;
const problems = [];
const brokenLinks = [];
const brokenFragments = [];
// every link between lesson pages: where it is written, which page it points at, and which heading (empty: the whole page)
const links = [];
const safeDecode = (t) => {
  try {
    return decodeURIComponent(t);
  } catch {
    return t;
  }
};
let changedFiles = 0;

for (const coll of ['lessons', 'lessons-en']) {
  const dir = join(CONTENT, coll);
  if (!existsSync(dir)) continue;
  for (const file of walk(dir)) {
    const rel = relative(dir, file).split(sep);
    const self = `${coll === 'lessons-en' ? '/en' : ''}/${rel[0]}/${rel[1].replace(/\.mdx$/, '')}/${rel.length === 3 && rel[2] !== 'index.mdx' ? rel[2].replace(/\.mdx$/, '') + '/' : ''}`;
    const slugHere = rel[1].replace(/\.mdx$/, '');
    const order = [...(orders[rel[0]] ?? [])].find(([, s]) => s === slugHere)?.[0] ?? 0;
    const ctx = { subject: rel[0], en: coll === 'lessons-en', file: relative(ROOT, file), self, order };
    const raw = readFileSync(file, 'utf8');
    const eol = raw.includes('\r\n') ? '\r\n' : '\n';
    const lines = raw.split(/\r?\n/);
    let fence = false;
    let front = lines[0] === '---';
    let inQuestion = false;
    let inOptions = false;
    let changed = false;
    for (let n = 0; n < lines.length; n++) {
      let line = lines[n];
      if (front) {
        if (n > 0 && line === '---') front = false;
        else if (/^(summary|title|description):/.test(line)) {
          REF.lastIndex = 0;
          if (REF.test(line)) problems.push(`${relative(ROOT, file)}:${n + 1} (frontmatter) ${line.slice(0, 110)}`);
        }
        continue;
      }
      if (/^\s*```/.test(line)) {
        fence = !fence;
        continue;
      }
      if (fence) continue;
      // links that point nowhere
      for (const lm of line.matchAll(/\]\((\/[^)#\s]*)(#[^)\s]*)?\)/g)) {
        const path = lm[1].endsWith('/') ? lm[1] : lm[1] + '/';
        if (!routes.has(path)) brokenLinks.push(`${relative(ROOT, file)}:${n + 1} ${lm[1]}`);
        else {
          const frag = lm[2] ? safeDecode(lm[2].slice(1)) : '';
          links.push({ from: relative(ROOT, file).split(sep).join('/'), line: n + 1, route: path, frag });
          // a heading that was renamed or removed: the link still opens the page but no longer reaches the heading
          if (frag && !idsOf.get(path)?.has(frag)) brokenFragments.push(`${relative(ROOT, file)}:${n + 1} ${path}#${frag}`);
        }
      }
      if (/ref-ok/.test(line)) continue;
      if (/^\s*<Question\b/.test(line)) inQuestion = true;
      // the options of a question sit inside buttons: a link cannot go there, so a reference there is reported, not linked
      if (inQuestion && /options=\{\[\s*$/.test(line)) inOptions = true;
      const optionsLine = inOptions;
      if (inOptions && /^\s*\]\}/.test(line)) inOptions = false;
      const attrOnly = inQuestion && /^\s*(code|answer|lang)=/.test(line);
      const inProps = inQuestion || /^\s*<Callout\b/.test(line);
      if (inQuestion && /\/>\s*$/.test(line)) inQuestion = false;
      if (attrOnly) continue;
      if (optionsLine) {
        REF.lastIndex = 0;
        if (REF.test(line)) problems.push(`${relative(ROOT, file)}:${n + 1} (an option of a question) ${line.trim().slice(0, 110)}`);
        continue;
      }
      const res = linkLine(line, { ...ctx, inProps });
      if (res.left.length) problems.push(`${relative(ROOT, file)}:${n + 1} ${res.left.join('; ')}`);
      if (res.linked) {
        if (FIX) {
          lines[n] = res.text;
          changed = true;
          totalLinked += res.linked;
        } else {
          problems.push(`${relative(ROOT, file)}:${n + 1} not linked: ${line.replace(/\s+/g, ' ').trim().slice(0, 150)}`);
          totalLinked += res.linked;
        }
      }
    }
    if (changed) {
      changedFiles++;
      if (!DRY) writeFileSync(file, lines.join(eol), 'utf8');
    }
  }
}

// What links here? `--backlinks /spark/execution-model/` lists every link to that page and to each of its headings;
// `--backlinks /spark/execution-model/#narrow-กับ-wide` only the links to that heading; `--graph` prints all links as JSON.
if (GRAPH) {
  console.log(JSON.stringify({ routes: [...routes], headings: Object.fromEntries([...idsOf].map(([r, s]) => [r, [...s]])), links }));
  process.exit(0);
}
if (BACKLINKS !== null) {
  const [route, frag] = BACKLINKS.split('#');
  // a leading slash is optional (Git Bash rewrites an argument that starts with one into a Windows path)
  const lead = route.startsWith('/') ? route : '/' + route;
  const page = lead.endsWith('/') ? lead : lead + '/';
  if (!routes.has(page)) {
    console.log(`no such page: ${page}`);
    process.exit(1);
  }
  const into = links.filter((l) => l.route === page && (!frag || l.frag === safeDecode(frag)));
  console.log(`${into.length} links to ${page}${frag ? '#' + safeDecode(frag) : ''}`);
  const byHeading = new Map();
  for (const l of into) (byHeading.get(l.frag) ?? byHeading.set(l.frag, []).get(l.frag)).push(l);
  const order = [...(idsOf.get(page) ?? [])];
  for (const h of ['', ...order, ...[...byHeading.keys()].filter((k) => k && !order.includes(k))]) {
    const list = byHeading.get(h);
    if (!list && !(frag === undefined && h)) continue;
    if (!list && h) continue;
    console.log(`\n${h ? '#' + h : '(the whole page)'}`);
    for (const l of list) console.log(`  ${l.from}:${l.line}`);
  }
  process.exit(0);
}
if (FIX) console.log(`${DRY ? 'would link' : 'linked'} ${totalLinked} references in ${changedFiles} files`);
else console.log(`${totalLinked} references are not links`);
for (const p of problems) console.log(p);
if (brokenLinks.length) {
  console.log(`\n${brokenLinks.length} links point to a page that does not exist:`);
  for (const b of brokenLinks) console.log(b);
}
if (brokenFragments.length) {
  console.log(`\n${brokenFragments.length} links point to a heading that does not exist (it was renamed or removed; \`--backlinks <page>\` shows who links where):`);
  for (const b of brokenFragments) console.log(b);
}
// a check fails on any reference that is not a link (or that cannot be linked), on a link that points nowhere and on a link to a heading that is gone
process.exit(brokenLinks.length || brokenFragments.length || (!FIX && (totalLinked || problems.length)) ? 1 : 0);
