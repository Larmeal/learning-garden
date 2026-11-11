You are helping rewrite the Thai text shown by interactive labs (and a few interface files) of a personal learning website so that it sounds like its owner and not like AI. Repo: E:\Development\Project\learning (Astro site in site/). Shell: Git Bash. Do not commit, do not push, do not run `npm run build`, `npm run sync` or a dev server (the lead does that at the end). Only edit the files assigned to you.

STEP 1. Read before writing: E:\Development\Project\learning\.claude\skills\thaihumanize\SKILL.md and references\blog-voice.md (the owner's voice and what reads as AI), and the first Step of site\src\content\lessons\spark\foundations\overview.mdx (written by the owner by hand).

STEP 2. In each assigned .ts/.tsx file, edit ONLY the Thai display strings: usually the `th:` block of a `TEXT` object (and any other Thai-only literal such as a Thai glossary, a hint, a caption, a step explanation, an aria label). Rewrite the longer explanations (more than a short label) in the owner's voice: whole clauses with connectors, "เรา/คุณ", no staged openers or closers, no "ไม่ใช่ X แต่ Y" for weight, "คอมพิวเตอร์" instead of a bare "เครื่อง", no "ครับ", no emoji, no em dash. Short labels (buttons, chips, axis names, card titles) stay short: only fix capital letters and spacing. Keep the same length within about 15%.

HARD RULES (a violation breaks the site):
1. Never change code: not object keys, ids, function names, types, imports, numbers used in logic, CSS class names, `lang` branches, the `en:` block, or anything not Thai. Do not rename keys of TEXT. Keep every `${...}` interpolation, every function-valued entry (for example `read: (n, total) => ...`) with the same parameters and the same expressions, and every JSX element inside a string value.
2. Never add, remove or change a fact, number, unit, name or claim. If you are unsure what a technical sentence means, keep its wording.
3. Keep each string's quote style, and escape any quote you add. Do not put a raw newline in a single-quoted string. Do not use a double quote inside a double-quoted string.
4. English words inside Thai text start with a capital letter (Tuning Machines, Bridge Pins, Shuffle, Partition), except identifiers, code, and file names. Put a space on both sides of ๆ.
5. A string that the code compares with or uses as a key (for example a label that is later looked up, a value in a `switch`, an option value) must not change at all: when in doubt, do not touch it.
6. Do not touch files that are not assigned to you.

STEP 3. After editing each file run, from the repo root: `node .claude/skills/thaihumanize/scripts/check-syntax.mjs <file>` (it must print "all parse"). Then run `git diff --stat <file>` and `git diff <file> | grep '^[-+]' | grep -v 'th\|[ก-๙]'` mentally: the diff should show Thai text lines only; if a non-Thai line changed, undo it.

STEP 4. Final reply (at most 120 words): files finished, anything unsure, anything skipped and why.
