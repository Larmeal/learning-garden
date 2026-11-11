#!/usr/bin/env node
// Mechanical fixes for Thai lesson text, used by the thaihumanize skill. It only does what needs no judgement:
//   1. a space on both sides of ๆ ("ต่างๆ" -> "ต่าง ๆ")
//   2. an English word without a capital letter in Thai prose gets one ("table" -> "Table")
// It leaves alone: code fences, backticks, link targets, urls, import lines, JSX attributes (except title="..."),
// frontmatter keys other than title and summary, a run of three or more English words (a quote or a title), words with _ . digits.
// Inside a multi-line JSX tag (<Question ... />) only quoted strings that contain Thai are touched, so keys, ids and English labels stay as they are.
// Usage: node thai-fix.mjs [--dry] [--from-head] <file> ...      (prints what it would change with --dry)
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const THAI = /[฀-๿]/;
const args = process.argv.slice(2);
const dry = args.includes('--dry');
// --from-head: start from the committed version of the file (use it to redo a run that went wrong on files with no other uncommitted edits)
const fromHead = args.includes('--from-head');
const files = args.filter((a) => !a.startsWith('--'));
if (!files.length) {
  console.error('usage: node thai-fix.mjs [--dry] <file> ...');
  process.exit(2);
}

// Same length as the line; protected characters become §.
function mask(raw) {
  let s = raw;
  const blank = (m) => '§'.repeat(m.length);
  const tag = /^\s*<\w/.test(raw);
  if (tag) {
    // keep only the title="..." value of a JSX tag line
    const m = raw.match(/title="([^"]*)"/);
    const keepFrom = m ? raw.indexOf(m[0]) + 'title="'.length : -1;
    const keepTo = m ? keepFrom + m[1].length : -1;
    const chars = [...raw].map((c, i) => (i >= keepFrom && i < keepTo ? c : '§'));
    // link targets inside the title stay as they are
    for (const lm of raw.matchAll(/\]\(([^)]*)\)/g)) {
      const startCp = [...raw.slice(0, lm.index)].length + 2;
      const len = [...lm[1]].length;
      for (let k = startCp; k < startCp + len; k++) chars[k] = '§';
    }
    return chars.join('');
  }
  s = s.replace(/^(\s*)(?:q|why|title|summary|options|answer|lang)=\{?\[?/, (m) => '§'.repeat(m.length));
  s = s.replace(/^(?:title|summary):/, (m) => '§'.repeat(m.length));
  s = s.replace(/`[^`]*`/g, blank);
  s = s.replace(/\]\([^)]*\)/g, (m) => ']' + '§'.repeat(m.length - 1));
  s = s.replace(/https?:\/\/\S+/g, blank);
  s = s.replace(/\{\/\*.*?\*\/\}/g, blank);
  s = s.replace(/<[^>]*>/g, blank);
  return s;
}

// Mask for a line inside a multi-line JSX tag: everything is protected except the inside of quoted strings that contain Thai.
function maskJsx(line) {
  const chars = [...line].map(() => '§');
  const cps = [...line];
  const rx = /(["'])((?:\.|(?!).)*)/g;
  let m;
  while ((m = rx.exec(line))) {
    if (!THAI.test(m[2])) continue;
    const start = [...line.slice(0, m.index)].length + 1;
    const len = [...m[2]].length;
    for (let k = start; k < start + len; k++) chars[k] = cps[k];
  }
  return chars.join('');
}
function combine(a, b) {
  const x = [...a];
  const y = [...b];
  return x.map((c, i) => (c === '§' || y[i] === '§' ? '§' : c)).join('');
}

let total = 0;
for (const file of files) {
  const raw = fromHead ? execFileSync('git', ['show', 'HEAD:./' + file], { encoding: 'utf8', maxBuffer: 1 << 26 }) : readFileSync(file, 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const lines = raw.split(/\r?\n/);
  let inCode = false;
  let inFront = lines[0] === '---';
  let changed = 0;
  let inJsx = false;
  const out = lines.map((line, i) => {
    const n = i + 1;
    if (inFront) {
      if (n > 1 && line === '---') inFront = false;
      else if (!/^(title|summary):/.test(line)) return line;
    }
    if (/^\s*```/.test(line)) {
      inCode = !inCode;
      return line;
    }
    // track a multi-line JSX tag: it starts with <Component and has no closing > at the end of the line
    let jsxLine = inJsx;
    if (!inCode && !inJsx && /^\s*<[A-Z][\w.]*(?=[\s/>]|$)/.test(line) && !/>\s*$/.test(line)) {
      inJsx = true;
      jsxLine = false; // the opening line itself is handled by the tag branch of mask()
    } else if (inJsx && /(?:\/>|>)\s*$/.test(line)) inJsx = false;
    if (inCode || /^\s*import\s/.test(line) || !THAI.test(line)) return line;
    const m = jsxLine ? combine(mask(line), maskJsx(line)) : mask(line);
    if ([...m].length !== [...line].length) return line;
    let chars = [...line];
    let mchars = [...m];
    // 1. ๆ spacing
    let res = '';
    for (let k = 0; k < chars.length; k++) {
      const c = chars[k];
      const protectedHere = mchars[k] === '§';
      if (c === 'ๆ' && !protectedHere) {
        const prev = chars[k - 1];
        const next = chars[k + 1];
        if (prev && /[ก-๎]/.test(prev)) res += ' ';
        res += c;
        if (next && /[ก-๎]/.test(next)) res += ' ';
      } else res += c;
    }
    // 2. English capital letters (recompute the mask on the new line)
    const m2 = jsxLine ? combine(mask(res), maskJsx(res)) : mask(res);
    const rc = [...res];
    const mc = [...m2];
    const rx = /[A-Za-z][A-Za-z0-9'._-]*(?: [A-Za-z][A-Za-z0-9'._-]*)*/g;
    const mstr = mc.join('');
    let mm;
    while ((mm = rx.exec(mstr))) {
      const words = mm[0].split(' ');
      if (words.length >= 3) continue;
      let pos = mm.index;
      for (const w of words) {
        if (/^[a-z][a-z-]{2,}$/.test(w) && !mc.slice(pos, pos + w.length).includes('§')) rc[pos] = rc[pos].toUpperCase();
        pos += w.length + 1;
      }
    }
    const fixed = rc.join('');
    if (fixed !== line) {
      changed++;
      if (dry) console.log(`${file}:${n}\n  - ${line.slice(0, 110)}\n  + ${fixed.slice(0, 110)}`);
    }
    return fixed;
  });
  if (!dry && changed) writeFileSync(file, out.join(eol), 'utf8');
  console.log(`${file}: ${changed} line(s) ${dry ? 'would change' : 'changed'}`);
  total += changed;
}
console.log(`${total} line(s) in ${files.length} file(s)`);
