// Writes CHANGELOG.md from the commit messages, the way commitizen does for a library, but grouped by day because the garden
// has no versions: it is published on every push to main.
//
//   node tools/changelog.mjs             write ../CHANGELOG.md
//   node tools/changelog.mjs --stdout    print it instead of writing
//   node tools/changelog.mjs --check     exit 1 when the file is not what the commits would give (used by nothing yet)
//   node tools/changelog.mjs --since 2026-11-01   only the days from that date
//
// A message is `type(scope)!: subject` (see .cz.toml at the repo root, and `cz schema`). Its type decides the heading it is listed
// under, its scope is printed in bold in front of it, `!` marks it "breaking", and the short hash links to the commit on GitHub.
// Types that only a contributor sees (chore, ci, test, revert) are left out. A message that does not follow the format is listed
// under "Other", so nothing disappears quietly. A commit about the changelog itself is left out too.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// type -> heading. Keep in step with the TYPES guide in ../.cz.toml. A type that is not here is left out.
const TYPES = {
  feat: 'Added',
  fix: 'Fixed',
  docs: 'Docs',
  refactor: 'Changed',
  perf: 'Changed',
  build: 'Changed',
};
const ORDER = ['Added', 'Fixed', 'Changed', 'Docs', 'Other'];
const HIDDEN = new Set(['chore', 'ci', 'test', 'revert']);
// the same shape as `schema_pattern` of .cz.toml, with the parts named
const MESSAGE = /^(?<type>[a-z]+)(?:\((?<scope>[a-z0-9_,-]+)\))?(?<bang>!)?: (?<subject>\S.*)$/;

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const since = args.includes('--since') ? args[args.indexOf('--since') + 1] : '';

const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 1 << 26 }).trim();
const root = git('rev-parse', '--show-toplevel');
const file = join(root, 'CHANGELOG.md');

// https://github.com/<owner>/<repo> from the origin remote, for the links to commits
function repoUrl() {
  try {
    const m = /^(?:https:\/\/|git@)github\.com[/:](.+?)(?:\.git)?$/.exec(git('remote', 'get-url', 'origin'));
    return m ? `https://github.com/${m[1]}` : '';
  } catch {
    return '';
  }
}
const repo = repoUrl();

// one line per commit: hash, committer date (in the commit's own time zone), subject
const SEP = '\u001f';
const log = git('log', '--no-merges', '--reverse', `--format=%H${SEP}%cs${SEP}%s`, ...(since ? [`--since=${since}`] : []));
const days = new Map(); // date -> heading -> [line]

for (const row of log ? log.split('\n') : []) {
  const [sha, date, subject] = row.split(SEP);
  const m = MESSAGE.exec(subject);
  let heading;
  let line;
  if (m) {
    const { type, scope, bang, subject: text } = m.groups;
    if (HIDDEN.has(type)) continue;
    if (/changelog/i.test(text)) continue; // a commit about the changelog is not a change to the garden
    heading = TYPES[type];
    if (!heading) heading = 'Other';
    line = `${scope ? `**${scope}**: ` : ''}${bang ? '**breaking** ' : ''}${text}`;
    if (heading === 'Other') line = `${type}: ${line}`;
  } else {
    if (/^(Merge|Revert|fixup!|squash!|amend!)/.test(subject)) continue;
    heading = 'Other';
    line = subject;
  }
  const link = repo ? ` ([\`${sha.slice(0, 7)}\`](${repo}/commit/${sha}))` : ` (\`${sha.slice(0, 7)}\`)`;
  if (!days.has(date)) days.set(date, new Map());
  const day = days.get(date);
  if (!day.has(heading)) day.set(heading, []);
  day.get(heading).push(`- ${line}${link}`);
}

const out = [
  '# Changelog',
  '',
  'Made from the commit messages by `npm run changelog` (from `site/`), newest day first. Do not edit it by hand: change the commit message',
  'instead, or read the commit body for the reasons. How a message is written is in [`.cz.toml`](.cz.toml) (`type(scope): subject`).',
  'Housekeeping (`chore`, `ci`, `test`) is not listed. The older, hand-written notes are in [`docs/changelog-handwritten.md`](docs/changelog-handwritten.md).',
  '',
];
for (const date of [...days.keys()].sort().reverse()) {
  out.push(`## ${date}`, '');
  const day = days.get(date);
  for (const heading of ORDER) {
    if (!day.has(heading)) continue;
    out.push(`### ${heading}`, '', ...day.get(heading), '');
  }
}
const text = out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';

if (flag('--stdout')) process.stdout.write(text);
else if (flag('--check')) {
  let current = '';
  try {
    current = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  } catch {
    /* no file yet */
  }
  if (current !== text) {
    console.error('CHANGELOG.md is not what the commits give. Run `npm run changelog`.');
    process.exit(1);
  }
  console.log('CHANGELOG.md is up to date');
} else {
  writeFileSync(file, text, 'utf8');
  const entries = text.split('\n').filter((l) => l.startsWith('- ')).length;
  console.log(`wrote ${file}: ${days.size} days, ${entries} entries`);
}
