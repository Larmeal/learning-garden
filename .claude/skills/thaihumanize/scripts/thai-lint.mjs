#!/usr/bin/env node
// Pattern check for Thai lesson text, used by the thaihumanize skill.
// Usage (repo root): node .claude/skills/thaihumanize/scripts/thai-lint.mjs <file.mdx|file.md> ...
// It finds patterns that made earlier Thai text read as AI (see SKILL.md). It cannot judge whether the text is natural.
// Lines without Thai, code blocks, frontmatter and import lines are skipped. Exit code 1 when there is a `warn`.
import { readFileSync } from 'node:fs';

const THAI = /[฀-๿]/;
const EMOJI = /[\u{1F300}-\u{1FAFF}☀-➿⭐⬆⬇]/gu;

// [id, level, regex, message]. Regexes run on the line with inline code and urls blanked out.
const RULES = [
  ['contrast', 'warn', /ไม่ใช่[^\n]{1,80}?(แต่|ต่างหาก)/u, '"ไม่ใช่ X แต่ Y": state Y'],
  ['contrast-tail', 'warn', /ต่างหาก(ที่|ที)/u, '"X ต่างหากที่...": state it directly'],
  ['bare-machine', 'warn', /(?<!คอมพิวเตอร์)(เครื่องเดียว|หลายเครื่อง|ทุกเครื่อง|เครื่องที่|เครื่องล้ม|เครื่องอื่น|เครื่องไหน|เครื่องนั้น|เครื่องหนึ่ง)/u, 'bare "เครื่อง": say "คอมพิวเตอร์..."'],
  ['bare-machine-count', 'warn', /(?<!คอมพิวเตอร์ )(?<![\d,])\d[\d,]* เครื่อง/u, 'a count of "เครื่อง" with no noun: say "คอมพิวเตอร์ N เครื่อง"'],
  ['bold-label', 'info', /^\s*(?:[-*]|\d+\.)\s+\*\*[^*]+\*\*/u, 'bold label at the start of a list item: fine for a list of definitions (the owner does it), not for reasoning'],
  ['maiyamok-space', 'warn', /[ก-๎]ๆ|ๆ[ก-๎]/u, 'write ๆ with a space on both sides: "ต่าง ๆ", "ง่าย ๆ"'],
  ['double-word', 'warn', /(การ|ความ|งาน|ของ|และ|จะ|ได้|ให้|ใน|กับ|เป็น|ซึ่ง|แต่|เรา|อยู่|ไม่|มี|ว่า|นี้|นั้น|ผู้|ตัว|คน|ระบบ|ข้อมูล|ตาราง|ก็|คือ|โดย|เมื่อ|หรือ|ถ้า)\1(?!ละ)/u, 'a common word typed twice in a row (typo?)'],
  ['em-dash', 'warn', /—|–/u, 'no em or en dash (use a comma, colon, brackets or two sentences)'],
  ['stock', 'warn', /ที่เหลือของหน้านี้|ข้อสรุปที่ถูกต้อง|ผลที่ตามมา|ปัญหาที่ยากคือ|ตอบคำถามเดียว|สิ่งสำคัญที่ควรรู้คือ/u, 'a phrase that announced or summed up in earlier text the owner removed'],
  ['polite-particle', 'info', /ครับ|ค่ะ|(?<![ก-ฮ])คะ(?![ก-๎])/u, 'polite particle: lessons use "นะ" in a note, not ครับ/ค่ะ in the body'],
  ['third-person', 'info', /ผู้เรียน|ผู้อ่านควร|ผู้ใช้งานควร/u, 'talk to the reader with เรา or คุณ'],
];

function strip(line) {
  return line.replace(/`[^`]*`/g, (m) => '§'.repeat(m.length)).replace(/\]\([^)]*\)/g, ']()').replace(/https?:\/\/\S+/g, '§');
}

let warns = 0;
let infos = 0;
const files = process.argv.slice(2);
if (!files.length) {
  console.error('usage: node thai-lint.mjs <file> ...');
  process.exit(2);
}

for (const file of files) {
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  let inCode = false;
  let inFront = lines[0] === '---';
  let emoji = 0;
  const out = [];
  lines.forEach((raw, i) => {
    const n = i + 1;
    if (inFront) {
      if (n > 1 && raw === '---') inFront = false;
      else if (!/^(title|summary):/.test(raw)) return;
    }
    if (/^\s*```/.test(raw)) {
      inCode = !inCode;
      return;
    }
    if (inCode || /^\s*import\s/.test(raw) || !THAI.test(raw)) return;
    const line = strip(raw);
    const isHeading = /^#{1,6}\s/.test(raw);
    const isList = /^\s*(?:[-*]|\d+\.)\s/.test(raw);
    const isTable = /^\s*\|/.test(raw);
    const isProp = /^\s*(?:q|why|title|summary)=/.test(raw);
    for (const [id, level, rx, msg] of RULES) {
      if (rx.test(line)) out.push({ n, level, id, msg, text: raw.trim().slice(0, 90) });
    }
    // colon after a lead-in inside running prose (headings, lists, tables and props are allowed to use it)
    const noTags = line.replace(/\((?:หนังสือ|รัน|ผู้เขียน|ผู้เขียนเส้นทางนี้):/g, '(').replace(/^(?:title|summary):/, '');
    if (!isHeading && !isList && !isTable && !isProp && /[ก-๎]\s?:(\s|$)/.test(noTags)) {
      out.push({ n, level: 'info', id: 'colon-lead', msg: 'colon after a lead-in in prose: fine before a name or a value, not after a sentence that introduces a summary', text: raw.trim().slice(0, 90) });
    }
    // every English word in Thai text starts with a capital letter (owner's rule, 2026-11-10); code, urls and 3+ word phrases are left alone
    {
      const tag = /^\s*<\w/.test(raw) ? (raw.match(/title="([^"]*)"/) || [])[1] || '' : null;
      const t = tag !== null ? tag : line
        .replace(/^\s*(?:q|why|title|summary|options|answer|lang|client:\w+)=\{?\[?/, ' ')
        .replace(/^(?:title|summary):/, ' ')
        .replace(/\{\/\*.*?\*\/\}/g, ' ')
        .replace(/\*/g, ' ').replace(/(?<![A-Za-z0-9])_|_(?![A-Za-z0-9])/g, ' ');
      const bad = [];
      for (const run of t.match(/[A-Za-z][A-Za-z0-9'._-]*(?: [A-Za-z][A-Za-z0-9'._-]*)*/g) || []) {
        const words = run.split(' ');
        if (words.length >= 3) continue;
        for (const w of words) if (/^[a-z][a-z-]{2,}$/.test(w)) bad.push(w);
      }
      if (bad.length) out.push({ n, level: 'warn', id: 'english-capital', msg: `English word(s) without a capital letter: ${[...new Set(bad)].slice(0, 5).join(', ')}`, text: raw.trim().slice(0, 90) });
    }
    // a very long paragraph
    const thaiLen = (raw.match(/[฀-๿]/g) || []).length;
    if (!isHeading && !isTable && !isProp && thaiLen > 520) {
      out.push({ n, level: 'info', id: 'long-paragraph', msg: `${thaiLen} Thai characters in one paragraph: split it?`, text: raw.trim().slice(0, 60) });
    }
    const e = raw.match(EMOJI);
    if (e) emoji += e.length;
  });
  if (emoji) out.push({ n: 0, level: 'info', id: 'emoji', msg: `${emoji} emoji in this file (none by default in lessons)`, text: '' });
  out.sort((a, b) => a.n - b.n);
  for (const o of out) {
    if (o.level === 'warn') warns++;
    else infos++;
    console.log(`${file}:${o.n || '-'}  ${o.level.padEnd(4)} [${o.id}] ${o.msg}${o.text ? '\n      ' + o.text : ''}`);
  }
}
console.log(`\n${warns} warn, ${infos} info`);
process.exit(warns ? 1 : 0);
