// Keeps the Thai and English lesson pages in step.
//
// Every lesson page is cut into units: unit 0 is the title and summary (plus any text that sits outside the <Step> cards),
// then one unit per <Step> card, or per "## " section on a page that has no cards. For every unit the file
// translation-sync.json keeps the hash and the time of the last change of both languages, and the pair of hashes that was
// last known to belong together ("paired"). Comparing the hashes of the files on disk with that tells which language
// moved since, so a Thai edit that English did not follow is reported at once, and so is the other way round.
//
// Used by `npm run sync` (this file as a script) and by the dev editor in astro.config.mjs (createSync).
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const LF = (s) => s.replace(/\r\n?/g, '\n');
const tidy = (s) => s.split('\n').map((l) => l.replace(/\s+$/, '')).join('\n').trim();
const hashOf = (s) => createHash('sha1').update(s).digest('hex').slice(0, 10);

// Only these frontmatter fields are text that gets translated.
const TRANSLATED_FIELDS = new Set(['title', 'summary']);

function frontText(block) {
  const keep = [];
  let on = false;
  for (const line of block.split('\n')) {
    const m = /^([A-Za-z_][\w-]*):/.exec(line);
    if (m) on = TRANSLATED_FIELDS.has(m[1]);
    if (on) keep.push(line);
  }
  return keep.join('\n');
}

const headingOf = (s) => /^#{1,6}\s+(.+)$/m.exec(s)?.[1].trim() ?? '';

/** Cuts the text of a lesson file into units: [{ label, text }]. */
export function unitsOf(raw) {
  const text = LF(raw);
  const m = /^---[ \t]*\n([\s\S]*?)\n---[ \t]*\n?/.exec(text);
  const head = m ? frontText(m[1]) : '';
  const body = m ? text.slice(m[0].length) : text;
  const notImport = (s) => s.split('\n').filter((l) => !l.startsWith('import ')).join('\n');
  const units = [];

  if (/<Step\b/.test(body)) {
    const re = /<Step\b[^>]*>[\s\S]*?<\/Step>/g;
    const steps = [...body.matchAll(re)];
    const outside = notImport(body.replace(re, ''));
    units.push({ label: 'Title and summary', text: tidy(head + '\n' + outside) });
    steps.forEach((s, k) => units.push({ label: `Step ${k + 1}`, heading: headingOf(s[0]), text: tidy(s[0]) }));
  } else {
    // a page without cards: one unit per "## " section, code fences left alone
    const parts = [{ label: 'Intro', heading: '', lines: [] }];
    let fence = false;
    for (const line of notImport(body).split('\n')) {
      if (/^```/.test(line)) fence = !fence;
      if (!fence && /^## /.test(line)) parts.push({ label: line.slice(3).trim(), heading: line.slice(3).trim(), lines: [line] });
      else parts[parts.length - 1].lines.push(line);
    }
    units.push({ label: 'Title and summary', text: tidy(head) });
    parts.forEach((p, k) => units.push({ label: k === 0 ? 'Intro' : `Section ${k}: ${p.label}`, heading: p.heading, text: tidy(p.lines.join('\n')) }));
  }
  return units;
}

/**
 * Decides the state of one unit.
 * rec: what the store knew { th:{h,at}, en:{h,at}, paired:{th,en}, behind }, cur: current hashes, mt: file times (ISO).
 * Returns the new record. behind is null (in step), 'en' (English has not followed Thai) or 'th' (English moved alone).
 */
export function judge(rec, cur, mt) {
  const r = { th: { ...rec.th }, en: { ...rec.en }, paired: { ...rec.paired }, behind: rec.behind ?? null };
  const moved = { th: cur.th !== r.th.h, en: cur.en !== r.en.h };
  for (const s of ['th', 'en']) if (moved[s]) r[s] = { h: cur[s], at: mt[s] };
  const pair = () => { r.paired = { th: cur.th, en: cur.en }; r.behind = null; };

  if (cur.th === r.paired.th && cur.en === r.paired.en) pair(); // back to the last agreed pair
  else if (r.behind) {
    // the language that was behind has been touched since: it caught up
    if (moved[r.behind]) pair();
  } else {
    const thCh = cur.th !== r.paired.th;
    const enCh = cur.en !== r.paired.en;
    if (thCh && enCh) {
      // both moved and nobody was flagged: English edited after Thai counts as a follow-up, the other order does not
      if (r.en.at >= r.th.at) pair();
      else r.behind = 'en';
    } else if (thCh) r.behind = 'en';
    else if (enCh) r.behind = 'th';
  }
  return r;
}

function stringifyStore(store) {
  const keys = Object.keys(store).sort();
  if (!keys.length) return '{}\n';
  const rows = keys.map((k) => `${JSON.stringify(k)}: [\n${store[k].map((u) => '  ' + JSON.stringify(u)).join(',\n')}\n]`);
  return `{\n${rows.join(',\n')}\n}\n`;
}

const iso = (d) => d.toISOString().replace(/\.\d+Z$/, 'Z');

export function createSync(site) {
  const TH = resolve(site, 'src/content/lessons');
  const EN = resolve(site, 'src/content/lessons-en');
  const STORE = resolve(site, 'translation-sync.json');

  const load = () => (existsSync(STORE) ? JSON.parse(readFileSync(STORE, 'utf8')) : {});
  const pathsOf = (key) => ({ th: join(TH, ...key.split('/')) + '.mdx', en: join(EN, ...key.split('/')) + '.mdx' });

  function allKeys() {
    const out = [];
    const walk = (dir) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (e.name.endsWith('.mdx')) out.push(relative(TH, p).split(sep).join('/').replace(/\.mdx$/, ''));
      }
    };
    walk(TH);
    return out.sort();
  }

  /** The key of a lesson file (absolute path), or null if it is not one that has a twin. */
  function keyOfFile(abs) {
    for (const base of [TH, EN]) {
      if (abs.startsWith(base + sep) && abs.endsWith('.mdx')) {
        const key = relative(base, abs).split(sep).join('/').replace(/\.mdx$/, '');
        const p = pathsOf(key);
        return existsSync(p.th) && existsSync(p.en) ? key : null;
      }
    }
    return null;
  }

  /** Evaluates one lesson pair. Returns { key, mismatch, units, rec } and does not write anything. */
  function evaluate(key, store, now) {
    const p = pathsOf(key);
    if (!existsSync(p.th) || !existsSync(p.en)) return { key, missing: existsSync(p.th) ? 'en' : 'th', units: [], rec: null };
    const th = unitsOf(readFileSync(p.th, 'utf8'));
    const en = unitsOf(readFileSync(p.en, 'utf8'));
    const old = store[key];
    if (th.length !== en.length) {
      return { key, mismatch: { th: th.length, en: en.length }, th, en, units: [], rec: old ?? null };
    }
    const mt = { th: iso(statSync(p.th).mtime), en: iso(statSync(p.en).mtime) };
    const rec = th.map((u, i) => {
      const cur = { th: hashOf(u.text), en: hashOf(en[i].text) };
      if (!old || !old[i] || old.length !== th.length) {
        // first sight (or the number of units changed on both sides at once): start as "in step"
        return old && old[i]
          ? judge(old[i], cur, mt)
          : { th: { h: cur.th, at: now }, en: { h: cur.en, at: now }, paired: { ...cur }, behind: null };
      }
      return judge(old[i], cur, mt);
    });
    const units = rec.map((r, i) => ({
      i,
      label: th[i].label,
      heading: th[i].heading || '',
      state: r.behind ? (r.behind === 'en' ? 'en-behind' : 'th-behind') : 'sync',
      // when the language that moved ahead was last edited
      since: r.behind ? r[r.behind === 'en' ? 'th' : 'en'].at : null,
      thText: th[i].text,
      enText: en[i].text,
    }));
    return { key, mismatch: null, units, rec };
  }

  /** Evaluates the given keys (default: all), writes the store unless write is false, returns the results. */
  function run({ keys = allKeys(), write = true, now = iso(new Date()) } = {}) {
    const store = load();
    const next = { ...store };
    const results = keys.map((k) => evaluate(k, store, now));
    for (const r of results) if (r.rec) next[r.key] = r.rec;
    const text = stringifyStore(next);
    if (write && (!existsSync(STORE) || readFileSync(STORE, 'utf8') !== text)) writeFileSync(STORE, text, 'utf8');
    return results;
  }

  /** Marks units (all of them when units is empty) of a lesson as in step. */
  function accept(key, units = []) {
    const [r] = run({ keys: [key], write: false });
    if (!r.rec) return r;
    const store = load();
    const rec = r.rec.map((u, i) => (units.length && !units.includes(i) ? u : { ...u, paired: { th: u.th.h, en: u.en.h }, behind: null }));
    store[key] = rec;
    writeFileSync(STORE, stringifyStore(store), 'utf8');
    return run({ keys: [key], write: false })[0];
  }

  /** A short description of one result, for the dev editor. */
  function summary(r) {
    const stale = r.units.filter((u) => u.state !== 'sync');
    return {
      key: r.key,
      mismatch: r.mismatch,
      total: r.units.length,
      stale: stale.map((u) => ({ i: u.i, label: u.label, heading: u.heading, state: u.state, since: u.since })),
      copy: stale.length ? copyText(r) : '',
    };
  }

  /** Text to paste to whoever translates: what is behind, with the current Thai and English of each unit. */
  function copyText(r) {
    const stale = r.units.filter((u) => u.state !== 'sync');
    const out = [`Translation to update: ${r.key}`, `Thai file: src/content/lessons/${r.key}.mdx`, `English file: src/content/lessons-en/${r.key}.mdx`, ''];
    for (const u of stale) {
      const behind = u.state === 'en-behind' ? 'English has not followed the Thai edit' : 'English was edited alone, check that Thai still agrees';
      out.push(`## ${u.label}${u.heading ? ` (${u.heading})` : ''}: ${behind} (edited ${u.since})`, '', '### Thai (current)', u.thText, '', '### English (current)', u.enText, '');
    }
    return out.join('\n');
  }

  return { allKeys, keyOfFile, evaluate, run, accept, summary, copyText, pathsOf, STORE };
}

// ---- command line: node tools/translation-sync.mjs [--check] [--accept <key> [unit numbers]] ----
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const site = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const sync = createSync(site);
  const args = process.argv.slice(2);
  const ago = (t) => {
    const d = (Date.now() - Date.parse(t)) / 86400000;
    return d < 1 ? 'today' : `${Math.floor(d)}d ago`;
  };

  const ai = args.indexOf('--accept');
  if (ai >= 0) {
    const key = args[ai + 1];
    const units = args.slice(ai + 2).map(Number).filter(Number.isInteger);
    if (!key) { console.error('usage: sync --accept <lesson key, e.g. spark/architecture/index> [unit numbers]'); process.exit(2); }
    const r = sync.accept(key, units);
    console.log(r.mismatch ? `not accepted: ${key} has a different number of units (th ${r.mismatch.th}, en ${r.mismatch.en})` : `accepted ${key}${units.length ? ` units ${units.join(', ')}` : ''}`);
    process.exit(r.mismatch ? 1 : 0);
  }

  const check = args.includes('--check');
  const results = sync.run({ write: !check });
  const bad = results.filter((r) => r.mismatch);
  const stale = results.filter((r) => r.units.some((u) => u.state !== 'sync'));
  for (const r of bad) console.log(`STRUCTURE  ${r.key}: Thai has ${r.mismatch.th} units, English has ${r.mismatch.en}`);
  for (const r of stale) {
    const parts = r.units.filter((u) => u.state !== 'sync').map((u) => `${u.label} (${u.state === 'en-behind' ? 'Thai edited' : 'English edited alone'} ${ago(u.since)})`);
    const who = r.units.some((u) => u.state === 'en-behind') ? 'EN behind' : 'TH behind';
    console.log(`${who.padEnd(10)} ${r.key}: ${parts.join(', ')}`);
  }
  const files = results.length;
  const units = results.reduce((n, r) => n + r.units.length, 0);
  console.log(`${files} lesson pairs, ${units} units: ${stale.length} pairs out of step, ${bad.length} with different structure${check ? ' (check only, nothing written)' : ''}`);
  process.exit(check && (bad.length || stale.length) ? 1 : 0);
}
