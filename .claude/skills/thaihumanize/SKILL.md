---
name: thaihumanize
description: Write or rewrite Thai lesson text in the owner's own voice (learned from their Medium blog and from their hand edits to the Spark overview page) so it does not read like AI. Use when the owner says /thaihumanize, asks to fix Thai wording, or when you are about to write more than a few sentences of Thai for the learning garden.
---

# thaihumanize: Thai in the owner's voice

The owner writes a data engineering blog on Medium (as "DEarm", signs as อาร์ม). On 2026-11-10 they asked for their style to be
captured so that the Thai text of the learning garden sounds like them and not like a model. This skill is that style, plus the
list of things that made earlier text read as AI. The long version, with quotes from the blog, is in
[references/blog-voice.md](references/blog-voice.md). Read it before you write more than a paragraph.

The owner's own edits are the final word. When they have rewritten a passage by hand, copy what they did, and never overwrite it.

## What to do

1. **Find what must not change.** Facts and numbers, links (`[บท 7](/spark/performance-tuning/#...)`, `[text](url)`), code and
   backticks, `<Step>`, `<Callout>`, `<Question>` props, frontmatter keys, heading text that other lessons link to (the id comes from it,
   see "Links between lessons" in CLAUDE.md). Rewriting is about how it is said. Never add a fact, a number or a claim that the source
   did not give. If a sentence needs something you do not know, write a simpler sentence or ask.
2. **Say it the way the owner would say it to a colleague who is one step behind** (next section).
3. **Run the check:** `node .claude/skills/thaihumanize/scripts/thai-lint.mjs <files>` (from the repo root). Fix every `warn`,
   and look at every `info` and decide. It finds patterns, it cannot tell you that the text sounds natural, so read the result aloud
   in your head once more.
4. **Housekeeping for lessons.** `npm run check:refs` and `npm run sync -- --check` (from `site/`). A pure wording change in Thai
   that leaves the meaning alone is recorded with `npm run sync -- --accept <page> <units>`; a change of meaning must be followed
   in `lessons-en/` first. English text is not this skill's job (use `/humanizer:humanizer`).
5. **Say what you did** in a few lines, and name anything you were unsure about. Do not commit unless asked.

Two modes. With a file or a lesson name, edit that file in place (prose only). With pasted text, return the rewrite.

## The voice

A data engineer who has just worked something out, telling a friend who is a step behind. They try it, look at the result, then explain.

- **"เรา", not a lecture.** "เรามาลองพิสูจน์กันดูว่า...", "เราจะเห็นว่า...", "ถ้าเรา...". For the reader alone use "คุณ"; "พวกเรา" is fine
  (the owner wrote it themselves). Do not write "ผู้เรียนจะได้..." or "ผู้อ่านควร...". "ผม" appears only when the owner says
  what they personally think or tried.
- **Whole clauses with connectors.** Thai that has subjects, verbs and the little words between clauses: ซึ่ง, โดย, แต่, เพราะ,
  เพราะฉะนั้นแล้ว, ยกตัวอย่าง, ถ้าหาก, สำหรับ, สามารถ...ได้, แล้วถึง, จะเห็นได้ว่า, ซึ่งแน่นอนว่า. The owner's sentences are longish and flow
  from one clause to the next. They are not clipped noun phrases.
- **Questions the reader is thinking.** "เอ๊ะ? ทำไมถึงเขียนแบบนี้กันนะ", "รู้หรือไม่ว่า...", "แล้วจะเกิดอะไรขึ้นกับ...",
  "ตรงนี้อยากให้ตั้งคำถามในใจกันหน่อยว่า...". Ask it, then answer it.
- **Show, then explain.** Run it or draw it, point at the result ("จะเห็นได้ว่า Object ID เท่ากัน"), and only then name the concept.
- **A picture from daily life.** A box for an object, a recipe for a lineage, an atom for Atomicity, a bank clerk and a power cut
  for a transaction. Give the example a small story with a name (นาย A) and something that goes wrong.
- **Point forward and back.** "เดี๋ยวเราจะมาคุยกันต่อในหัวข้อถัด ๆ ไป", "ขอย้อนความสักนิด", "จำ Keyword นี้ไว้นะ". In the garden these are links to the lesson.
- **A person is in the room.** A short aside in brackets, a hedge that is honest ("ไม่ได้ลงรายละเอียดเพราะจะลึกเกินไป", "ผมไม่ใช่
  Expert"), a confession that something was confusing, a light joke ("โดนนาย A ด่ากระจุย"), "นะ" at the end of a note, "อะนะ", "หน่ะ".
  Use them where the owner would, a few per page, never in every paragraph.
- **Spacing of ๆ.** The owner always writes a space on both sides: "ต่าง ๆ", "ง่าย ๆ", "ไปเรื่อย ๆ", "หลาย ๆ", never "ต่างๆ".
- **English terms stay English, and every English word starts with a capital letter**, in headings and in running text: Dimension, Row, Column, Partition,
  Shuffle, Consumer, Pipeline (the owner decided this on 2026-11-10; the blog does the same: "ทำการ Clone Git Repository", "Query ข้อมูล", "Worker ตัวอื่น").
  Left as they are: anything in backticks (code, identifiers, file names), words inside a quotation from a book, links and urls, and a run of three
  or more English words that is a phrase (a quote or a title). Thai grammar goes around the English term ("ทำการ", "ถูก ... ไป").
- **List items that start with the term.** For pros and cons or the parts of something, the blog writes the English term first and the Thai
  explanation right after it, with no bold: "Lightweight ไม่ต้องการ Resource เยอะ", "Scalability เนื่องจากถูกแยกออกมาเป็น Server ของตัวเอง...". The explanation is a clause, not a fragment.
- **Say when it is your guess.** "ส่วนตัวอาร์มคิดว่าปัญหาน่าจะอยู่บน Layer ... เพราะว่าลองตรวจสอบ ... แล้ว", then "อีกเหตุผลหนึ่งที่คิดว่าเป็นแบบนั้น". Opinion and
  what was checked are kept apart. (In the garden this sits next to the source labels หนังสือ, รัน, ผู้เขียน.)
- **Sequence markers in bold.** "**ขั้นตอนแรก** ...", "**ขั้นตอนต่อมา** ...", "**ขั้นตอนสุดท้าย** ..." at the start of a paragraph is the owner's own habit.
- **"เพื่อน ๆ", "ทุกคนลองนึกถึง..."** when asking the reader to picture something; in lessons "คุณ" or "เรา" does the same job.

## What the garden changes

The blog is written for Medium readers, the garden is a set of lessons the owner reads again later. Keep the voice and drop the blog packaging.

| In the blog | In a lesson |
|---|---|
| "Hi สวัสดีครับทุกคน วันนี้เราจะมา...", 👋👋 Welcome Back 👋👋 | No greeting. At most one warm opening line on the first Step with a reason that belongs to the reader. Never an opener on every Step, and never a line that announces what the page will do ("ที่เหลือของหน้านี้ตอบคำถามเดียว"): the owner deleted exactly that. |
| ครับ, นะครับ, ขอบคุณครับ | No ครับ in the body. "นะ" in a note is fine. |
| Emoji after most paragraphs, emoji as list markers | None by default. At most one in a Callout or a playful aside. The owner has not asked for emoji in lessons; ask before adding more. |
| 555, สแลงแรง ๆ | Light humour only. |
| Mind map image, Medium GIFs | Labs and figures of the site. |
| "Conclusion" paragraph, then a reference list | A short recap only when the page is long. The sources section of the page stays as it is. |
| Capitalised English in the body ("Concept", "Function") | The same: capital letters everywhere (decided 2026-11-10). |

## What made earlier text read as AI (and the owner fixed by hand)

- **Telegraphic noun phrases with no connectors.** "มันไม่ใช่ database ข้อมูลอยู่ที่อื่น ... Spark มาอ่าน แบ่งเป็นก้อน" became, in the owner's
  hand, full clauses: "มันเองไม่ใช่ database สำหรับข้อมูลจะถูกเก็บเอาไว้ในรูปแบบอื่น ... ให้คอมพิวเตอร์หลายเครื่องสามารถช่วยกันประมวลผลข้อมูลได้ แล้วถึงรวมผลลัพธ์".
- **"ไม่ใช่ X แต่ Y"** and "X ต่างหากที่ช่วย". State Y.
- **A colon after every lead-in**, and a bold label at the start of every list item. Write the sentence. Use a list only for a real
  enumeration (steps, the four parts of ACID), not for reasoning that has "because" in it. Reasoning goes in paragraphs.
- **A line that announces or sums up**: "ที่เหลือของหน้านี้...", "ข้อสรุปที่ถูกต้องคือ...", a closing line that repeats the paragraph.
- **A bare "เครื่อง"** ("เครื่องเดียว", "หลายเครื่อง", "เครื่องที่ล้ม"): the owner asked "เครื่องเดียวของนายเนี่ย พูดถึงอะไร". Write
  "คอมพิวเตอร์เครื่องเดียว", "คอมพิวเตอร์หลายเครื่อง", "คอมพิวเตอร์ที่ล้ม". ("เครื่องมือ", "เครื่องคำนวณ" are fine.)
- **Dry report voice** ("ผู้เขียนบทเรียนไม่ได้วัดเอง" became "...ไม่ได้วัดเองนะ"). Talk to the reader.
- Typos: "คุณเป็นเขียน", "งานงาน". Read what you wrote once more.

## Checklist before you hand it back

- Would อาร์ม say this to a colleague at the next desk? If a sentence sounds like a report or a slide, say it again with เรา and a connector.
- No fact, number or link was lost or invented. No heading that other lessons link to was renamed (or the links were changed and `check:refs` passes).
- The lint prints no `warn`. Every `info` was looked at.
- The owner's own sentences are untouched.
