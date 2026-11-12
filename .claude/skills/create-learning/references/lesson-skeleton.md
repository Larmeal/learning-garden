# Lesson skeleton

Copy the nearest existing lesson (for a runnable subject: `site/src/content/lessons/pydantic/first-model/index.mdx`; for labs:
`lessons/spark/foundations/index.mdx`; for a quiz: `lessons/pydantic/first-model/quiz.mdx`) and change it. This file lists what every page needs.

## Files

```
lessons/<id>/<slug>.mdx                 one page
lessons/<id>/<slug>/index.mdx           main page of a lesson with sub-pages
lessons/<id>/<slug>/in-depth.mdx        a deep dive (kind: deep, the default)
lessons/<id>/<slug>/quiz.mdx            the quiz (kind: quiz, order: 99)
lessons-en/<id>/...                     the same paths and slugs in English
```

A page with sub-pages has its main page in `index.mdx` (`order`, `phase`, `level` are read from it). A sub-page without a main page fails
the build. `requires` lists slugs of lessons of the same subject (and the English folder must have them too).

## Frontmatter

```yaml
---
title: Model แรก            # in Thai headings and titles every English word starts with a capital letter
summary: BaseModel เปลี่ยน Type Hint ให้เป็นการตรวจข้อมูลจริงตอนสร้าง Object ...   # plain text, no markdown, no lesson numbers
order: 1                     # the number the page shows (Spark, GE, guitar, music-theory start at 0, others at 1)
phase: A                     # a phase id of the subject JSON (main pages only)
level: 1                     # 1 to 5 (main pages only)
stage: sprout                # seed (outline) | sprout (usable) | evergreen
format: steps                # steps = written with <Step> cards, read = one long page
requires: [first-model]      # slugs, main pages only
updated: 2026-11-12
---
```

Quote a title that contains a colon. The editor in `astro dev` checks the frontmatter against the schema in `site/src/content.config.ts`.

## Body

```mdx
import Step from '../../../../components/Step.astro';
import Callout from '../../../../components/Callout.astro';
import Question from '../../../../components/Question';
import FormatLab from '../../../../components/labs/spark/FormatLab';
```

`index.mdx` inside a folder is four levels below `src/` (`../../../../`), a single page `<slug>.mdx` is three (`../../../`).

```mdx
<Step>

## ปัญหาที่เห็นก่อน

(real rows, a command and its output, or a number from an exercise)

```python
Row(id="not a number").id    # 'not a number'
```

(one sentence per line of code: what it does and what you see)

(the idea, named after the reader has seen it)

<Callout type="tip" title="ทางลัด">...</Callout>      {/* tip | warn | try | note */}

</Step>

<Step>

## Lab ที่ช่วยให้เห็น

(one or two sentences on what to press and what to look for)

<FormatLab client:visible />                           {/* English file: <FormatLab client:visible lang="en" /> */}

</Step>

<Step kind="question">

<Question
  client:visible
  q="..."
  options={['...', '...', '...']}
  answer={1}                                           {/* index in options */}
  why="..."                                            {/* teaches: say why the right one is right and what the wrong ones assume */}
/>

</Step>

<Step>

## ที่มาของบทนี้

| ข้อความ | ที่มา |
|---|---|
| Class ธรรมดาและ Dataclass ไม่ตรวจ Type Hint | รัน: `exercises/01_first_model.py` |
| `model_validate_json` ให้ Parser JSON ส่งค่าเข้า Validator โดยตรง | Source: `input_json.rs` ใน Knowledge Graph |
| ตัวเลือกการใช้ `model_fields_set` กับ PATCH | ผู้เขียน |

</Step>
```

Rules of the MDX that broke pages before:

- Do not put a `\"` inside a `q="..."` of a `<Question>`. A link `[text](/path/)` works in `q`, `why` and a `Callout` title, never in `options`
  (they sit inside buttons: reword so that no option names a lesson).
- English files pass `lang="en"` to every `<Question>` and every lab.
- A heading's id is its slug (lower case, spaces to hyphens). Other lessons link to it: renaming it needs `node tools/lesson-refs.mjs --backlinks <page>` first.
- A lab that a question depends on must come before the question; a question card gates the next card in step mode.

## The quiz page

`quiz.mdx`: `kind: quiz`, `order: 99`, `format: steps`, one `<Step kind="question">` per question, about five. Test understanding, not
memory: ask what happens in a small case, give wrong options that come from a real misreading, and let `why` correct the misreading. Do not
repeat a question that a card of the lesson already asked.

## The subject JSON

```json
{
  "name": "...", "tagline": "...", "description": "...", "category": "...", "order": 7,
  "accent": "#C93F0A", "accentDark": "#FF8A4C",
  "phases": [{ "id": "A", "title": "...", "check": "a question the learner can answer after the phase" }],
  "en": { "name": "...", "tagline": "...", "category": "...", "description": "...", "phases": [ ... ] }
}
```

`category` groups subjects on the home page and is not a folder. The id is the file name and never changes.

## Evidence files of a subject

- `subjects/<id>/docs/verified-findings.md`: a table of lesson, claim, tag (ran with the exercise number, source, book, author). It starts with the
  definition of the tags and the version that was tested.
- `subjects/<id>/docs/sources.md`: books with their page offsets, papers with links, the tag or commit of any source tree.
- `subjects/<id>/code/verify.py` (or `verify.mts`): re-runs everything and checks the versions.
