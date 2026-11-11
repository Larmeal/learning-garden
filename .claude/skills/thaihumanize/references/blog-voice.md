# The owner's voice: what the blog shows

Source: eight Medium posts by Chutdanai Thongsom ("DEarm"), 2023 to 2025 (ACID parts 1 and 2, PySpark reduceByKey, MongoDB with PyMongo,
Garbage Collection in Python, Lazy Evaluation in Spark, OLTP vs OLAP, ComfyUI), clipped with Obsidian into `tmp/writer_style/` (git-ignored). Two more clippings
(DuckDB, DAG Factory) hold no text and were not used. About 55,000 Thai characters. Highlighted passages (`==...==`) in the clippings are other readers' Medium highlights,
not the author's emphasis, so ignore them. The quotes below are short and are the owner's own words.

What this is not: a measure of how the owner writes lessons. It is how they write a blog post for readers on Medium. The two hand edits to the Spark overview page
(2026-11-08) are the only direct evidence of the voice they want in lessons, and they agree with the blog on the points that matter.

## Two more posts, read on 2026-11-10 (DuckDB, DAG Factory)

- Pros and cons as lists that start with the English term, no bold: "Lightweight ไม่ต้องการ Resource เยอะ เหมาะกับงานที่มีการ Process ข้อมูลที่ไม่หนักมาก".
- A guess is labelled: "ส่วนตัวอาร์มคิดว่าปัญหาน่าจะอยู่บน Layer การทำงานที่อยู่บน Python เพราะว่าลองตรวจสอบ Execution Plan ของทั้ง 2 วิธีดูแล้ว มันเหมือนกันทุกอย่าง".
- A step-by-step explanation of a plan uses bold sequence words: "**ขั้นตอนแรก** DuckDB จะพุ่งเป้าไปสแกนที่ Column `Date` ...", "**ขั้นตอนต่อมา**", "**ขั้นตอนสุดท้าย**".
- Questions to the reader: "ทุกคนลองนึกถึงเวลาที่ Database Engine ต้องทยอยส่ง Data ... ทุกคนคิดว่าต้องใช้เวลานานเท่าไร", "กลับมาขยายความกันสักนิดกับคำว่า In-process Database มันคืออะไร?".
- Humour in the first line ("OLAP database รุ่นพกพา จิ๋วแต่แจ๋วอย่าง DuckDB"), a wink ("ขายของหน่อยย"), a promise ("อนาคตเดี๋ยวเราจะลองมาทำ Performance Testing กัน").
- Every English term is capitalised in the body: Database, Query, Column, Row, Table, Connection, Instance, Catalog. Code and identifiers are in backticks.

## Numbers (per post, over the Thai text)

- "เรา" is by far the most common pronoun: 37 times in a 5,000 character post, 152 in the 20,000 character ComfyUI post. "ผม" is rare (0 to 4 per post) and "อาร์ม" (the
  author's name for themselves) appears only in the ComfyUI post, 31 times. "คุณ" is occasional (1 to 6 per post, 19 in the ComfyUI post).
- "ซึ่ง" about 4 times per 1,000 characters. "นะ" 3 to 13 per post (42 in the long ComfyUI post), often with "ครับ" ("นะครับ") but also bare.
- "ๆ" always with a space: "ต่าง ๆ", "ง่าย ๆ", "ไปเรื่อย ๆ", "หลาย ๆ".
- Emoji: from about 1 per 140 characters (ACID part 1) to about 1 per 1,200 (the ComfyUI post). They sit at the end of a sentence, often doubled or tripled (😍😍😍, 🤔🤔🤔),
  and as list markers (⚛️ ✅ 📵 ♻️ for the four letters of ACID).
- "ครับ" appears at the start ("Hi สวัสดีครับทุกคน"), at the end ("ขอบคุณครับ"), and in asides ("นะครับ"). In the middle of an explanation the sentences carry no particle.

## The shape of a post

1. A greeting line (👋👋 Welcome Back 👋👋), then "Hi สวัสดีครับทุกคน วันนี้เราจะมา... กัน" with the reason this topic is worth it, often personal:
   "หัวข้อในวันนี้เป็นสิ่งที่ตัวผมเองมีความสงสัยเป็นการส่วนตัว ตอนที่กำลังศึกษา..."
2. A mind map image, then sections: "What is X?", "Pros", "Cons", "Conclusion", "References".
3. Inside a section: the plain definition, an analogy, a small example or an experiment with its output, a look at the result, then the name of the concept.
4. A blockquote for "remember these" and for forward references.
5. A closing apology and invitation: "หวังว่าบทความนี้จะเป็นประโยชน์กับทุกคนนะครับ ถ้าหากมีข้อมูลส่วนไหนผิดพลาดประการใด สามารถมา Comment พูดคุย หรือแนะนำกันได้นะครับ".

## Moves, with the owner's own examples

**Invite, do not instruct.** "เรามาลองพิสูจน์กันดูว่า Python มองตัวแปรทุกอย่างเป็น Object จริงหรือป่าว?", "เรามาลองทดสอบโดยการใช้งาน `df.filter()` ...", "เรามาดูทางฝั่งของ Mutable Objects กันบ้าง".

**The question in the reader's head, said out loud.**
- "ตามความรู้สึกของเราในแวบแรก เราจะเข้าใจว่า x มันควรเป็นค่าของ Key ... แต่การที่เอา Key + Value มันดูไม่ Make sense เท่าไรเลย (หรือผมคิดไปเองคนเดียว 5555)"
- "แต่รู้หรือไม่ จริง ๆ แล้ว Syntax ของมันนั้นมีความหมายอย่างนี้"
- "ตรงนี้อยากให้ทุกคนตั้งคำถามในใจกันหน่อยว่า แล้วจะเกิดอะไรขึ้นกับตัวเลข 12 ที่ตอนนี้ไม่มี Pointer ตัวไหนชี้ไปหาตัวเลข 12 เลย เดี๋ยวเราจะมาคุยกันต่อ"

**Prove it with a small experiment, then read the result.** Run `isinstance`, `id()`, `%%timeit`, `explain()`, show the output, then: "จะเห็นได้ว่า Object ID ของตัวแปรทั้งสองตัวนั้นมีตัวเลขเดียวกัน
นั้นหมายถึง...". The code comments are English and sometimes jokes ("Everything will be burned behind the scenes, as if in hell, because the line is an action operator").

**An analogy a non-engineer would get.**
- "ให้เรามองว่า Object นั้นเปรียบเหมือนกล่องชิ้นหนึ่ง ซึ่งภายในนั้นจะเก็บอะไรเอาไว้ก็ได้"
- "เปรียบเหมือนสูตรในการทำอาหารว่าแต่ละขั้นตอนจะต้องทำอะไรบ้าง" (for a DAG)
- "Atomicity ... คล้ายคลึงกับคำศัพท์ ... 'Atom' ซึ่งเป็นสสารที่มีขนาดเล็กมาก ๆ และไม่สามารถแบ่งแยกได้อีก (แม้ว่าในปัจจุบันจะไม่ใช่แล้วอะนะ 😅)"

**A story with a name and a disaster.** "นาย A ต้องการจะเปิดบัญชีธนาคาร ... เจ้ากรรมนายเวร ไฟดันมาดับเสียก่อน!! ... OMG!! โดนนาย A ด่ากระจุย โดนฟ้องกระจายแน่นอน". The story is
the explanation: it makes the failure concrete before the concept (Atomicity) is named.

**Point back and forward.** "ขอย้อนความกันสักนิด จำ Keywords ที่เราให้จำกันได้ไหมว่า...", "ซึ่งเดี๋ยวเราจะมาคุยกันต่อว่า ... ในหัวข้อถัด ๆ ไป", "เกี่ยวข้องกับหลักการของ CAP theorem ซึ่งอนาคตเราจะมาพูดคุยกันแน่นอน รอติดตามได้เลย".

**Be honest about size and limits.** "(ไม่ได้ลงรายละเอียดเนื่องจากมันจะลึกเกินไป)", "อาร์มไม่ใช่ Expert ทางด้าน AI ... เป็นเพียงผู้สนใจ", "แต่ถึงกระนั้นมันก็ยังคุ้มค่ากับ Performance ที่แลกมา ซึ่งถือว่าเป็น Trade-off กันไป",
"ซึ่งเอาจริง ๆ แล้วมันก็ไม่ได้เป็นข้อเสียที่ร้ายแรงอะไรแต่มันชวนให้หงุดหงิดเล็กน้อย".

**Colloquial endings, a few.** "อะนะ", "หน่ะสิ", "หน่า", "ละ", "เอาจริง ๆ แล้ว", "(มั้ง 😂)", "ซึ่งสำหรับคำสั่ง Actions ก็มีเท่านี้แหละ 😂".

**Mixed Thai and English.** English nouns and verbs inside Thai grammar: "ทำการ Clone Git Repository", "Execute Shell Command", "Database ก็จะ Return ข้อมูลกลับมา", "Base on ตัว OS ของแต่ละคน", "จำเป็นต้อง Concerns เรื่องของ...".
The garden keeps all of it: English terms stay English and start with a capital letter in running text too (the owner confirmed this on 2026-11-10).

**Connectors.** One clause hands over to the next with "ซึ่ง" or "โดย": "ซึ่งรูปแบบคำสั่งจำพวก Transformation แต่ละคำสั่ง ... จะถูกเก็บรวบรวมเอาไว้ในรูปแบบของ DAG ... เปรียบเหมือนสูตร...".
"เพราะฉะนั้นแล้ว", "ยกตัวอย่าง", "จะเห็นได้ว่า", "ขยายความอีกนิดหนึ่ง", "ถ้าหากว่า", "ไม่ว่าจะเป็น ... ก็ตาม".

**Lists.** A numbered list is used for a true enumeration (the four parts of ACID, the steps of an install, the three kinds of Actions), each item a full sentence. Explanations and reasons are in paragraphs.
Bold is used for the name of a step or a keyword ("**ขั้นตอนแรก**", "**Transformation**"), not as a label in front of every item.

## The owner's hand edits (2026-11-08) against the first version Claude wrote

| Claude | Owner |
|---|---|
| Title: "Spark คืออะไร ประวัติ และปัญหาที่มันแก้" | "Spark คืออะไร" |
| "Spark เป็นเครื่องคำนวณข้อมูลแบบกระจาย (distributed compute engine) มันไม่ใช่ database ข้อมูลอยู่ที่อื่น เช่น ไฟล์ Parquet บน S3 หรือ HDFS Spark มาอ่าน แบ่งเป็นก้อน (partition) ให้หลายเครื่องช่วยกันคิด แล้วรวมผลกลับ" | "Spark เป็นเครื่องคำนวณข้อมูลแบบกระจาย (distributed compute engine) มันเองไม่ใช่ database สำหรับข้อมูลจะถูกเก็บเอาไว้ในรูปแบบอื่น เช่น ไฟล์ Parquet บน S3 หรือ HDFS Spark มาอ่าน แบ่งเป็นก้อน (partition) ให้คอมพิวเตอร์หลายเครื่องสามารถช่วยกันประมวลผลข้อมูลได้ แล้วถึงรวมผลลัพธ์กลับมาตอบคำถาม" |
| "ที่เหลือของหน้านี้ตอบคำถามเดียว: ทำไมถึงต้องมีมัน..." | deleted |
| Callout: "หน้านี้เล่าประวัติ ไม่ได้รันโค้ด ... ผมไม่ได้วัดเอง" | "หน้านี้เล่าเฉพาะประวัติความเป็นมา ... ผู้เขียนบทเรียนไม่ได้วัดเองนะ" |
| Summary: "ก่อนหน้านั้นคนใช้อะไร" | "ก่อนหน้านั้นพวกเราใช้อะไรในการจัดการข้อมูล" |

Read it as: full clauses with their small words ("สำหรับ", "สามารถ...ได้", "แล้วถึง", "มาตอบคำถาม"), plain everyday nouns ("คอมพิวเตอร์", "ประมวลผลข้อมูล"), a "นะ" in a note, "พวกเรา" for the shared we,
and no line that announces itself. The owner also said that a bare "เครื่องเดียว" is unclear and asked for "คอมพิวเตอร์".

## Before and after (written to follow the above)

Before (clipped, the "recap with a colon" habit):
> ผลที่ตามมาต่อวิธีเขียนโค้ดมีสองข้อ และสองข้อนี้คือสิ่งที่คุณจะเจอตลอดเส้นทางนี้:
> - คำสั่งแบ่งเป็น transformation (บอกสูตร ยังไม่ทำ) กับ action (ลงมือคำนวณ)

After:
> วิธีคิดนี้ส่งผลต่อการเขียนโค้ดสองอย่าง ซึ่งเราจะเจอไปตลอดเส้นทางนี้ อย่างแรก คำสั่งของ Spark แบ่งเป็น transformation ที่แค่บอกสูตรแต่ยังไม่ลงมือทำ กับ action ที่ลงมือคำนวณจริง

Before (contrast for weight):
> ข้อสรุปที่ถูกต้องจึงไม่ใช่ "เก็บใน memory แล้วเร็ว" อย่างเดียว ข้อมูลที่ใช้ซ้ำไม่ต้องกลับไปผ่านชั้น disk ทุกรอบต่างหากที่ช่วย

After:
> เหตุผลที่ Spark เร็วจึงมีหลายอย่างรวมกัน การเก็บข้อมูลไว้ใน memory เป็นแค่อย่างหนึ่ง อีกอย่างที่ช่วยมากคือข้อมูลที่ใช้ซ้ำไม่ต้องกลับไปผ่านชั้น disk ทุกรอบอีก

## Open questions for the owner

- Emoji in lessons: none by default now. The blog uses many. Say if the garden should get some, and where (Callouts, quiz feedback, headings).
- Opening lines: the blog opens every post warmly, the owner deleted a flat opener from a lesson. If they want a short warm opener on the first Step of each lesson, say so.
- "ครับ": kept out of lesson bodies (the owner agreed). Say if a lesson should end with "ขอบคุณครับ" like a post.
