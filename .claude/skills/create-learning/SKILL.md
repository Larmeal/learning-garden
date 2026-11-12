---
name: create-learning
description: Build a new lesson, a sub-page, a lab (animation) or a whole new subject for the learning garden, from evidence to Thai text, English version, quiz, labs and checks, finished in one pass. Use when the owner says /create-learning, or asks to make a lesson, a deep-dive page, a lab or a subject (for example "สร้างบทเรียน Iceberg", "ช่วยทำการเรียนการสอนสำหรับ X"). It calls /thaihumanize for the Thai prose.
---

# create-learning: make a lesson for the garden

This skill is what was learned while building the Spark, Great Expectations, Data Quality, pytest, pydantic, singing and Iceberg subjects and while
reviewing them with the owner. It is a procedure, not a template: the owner reads these lessons again later to understand something,
so a lesson is finished when a person who is one step behind can follow it **and see it**, not when the files exist.

Read [CLAUDE.md](../../../CLAUDE.md) first (layout, languages, links, commands). Details that would make this file too long are in
[references/lesson-skeleton.md](references/lesson-skeleton.md) (MDX skeleton, quiz, sources table, subject JSON),
[references/exercise-craft.md](references/exercise-craft.md) (how to get evidence, Windows and WSL, the owner's books) and
[references/lab-craft.md](references/lab-craft.md) (how to make an animation that teaches, with the component API and the readability rules).

## How to work with the owner

- **When the request says what to build, build all of it. Do not stop to ask.** "ทำให้ครบทุกบท", "ทำต่อให้ครบ" and "ช่วยทำการเรียนการสอนสำหรับ X" mean:
  every lesson of the subject, Thai **and** English, with a quiz and with labs, checked. On 2026-11-12 the Iceberg subject was handed back four times
  before it was whole (three lessons "to test the pipeline", then Thai only, then no labs, then labs the owner could not read), and each time the owner had to
  ask "ทำไมไม่ทำ". A first slice to prove the pipeline is fine **inside** the work; then carry on without asking. Hand back when the whole request is done.
  The only things that may be left out are things that cannot be done here (a server that is not installed): say which, and why, in the hand-back.
- **Write the plan in the first message and start.** State it in a few lines (step 1) so the owner can correct it on the way, but do not wait for
  "เริ่มได้" when the request already says what to do. Wait only when the owner says to ("คุยก่อน", "แค่ถามเฉย ๆ", "นายยังคุยกับฉันไม่เสร็จเลย"): a
  question is answered, not acted on.
- **When the owner points out something missing or hard to read, treat it as a defect of this skill too.** Fix the work, then add the rule here
  (or in a reference) so that the next subject does not need the same push. That is what this file's own history is.
- **Keep the owner informed while you work.** A long job needs a short line every few steps ("กำลังทำแบบฝึก 07"), not a silent hour. Do the work with
  your own tools; do not hand it to subagents unless the owner asks.
- **Never commit or push unless asked in that turn.** When asked to commit, add a `CHANGELOG.md` line (English, newest date first,
  Added / Changed / Fixed) for anything a reader can see, and end the commit message with the attribution trailer the harness gives. Update
  `CHANGELOG.md` and the "Current subjects" paragraph of CLAUDE.md as part of the work, not only at the commit.
- **Do not claim what you did not check.** Say what was run, what was only read, and what nobody looked at (a sound that was never
  listened to, a phone that was never held, a figure of a book that was only a caption). The "Current subjects" paragraph of CLAUDE.md is
  written that way: copy that honesty. Honesty about a gap is not a reason to stop at the gap.
- The owner's own edits to a page are the final word. Do not overwrite them, and treat their diff as a style example.

## Definition of done (check it before you hand back)

For a subject: every lesson in Thai with a quiz, every lesson in English with a quiz, a `lang`-aware lab for every idea that is a path, a layering, an order,
a moving pointer or a choice with a visible result (see "Labs"), the `in-depth` pages that reading the source makes possible, exercises that
assert every number, `docs/` (overview, sources, verified-findings), the subject JSON with its `en` block, CLAUDE.md and CHANGELOG.md, and every check of
section 7 green, including the lab screenshots and the crawl. For a single lesson or lab: the same, for that part. If one of these is missing, you are not done, you are at a checkpoint.

## 1. Plan (short, and the owner can correct it)

Find out what exists before proposing anything: `grep -ril <topic> site/src/content subjects` and read the neighbouring lessons. **Look for the owner's
books on the topic** in `E:\Development\Project\personal-project\personal-knowledge\Clippings\book\` (see `exercise-craft.md`), and for the source checkout
in `E:\Development\Project\open-source\`. Check what the thing you teach actually publishes (versions, runtimes) before you promise exercises.
**When the owner gives a link or a name as the example of how they want it explained** (on 2026-11-12: the Dremio guide *Apache Iceberg: An Architectural Look Under the Covers*, "เขาอธิบายไว้ดีมากเลย"), fetch it at once (`WebFetch`), list its structure (headings in order, what is explained per operation, which figures it has) and make the subject do the same or better, then say in `docs/sources.md` that you copied the **shape** and not the text, and that the figures were not seen if the fetch returned none. Do not ask "which part do you mean": the whole page is the example.
Then write the plan in a few lines:

1. **Where it goes.** A new subject, a new main lesson of a subject (`order`, `phase`, `level`, `requires`), or a sub-page (`in-depth`,
   a deep dive, a quiz). A subject id is part of every URL and saved progress key: never rename one.
2. **What the reader should be able to do afterwards** (one sentence per Step is a good test) and which question of the phase `check` in the subject JSON it answers.
3. **Evidence.** For every claim, where it comes from (next section). Say plainly if the source is thin, and what you will do about it (run it,
   read the source, use the book), not only that it is thin.
4. **Which parts need a lab**, one line each: what the reader sees change and concludes, and which figure of the book (if any) it follows. A lesson
   about structure, order, layers or a pointer that moves has a lab. Plan them now; they are built with the lesson, not after.
5. **A running example and its operations.** For a subject about a system (a table format, a database, a message queue), pick **one small example** that every lesson reuses and plan a page that
   follows it through each operation in turn (create, write, change, read, look back, maintain), one numbered sequence and one picture per operation, each picture showing the real content of
   what the operation produced (see `lab-craft.md`, "One picture per operation"). The reader's question "what really happens when I run this?" is the main one of such a subject.
6. **Both languages.** Thai first (the original), English after, same slugs, in the same pass.

## 2. Evidence first

Every claim in a lesson carries one of these tags, and the subject's `docs/verified-findings.md` lists them (copy the file of the subject
that is closest):

- **ran** (Thai "รัน"): an exercise in `subjects/<id>/code/exercises/NN_*.py` asserts it. Prefer this above everything. Each exercise has
  `assert`s on the numbers and plan shapes that the lesson prints, and `verify.py` re-runs all of them (update it with any exercise). Run
  it, paste the real output into the lesson, never a number from memory. How to write exercises, what to do when the output surprises you, and the
  Windows and WSL details are in [references/exercise-craft.md](references/exercise-craft.md).
- **source**: read from a source tree or its knowledge graph (`subjects/<id>/graphs/`). The skill `understand-to-self-learning` builds the
  graph for an open-source repo at a tag; cite the file and function. The code lives outside the repo (`E:\Development\Project\open-source`).
- **book** (Thai "หนังสือ"): section or chapter number plus the printed page where the section starts, `DMBOK2 หัวข้อ 2.7.1 หน้า 478`,
  `Apache Iceberg: The Definitive Guide บทที่ 3 หน้า 46 (Figure 3-2)`. Never the section sign or "ch.". Page offsets and the path of the clipping are in `docs/sources.md` of the subject.
- **author** (Thai "ผู้เขียน"): advice, framing or an inference. Say so.

A claim from documentation that was not run is allowed, but the lesson says "ไม่ได้รัน" next to it and links the page. Never invent a number,
a version or a quotation. If a lab draws made-up numbers, the lab's caption says which are measured and which are examples.

Make the exercise and the lesson agree: change one, re-run the other. A subject also gets `docs/overview.md` (what it covers, the
backlog) and `docs/sources.md`.

## 3. Write the lesson

Shape and a full skeleton are in the reference. The rules that matter:

- `format: steps`: one **Step** card per idea. The reader moves one card at a time and can also read the cards as a long page, so every
  card must stand on its own. A question card is `<Step kind="question">` with one `<Question>`; the player waits for the answer.
- **Open with something concrete**: a small table of real rows, a command and its output, a number from an exercise. Let the reader see the
  problem before the definition. (The owner called the first Data Quality dimension pages "งง" because they started with definitions.)
- **One everyday picture, used again.** A box for an object, a bank clerk and a power cut for a transaction, a book with a table of contents for a table
  format. Keep it, return to it, and put its words on the lab's boxes too.
- **Explain each line of code** in a sentence after the block. Show the output the reader would see.
- **Predict, then reveal.** Where it fits, ask what will happen, then show it. A `<Question>` right after the demo is better than a
  summary paragraph. Teach the surprises you found by running (see exercise-craft).
- A page that explains a structure or a process has its lab **inside the lesson**, as a Step placed before the question that depends on it, with one or two sentences
  that say what to press and what to look for.
- Close the page with `## ที่มาของบทนี้`: a table of claim and source (ran / source / book / author) with links.
- A deep dive goes in `in-depth.mdx` (or another child), each main lesson has a `quiz.mdx` (`kind: quiz`, `order: 99`, about 4 to 5 questions with a
  `why` that teaches, not just "correct").
- Every mention of another lesson is a link, pointing at the heading that the sentence is about (CLAUDE.md, "Links between lessons").
  Do not rename a heading that others link to. `npm run check:refs` must pass; `node tools/lesson-refs.mjs --fix` links what it can. Do not link
  to a lesson that does not exist yet: write the lessons so that a link points backwards, or add the link when the target exists.
- Frontmatter `summary` and `title` are **plain text**: no backticks, no markdown (a backtick shows on the lesson cover). They are the first thing the owner sees.

### The Thai text: use /thaihumanize

**Call the Skill tool first, every time.** Before the first Thai sentence of any piece, a new lesson, a sub-page, a deep dive, a quiz question, a callout or a lab string, even when `/thaihumanize` was loaded earlier in the session
(on 2026-11-12 two pages were written "from memory" of the skill, the owner asked "นายใช้ /thaihumanize แล้วหรอ" and then pointed out that this skill says to). Read its `references/blog-voice.md` when you write more than a paragraph.
The lint does not replace it: it finds patterns, not voice. Thai in a lab's `.tsx` counts too. Bullet lists that hold reasoning (a list of "because" items), a closing line that sums up, and a colon after every lead-in are what
slipped through; write them as paragraphs with a bold sequence word (**อย่างแรก**, **จุดสุดท้าย**). In the hand-back say which pages `/thaihumanize` was run on, and `fix-capitals.py` must never be run on a `.tsx` (it would
capitalise code keys): fix the words in the strings by hand. A wording-only change to a Thai page is recorded with `npm run sync -- --accept <lesson key>`.

Write the Thai prose by calling the skill `/thaihumanize` (the Skill tool, `skill: "thaihumanize"`) and following it, then run its
`thai-lint.mjs` on every Thai file you wrote. Call it again before each new batch of lessons, not once per session. The essentials, so that you do not
start from the wrong voice: a teacher talking to a colleague who is a step behind, "เรา" and "คุณ", whole clauses with ordinary connectors, no staged
opener or closer, no "ไม่ใช่ X แต่ Y" for weight, "คอมพิวเตอร์" and never a bare "เครื่อง", no "ครับ", no emoji, no em dash, a space on both sides of ๆ, and **every English
word in Thai text starts with a capital letter** (Dimension, Shuffle, Partition), except code in backticks, urls and quotations.
Technical terms stay English. Labs follow the same rules: their `th:` strings are Thai text too (short labels only need capital letters and spacing).

The lint is strict about identifiers in the props of a quiz (`q=`, `options=`, `why=`), where backticks do not render: `total-records`, `operation`, `main`. Run
`python .claude/skills/create-learning/scripts/fix-capitals.py <files>` to capitalise what the lint names, and reword by hand what is left ("ตาราง Snapshots",
"ค่า Total Records"). A line that is clean for the linter is not yet natural Thai: read the result as the owner would, and say in the hand-back that no
person has read it.

For English text use `/humanizer:humanizer` when it is available; keep the English plain, the same facts, the same Step count (section 5).

## 4. Labs (animations)

**A subject without labs is not finished** (see `lab-craft.md`, "How many labs"). The owner compares every subject with Spark, which has twenty-four, and asked
"ทำไมมันไม่มี Lab เลย มันอ่านแล้ว งง ไม่เห็นภาพ". Build the labs in the same pass as the lessons. But a lab is worth building only if it shows what a sentence or a table
cannot. The owner has rejected labs that "do not say anything more" (an architecture picture to click, a "type the commands yourself" box): those were replaced by tables. Before building, answer:

1. What will the reader **see change** when they press something, and what will they **conclude** from it?
2. Could a small table do the same job? Then write the table.
3. Does **every control change the picture**? A switch that leaves the picture the same (CSV with any column picked still reads the whole
   file) is a bug in the design. Fix the design, not the label.
4. Is the **title an instruction plus a promise**: "เลือกคอลัมน์ที่ query ต้องใช้ แล้วเทียบว่า CSV กับ Parquet ต้องอ่านจาก disk เท่าไร"?
5. Is it **readable** (text of 14 units or more, plain names next to technical ones, a legend, the sentence of each step in the picture) and does it follow the figure of the
   owner's book where there is one? These rules are in `lab-craft.md`, "Readability". A lab that passes the audit and is still hard to read is not done.

The craft (clock and step players, scene drawing, states and legends, side by side instead of flipping, made-up versus measured numbers,
layout limits, bilingual text, the shared pieces `ib.tsx`, how to test) is in [references/lab-craft.md](references/lab-craft.md). Read it before writing a lab.

**Verify a lab by looking at it**, as the reader. The earlier Spark checks passed on numbers, clicks and overflow and still missed that a lab said nothing, and later found
text and dots covering each other in seven labs; the first Iceberg labs passed the audit and were still too small and too crowded. Run `scripts/lab-audit.py`, then
`scripts/lab-steps.py` for the steps with the most text, the last step, every option, in Thai and in English, and **open the images**.

## 5. English version

`lessons-en/<id>/...` with the same slugs, `order`, `phase`, `level` and `requires`, the same Step count, `lang="en"` on every `<Question>` and every
lab, and the `en` block in the subject JSON (name, tagline, category; description and phases when translated). Do it in the same pass as the Thai, lesson by
lesson or right after a phase, not as a later project. Labs hold their text per language (`TEXT` with `th` and `en`) and take a `lang` prop. English is
usually longer: check the labs again in English for text that no longer fits.

Cross-links use the **English** heading's slug: choose the English headings first when a Thai heading is the target of a link (`#when-two-writers-collide`), and let
`check:refs` fail on a wrong one. Then `npm run sync` records the pair as in step (it starts every new pair as "in step"; after that it tells you which language moved alone).
Check that no Thai character is left in `lessons-en` (a quick script is enough).

## 6. A new subject

1. `site/src/content/subjects/<id>.json` (copy a close one: `name`, `tagline`, `description`, `category`, `order`, `accent`, `accentDark`,
   `phases` with a `check` question each, and the `en` block).
2. `site/src/content/lessons/<id>/` and `lessons-en/<id>/`, every lesson, each with a quiz.
3. `subjects/<id>/code/` as its own `uv` project (pin the version of the thing you teach), with `verify.py`; `subjects/<id>/docs/` with
   `overview.md`, `sources.md` (include the books and the source checkout), `verified-findings.md`; `subjects/<id>/graphs/` if you built one.
4. `site/src/components/labs/<id>/` for its labs (reuse `components/labs/iceberg/ib.tsx` and the `ib-` classes).
5. Add the subject to "Current subjects" in CLAUDE.md (what is in it, how it is verified, and **what was not checked**), and the
   `tools/lesson-refs.mjs` subject list if the subject names books or other subjects. Add the `CHANGELOG.md` entry.

## 7. Check (all of it, from `site/` unless said)

- `node ../.claude/skills/thaihumanize/scripts/thai-lint.mjs <thai files>`: no `warn` (use `fix-capitals.py` first), every `info` looked at.
- The exercises: `uv run python verify.py` in `subjects/<id>/code/` (inside WSL for the subjects that need it).
- `npm run check:refs`: 0 mentions that are not links, no dead link or heading.
- `npm run sync -- --check`: nothing behind, or say which pages are. `npm run sync` once for new pairs.
- `npm run build`: passes (it also fails on a `requires` that points nowhere or a sub-page without a main page).
- Serve the build (`npm run preview -- --port 4399`) and run, with the Windows notes of `exercise-craft.md` in mind:
  - `scripts/crawl-pages.py <id>`: every page, Thai and English, at 1280 and 390 px: no script error, no sideways scroll. **Look at a lesson cover too** (it found a literal backtick in a `summary`).
  - `scripts/lab-audit.py <pages>` (add `--channel msedge` if Chrome is missing) and `scripts/lab-steps.py` for the states that matter; open the screenshots and read them.
- Look at a few pages as a reader: step mode and long mode, light and dark, a phone width. Say in the hand-back what you did not look at (the light theme, a real phone).
- Stop the preview server when you are done.

## 8. Hand back

Report in a few lines: what was built (files), how each claim is backed (counts of ran, source, book, author), what is **not** run or not
looked at (and why: a server that does not exist here is a reason, "it was a lot of work" is not), what you would do next, and what is uncommitted.
Name the owner's book and which of its figures you could only read about. `CHANGELOG.md` and CLAUDE.md are already updated. Ask whether to commit; push only when told to.
After the owner has read it, their notes in the page (`/audit`) are the next round.
