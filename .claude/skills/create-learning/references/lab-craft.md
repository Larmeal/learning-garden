# Lab craft: animations that teach

Labs live in `site/src/components/labs/<subject>/`, one React file each, loaded in a lesson with `client:visible`. The Spark labs
(`components/labs/spark/`) are the reference: `timeline.tsx` (clock), `stepper.tsx` (steps), `scene.tsx` (boxes and messages).

## Decide what the lab is for

Write these four lines in a comment at the top of the file before writing any code, and keep them true:

```
// Shows:      what the reader sees change
// Because:    why that cannot be a table or a sentence
// Control:    each control, and what it changes in the picture
// Conclusion: the one thing the reader should be able to say afterwards
```

Lessons from the owner's reviews (2026-11-06 and 2026-11-12):

- **A picture that only repeats the text is noise.** ArchitectureLab ("press each part to see its job") and PipelineStagesLab ("type the
  commands yourself and watch the stages") were deleted and replaced by tables, one of them classifying shuffle and no-shuffle with a "why"
  column. If the lab would be a clickable table, make the table.
- **Every control must change the picture.** The first FormatLab had a CSV/Parquet switch and a column picker. With CSV selected, the
  picker changed nothing (CSV reads every cell anyway), so most of the clicks taught nothing.
- **Put the two things you compare next to each other.** Do not make the reader flip a switch and remember the other state. The new
  FormatLab draws CSV and Parquet side by side and lets one column picker drive both.
- **Name every state and give a legend.** Cells are "read and used", "read but thrown away" (hatched), "not read" (dashed). A reader
  should never have to guess what a colour means.
- **Show the measure in the picture.** "Read 20 of 20 cells" next to "Read 5 of 20 cells" says more than a paragraph.
- **A play button makes a difference visible over time** (both files read at the same speed, so one finishes first). Use motion for
  something that happens in time: order, speed, who waits for whom. Do not animate for decoration.
- **The title is an instruction plus a promise**: what to press and what you will see.
- **Say what is measured and what is an example.** The caption lists which numbers come from an exercise (with the file) and which are
  made up to fit the picture. A drawing with 6 dots standing for millions of rows says so.

## Two kinds of lab, and when to use them

| Kind | Use it for | Built with |
|---|---|---|
| **Clock lab** | a process in time: who sends what to whom, in what order, and how long each part takes | `useClock(duration)` plus `ClockControls` (play, slider, speed, jump to a moment) |
| **Step lab** | a short sequence where each step has a sentence of explanation | `useStepper(count)` plus `StepControls` |
| **Controls and picture** | choose inputs, see the result (a join picker, the CSV and Parquet comparison) | `useState`, the `.seg` buttons, a readout line |

### Clock lab

A clock lab draws itself as a **pure function of the time `t`**. Nothing is stored between frames, so the reader can drag the slider back
and see the same moment again.

```tsx
const clock = useClock(DURATION);          // t, playing, speed, seek, play, pause, restart
const { t } = clock;
const a = smooth(prog(t, 2.0, 3.0));       // 0 before 2 s, 1 after 3 s, eased in between
const x = mix(startX, endX, a);            // a dot that travels
const marks: Mark[] = [ { at: 0, name: 'เริ่ม', title: '...', text: '...' }, ... ];   // one per moment worth a sentence
...
<ClockControls clock={clock} marks={marks} lang={lang} />
```

- Each mark is a moment with a **name** (the jump button), a **title** and a sentence in the "now" box. Write them like a teacher
  narrating the picture, and keep them in step with what is drawn at that moment.
- **Scenes of boxes and messages** (driver, executor, cluster manager; a handshake) use `SceneSvg` with `SNode`s (`at`, `until`, `dimAt`,
  `crossAt`, `status`) and `SMsg`s (`from`, `to`, `at`, `n` for the number in the circle, `label`, `offset` to separate two lines
  between the same boxes, `p0` and `p1` for explicit end points). Number the messages so the order reads without the text.
- **Rows as dots.** Draw each row (or a group of rows, and say so) as a moving dot. People follow a dot they can see leave one box and
  arrive in another.
- `useClock` starts by itself and respects `prefers-reduced-motion` (it does not autoplay). Also offer a still view: the picture at the end of the
  clock must be understandable without playing.
- Restart the clock when a control changes the scenario (`clock.restart()`).

### Step lab

`useStepper(count)` with an array of `{ name, title, text }`, the picture a function of `step`. Use it when there is no meaningful
time, only a sequence of states.

### Controls and picture

Keep the state in `useState`, derive everything else from it (no effects that copy state). Group related buttons in `.seg`
(`aria-pressed` on each button), put a `readout` line under the picture with the numbers, and the `viz-caption` last. For something that
has to run over time inside such a lab, add a small play button and drive it with an interval, as FormatLab does.

## Bilingual, always

```tsx
const TEXT: Record<Lang, { title: string; ... }> = { th: { ... }, en: { ... } };
export default function MyLab({ lang = 'th' }: { lang?: Lang }) { const T = TEXT[lang]; ... }
```

Both languages are written together, not translated later. Thai text follows `/thaihumanize` (capital letters on English words, `คอมพิวเตอร์`,
whole clauses, no em dash). English text runs longer: draw for the longer string. Function-valued entries (`read: (n, total) => ...`) keep
the numbers and the grammar of each language apart. Never use a string that you also compare with as a key.

## Layout limits that bit before

- The SVG has a `viewBox` of 880 units wide and scales to the column (about 730 px on a desktop, so 0.83). `.viz-box svg` has `min-width: 700px`, and
  on a phone the box scrolls sideways (with soft shadows on the side that has more). Text below 12 units reads as 9 to 10 px on a desktop:
  keep labels short and at 12 units or more where you can.
- **Keep the path of moving things away from text.** Seven Spark labs had a dot or a label that crossed a title, a caption or a file name at
  some moment of the animation (a merge label over a group title, dots falling through an executor title, a "fork" label under a dashed
  line, two step numbers on the same spot). Place labels where nothing travels, or let the moving thing start close to its place.
- **Two lines between the same boxes need an `offset`.** Two numbered circles at one point hide each other.
- A switch that makes the text longer can push a line under another one: check every option, not only the default.
- On a phone (390 px) the page must not scroll sideways: only `.viz-box` may.
- Use the colour tokens, never fixed colours: `var(--k1)`, `var(--k2)`, `var(--k3)`, `var(--accent)`, `var(--accent-soft)`, `var(--surface)`,
  `var(--line-strong)`, `var(--muted)`, `var(--fg)`, and `var(--on-key)` for text on a key colour. Light and dark themes both work only if you do.
  SVG helper classes: `.band`, `.box`, `.box.on`, `.zone`, `.ln`, `.k1` to `.k3`, `.fx-hot`, `.fx-file`, `.fx-ring`, text classes `.b` (bold), `.s` (small),
  `.m` (mono), `.acc`, `.dl` (label on a key colour), `.num`. A clock lab has class `viz lg` for larger text.
- HTML blocks: `.viz` (figure), `.viz-title`, `.viz-box`, `.viz-steps` (pill buttons), `.viz-now`, `.viz-controls`, `.viz-caption`, `.lab-controls`,
  `.lab-label`, `.seg`, `.readout`, `.mini-tbl` in `.tbl-wrap`, `.stack`, `.btn` (`primary`, `sm`). If a lab needs its own CSS, prefix
  every class with a short name for the lab (`fl-` for FormatLab) in `global.css`.

## Verify it as a reader

Checking the numbers and the clicks is not enough: the first FormatLab passed on numbers, clicks and overflow and still taught little. Do all of these.

1. Open `astro dev`, scroll to the lab, and use it as a stranger would: read the title, press things, read the "now" box.
   Ask the four questions of SKILL.md section 4. If you cannot say the conclusion in one sentence, the lab is not done.
2. Run the audit (needs Python with Playwright and a Chrome or Chromium; the dev server must be running):
   ```
   uv run --with playwright python .claude/skills/create-learning/scripts/lab-audit.py /spark/foundations/ /en/spark/foundations/
   ```
   In Git Bash put `MSYS_NO_PATHCONV=1` in front, or it rewrites `/spark/...` into a Windows path (the script undoes that too). Start the dev server first
   (`astro dev --background` in `site/`). Use `--out <folder>` to keep the screenshots somewhere you can find them.
   It takes screenshots of every lab on the pages (into a temp folder it prints), clicks every option group and reports a group
   whose buttons all give the same picture, clicks every step of every option and reports text that overlaps other text, loads each page at
   390 px and reports sideways page scroll, and prints page errors. Open the screenshots and look at them. A `NO VISIBLE EFFECT` line
   is either a control that does nothing (fix it) or a control that only changes something on a later step (check by hand).
3. Look at the **English** page as well, and at the light and dark themes.
4. State in the hand-back what you looked at and what you did not.

## Readability: what the owner said about the first Iceberg labs, and the rules that came out of it

The first seven Iceberg labs passed `lab-audit.py` (no overlap, every control changes the picture) and the owner still said they were
"อ่านยาก งง ไม่เห็นภาพ ไม่เหมือน spark". Passing the audit is the floor. What was wrong, and what to do from the start:

1. **Text was too small.** The SVG is 880 units wide and shows at about 0.83, so 11-unit text is 9 px. Use **14 units or more** for anything the
   reader must read (16 for the name of a box, 18 for a title, 34 or more for a number that is the point). If it does not fit, cut words
   or boxes, do not shrink the text.
2. **Too many things at once.** A reader takes in about a dozen boxes. If the real structure has more (8 manifests and 8 files), draw it
   as a regular grid with short labels (`m1`, `d1`), and let colour say what matters. If a lab has three jobs, make three labs or hide the second
   job until the step that needs it.
3. **The vocabulary was not in the picture.** Every box carries a **plain-language name** (the everyday picture of the lesson: "สารบัญ",
   "ป้ายบนชั้น", "หน้ากระดาษ") **and** the technical name under it (`metadata.json`). The column headers of a diagram do the same. A reader
   should never have to remember which term is which.
4. **No legend, no colour language.** Use one language in every lab of a subject and print it above the figure (`Legend`): *new* (filled,
   accent border, a "ใหม่" tag), *in use* (accent border), *skipped* (dashed and faded), everything else plain. Add a fourth state only
   if the lesson needs it. Success and refusal need two colours that are not accent (use the `--ib-bad` token) **and** a symbol (✓ ✗), so
   they survive colour blindness.
5. **The sentence for each step was only below the picture.** Put a one-line banner or a short label **in** the picture ("Manifest List บอกว่าข้าม 6
   จาก 8 Manifest ได้เลย"), and keep the longer explanation in the "now" box. Number the arrows that make an order (1 to 7), as the book does.
6. **Do not nest `.seg` inside `.lab-label`.** `.lab-label` is small, mono and upper case, so the options inherit it ("FILTER ของ QUERY",
   "ORDERED_AT"). Put a plain label (`ib-lbl`) next to the `.seg`, or use the `ib-controls` row.
7. **Wrap text yourself.** SVG does not wrap. Use `Lines`/`wrapText` from `components/labs/iceberg/ib.tsx` (a character budget per line) for any
   string longer than about 25 characters, and check the English, which is longer. A string that sits near an arrow or a box edge in Thai will
   cross it in English.
8. **Hide what has not happened yet, show what is about to.** A ghost box (dashed, faded) for a file that will be written at step 5 tells the reader the
   whole plan at step 1. A reader's view that has not changed yet should say so ("ยังไม่ได้อ่าน Snapshot 2"), not show the old value as if it were new.
9. **Draw layers as the book draws them** when the owner has a book on the topic (see `exercise-craft.md`): the same bands, the same numbered steps.
   The Iceberg labs use three bands (catalog, metadata, data) from the book's figure 2-1.

### Shared pieces (do not start from a blank file)

`site/src/components/labs/iceberg/ib.tsx` has `Legend`, `Node` (a box with a plain title, a technical subtitle, a state and a tag), `Num` (a numbered
badge), `Banner` and `Lines` (word wrap). The classes `ib-*` at the end of `site/src/styles/global.css` give the colour language and the text sizes.
For a new subject, import them (they are not specific to Iceberg) or copy the file next to the subject's labs and rename the prefix. The step player
(`StepControls`, `useStepper`) still comes from `components/labs/spark/stepper.tsx`.

### Verify in more than the default state

`lab-audit.py` photographs each lab once, at step 1, in the default option. Also run `scripts/lab-steps.py` on **the step with the most text, the last step, each
option, and the same in English**, then open the images. Look at the lab at the width a reader sees (about 730 px): a picture that is clear at 1400 px can be unreadable at
730. Ask the four questions of SKILL.md section 4 once more with the images in front of you, and ask a fifth: *could a person who has not read the lesson tell what is
happening from the picture alone?* If not, it is not done.

### How many labs

Plan labs in step 1 of SKILL.md, one for each idea that is a **path, a layering, an order, a pointer that moves, or a choice with a visible
consequence**. For the Iceberg subject that came to seven for fourteen lessons (the three layers growing, the write path, two writers racing, the
read path, which files a filter skips, copy-on-write against merge-on-read, snapshots with a tag and a branch), and the owner still wanted them before
the first hand-back. Spark has twenty-four. A subject with none is a subject that was not finished.

## One picture per operation, with the real content of every file (UnderCoversLab)

On 2026-11-12, after the labs were rebuilt for readability, the owner pointed at the Dremio guide on Iceberg and said they wanted "คำอธิบายและรูปภาพที่ interaction ได้เหมือนกับอันนี้".
What that guide does and the labs did not: **one running table**, taken through each operation in turn (create, insert, merge, select, time travel, compaction), each with a **numbered sequence** and
a picture, and the **real content of the files** (a `metadata.json`, a manifest list, a manifest) next to it. A lab that only shows boxes tells the reader that files exist, not what is in them.
What was built (`components/labs/iceberg/UnderCoversLab.tsx`, page `lessons/iceberg/table-anatomy/under-the-covers.mdx`) and how to repeat it for another subject:

1. **Dump the evidence, then draw it.** An exercise (`exercises/15_under_the_covers.py`) runs the operations, reads every file from disk (not through the engine: `json`, `fastavro`, `pyarrow`),
   asserts what it found, and with `--write` saves the lot as JSON next to the lab (`underCovers.json`). The lab imports that JSON, so no number in the picture is invented. Give files short stable names
   (`a1`, `m1`, `s1`, `v1`) in the order they are first seen, and print the map. Keep ids that are bigger than 2^53 (snapshot ids) as **strings** in the JSON, or `JSON.parse` rounds them.
2. **One component, an `op` prop.** The page has one Step per operation and puts `<UnderCoversLab op="insert1" />` in it. The component holds, per operation, a list of step specs (which boxes are
   written, reused, used, skipped, where the pointer is) and the text of each step for both languages. Writing operations show a ghost (dashed) box for a file that is not written yet; reading operations
   fade what the reader has not reached yet and mark what is cut out. Edges are drawn only between boxes that exist, in the accent colour when they belong to the step.
3. **Click to inspect.** Every box is a button (`role="button"`, `tabIndex`, Enter and Space); the selected one gets a dashed ring and its content appears in a table under the step player: field, value, what it
   means. Each step has a default selection (the file it creates), reset when the step changes. A data file shows its rows.
4. **Step buttons need short names.** `StepControls` prints `{i}. {name}` on each button, so give each step a short `name` ("Manifest", "Swap pointer") and keep the long numbered sentence in `title`. A first
   version used `s1` as the name and the buttons read "1. s1".
5. **Page shape.** An opening Step with the running example, the five columns and the two ways to use the picture (Next, and click a box) plus the two or three rules that every operation follows; then one Step per
   operation with the lab, then two or three paragraphs that say **what to look at and why** (not a repeat of the step texts); a Question after the operations that surprise (what does a reader see if the writer
   crashes before the pointer moves; why is a file not deleted after compaction); a closing table of the numbers per operation; sources. Every lab step text is one or two sentences; the page explains, the lab shows.
6. **Run the checks end to end once:** `crawl-pages.py`, `lab-audit.py` on the page and `lab-steps.py` on the last step of each operation in Thai and English, and open the images. This turned up a badge
   that overlapped a title (the tag on `Node` now sits 4 units higher), a caption that said "below" when the panel is above it, and a dashed selection ring that used a variable that does not exist (`--text`; the tokens are `--fg`, `--muted`, `--line`).
7. **A second dataset is a prop, not a second component.** `UnderCoversLab` takes `op` and picks one of three datasets (`uc`, `cow`, `mor`, each its own JSON from its own exercise). New kinds of file (delete
   files, delete manifests) were added by giving entries a `content` and the component a title and a count for them. The number of rows in the picture is the tallest step of the operation, so the picture does not
   jump. Mark what is wrong but harmless (a dangling delete file) with a tag ("left over") and say so in the step text. A helper that builds the steps of any write (`writeOp`) keeps each operation to a few lines;
   do not name a helper `W` when the file already has a width constant `W` (the build fails, `tsc` did not say so).

