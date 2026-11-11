You are helping rewrite Thai text of a personal learning website so that it sounds like its owner and not like AI. Repo: E:\Development\Project\learning (Astro site in site/). Shell: Git Bash. Do not commit, do not push, do not run `npm run build`, `npm run sync` or any dev server (the lead does that at the end; parallel builds clash). Only edit the files assigned to you below.

STEP 1. Read these before writing anything:
- E:\Development\Project\learning\.claude\skills\thaihumanize\SKILL.md and references\blog-voice.md (the owner's voice, learned from their blog, and the list of what reads as AI)
- Two samples of the voice in a lesson: the first Step (the heading "Spark คืออะไร ในสามประโยค") of site\src\content\lessons\spark\foundations\overview.mdx, which the owner wrote by hand, and site\src\content\lessons\data-quality\assurance-basics\index.mdx, a full rewrite the owner approved.

STEP 2. For each assigned file: read it, then rewrite its Thai prose in that voice (whole clauses with connectors, "เรา/คุณ", a question to the reader now and then, an honest "นะ" in a note, no staged openers or closers, no "ไม่ใช่ X แต่ Y" for weight, no bold label on every list item, no colon after every lead-in, "คอมพิวเตอร์" instead of a bare "เครื่อง", no "ครับ", no emoji). Write list items as sentences when they were fragments. Keep it about the same length (within about 15%): do not summarise, do not cut content, do not pad. Where the text is already natural, change it little: do not rewrite for the sake of it.

HARD RULES (a violation breaks the site or the owner's data):
1. Never add, remove or change a fact, number, unit, name, date, source tag ("หนังสือ:", "รัน:", "ผู้เขียน", "source", "ran") or citation (book, section, page). Never add a claim the original did not make. If you are unsure what a technical sentence means, keep its wording.
2. Keep every link exactly: the text part may be reworded, the target `](/path/#fragment)` must stay character for character. Keep the same number of links.
3. Do not change any `##` heading text (other lessons link to the ids made from it) and do not change the frontmatter keys or values, except that `summary:` may be reworded. Do not change `title:`.
4. Keep code fences, text inside backticks, tables (same rows, columns and numbers; you may smooth the Thai wording of a cell), JSX/MDX tags and their props, `import` lines, and `{/* ref-ok */}` comments exactly.
5. In quiz pages (Question components) never change the `q=` text and never change `answer=` or the order of `options`. You may reword each option and `why=` text. In a `q=` or option string do not use a double quote inside a double-quoted prop, and keep every string quoted the same way it was.
6. English words inside Thai text start with a capital letter (Dimension, Row, Partition, Consumer), except what is in backticks, inside a quotation taken from a book, in a url, or a code identifier. Put a space on both sides of ๆ ("ต่าง ๆ").
7. Do not translate or touch lessons-en. Do not touch files that are not assigned to you.
8. Do not use the em dash anywhere.

STEP 3. After editing a file, run from the repo root: `node .claude/skills/thaihumanize/scripts/thai-lint.mjs <file>` and fix every `warn` that is a real problem (a few warns are false alarms, for example a deliberate correction like "ไม่ใช่ X" that fixes a belief the reader holds: keep those, and say so). Also compare the links before and after: `grep -o ']([^)]*)' <file>` must give the same list as in the original (`git show HEAD:./<path>` after cd to site/src/content/lessons/... or `git diff` shows it). Check the number of `<Step>` tags and of `<Question` tags did not change.

STEP 4. Final reply (at most 150 words): the files you finished, anything you were unsure about, anything you skipped and why. Do not paste the text back.
