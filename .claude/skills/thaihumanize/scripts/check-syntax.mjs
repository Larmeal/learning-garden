#!/usr/bin/env node
// Syntax check for .ts/.tsx files after editing Thai strings in them (the site has no tsc, so this uses the Babel parser from site/node_modules).
// Usage (repo root): node .claude/skills/thaihumanize/scripts/check-syntax.mjs <file.tsx> ...
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(new URL('../../../../site/package.json', import.meta.url));
const { parse } = require('@babel/parser');
let bad = 0;
for (const f of process.argv.slice(2)) {
  try {
    parse(readFileSync(f, 'utf8'), { sourceType: 'module', plugins: ['typescript', 'jsx'] });
  } catch (e) {
    bad++;
    console.log(`${f}: ${e.message}`);
  }
}
console.log(bad ? `${bad} file(s) do not parse` : 'all parse');
process.exit(bad ? 1 : 0);
