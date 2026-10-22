# Learning Garden

เว็บสำหรับเรียนรู้ทีละหัวข้อ สร้างด้วย Astro + React + Motion เนื้อหาทั้งหมดเป็นไฟล์ในโฟลเดอร์ `src/content/` เว็บไม่ผูกกับ Spark: หนึ่ง subject คือหนึ่งเรื่องที่เรียน จะมีกี่เรื่องก็ได้

## รัน

```
npm install
npm run dev       # เปิดดูขณะแก้ที่ http://localhost:4321
npm run build     # สร้างเว็บ static ลง dist/ (ตรวจ schema และ requires ให้ด้วย)
```

## โครงสร้าง

```
src/
  site.config.ts             ชื่อเว็บและ tagline
  content.config.ts          schema ของ subject และ lesson
  content/
    subjects/<subject>.json  ข้อมูลของเรื่องที่เรียน: ชื่อ, สี, ช่วง (phase)
    lessons/<subject>/<slug>.mdx   บทเรียน
  components/                ภาพโต้ตอบของแต่ละบท (FormatLab, LazyLab, ...) และส่วนกลาง (Step, Question, Callout, Plant, TopicMap)
  pages/                     หน้าแรก, หน้าแผนที่ของ subject, หน้าบทเรียน
  layouts/Base.astro         โครงหน้าและธีมสว่าง/มืด
```

## เพิ่ม subject ใหม่

1. สร้าง `src/content/subjects/<id>.json` (ดูตัวอย่างที่ `spark.json`) กำหนด `name`, `tagline`, `description`, สี `accent` / `accentDark` และ `phases`
2. สร้างโฟลเดอร์ `src/content/lessons/<id>/` แล้วใส่บทเรียน

หน้าแรกจะแสดง subject ใหม่เป็นการ์ด และสีของ subject นั้นจะใช้ทั้งหน้าแผนที่และหน้าบทเรียนโดยอัตโนมัติ

## เพิ่มบทเรียน

สร้าง `src/content/lessons/<subject>/<slug>.mdx` ที่มี frontmatter:

```yaml
---
title: ชื่อบท
summary: สรุปหนึ่งหรือสองประโยค
order: 5              # ลำดับในแผนที่ (ไม่ซ้ำภายใน subject)
phase: B              # ต้องตรงกับ id ใน phases ของ subject
level: 4              # ความยาก 1-5
stage: seed           # seed = ยังเป็นโครง ยังเรียนไม่ได้ | sprout หรือ evergreen = เขียนเนื้อหาแล้ว
requires: [lazy-evaluation]   # slug ของบทที่ควรรู้ก่อน ถ้าชื่อผิด build จะล้ม
updated: 2026-10-21   # ไม่บังคับ
---
```

ต้นไม้ที่เห็นบนเว็บสะท้อนความคืบหน้าของ**ผู้เรียน** ไม่ใช่ความสมบูรณ์ของเนื้อหา: บทที่ยัง `stage: seed` เป็นเมล็ด บทที่เขียนแล้วเป็นต้นอ่อน และกลายเป็นต้นโตเต็มที่เมื่อผู้เรียนตอบคำถามครบและติ๊กว่าอ่านจบ เมื่อเขียนบทเสร็จให้เปลี่ยน `seed` เป็น `sprout` (ค่า `evergreen` ใช้แทน `sprout` ได้ ผลเหมือนกัน)

### บทเรียนแบบทีละขั้น (format: steps)

ใส่ `format: steps` ใน frontmatter แล้วห่อแต่ละส่วนด้วย `<Step>` เว็บจะเล่นทีละการ์ดพร้อมแถบความคืบหน้า และสร้างการ์ดเปิดบทกับการ์ดจบบทให้เอง ผู้เรียนสลับเป็นโหมดอ่านยาวได้ (ไฟล์เดียวกัน) ส่วนการ์ดคำถามใช้ `<Step kind="question">` ครอบ `<Question ... />` ซึ่งจะล็อกปุ่ม "ต่อไป" จนกว่าจะตอบ

```mdx
import Step from '../../../components/Step.astro';
import Question from '../../../components/Question';

<Step>

## หัวข้อของการ์ด

เนื้อหาสั้นๆ

</Step>

<Step kind="question">

<Question client:visible q="คำถาม" options={['ก', 'ข']} answer={1} why="เหตุผลที่แสดงหลังตอบ" />

</Step>
```

บทที่ไม่ใส่ `format` (ค่าเริ่มต้นคือ `read`) แสดงเป็นหน้ายาวธรรมดา

ภาพโต้ตอบ: เขียนเป็น React component ใน `src/components/` แล้ว import ใน `.mdx` ใช้ `client:visible` เพื่อให้โหลดเมื่อเลื่อนมาถึง ตัวอย่างอยู่ที่ `lessons/spark/execution-model.mdx`

## ความคืบหน้า

เก็บใน localStorage ของเบราว์เซอร์ จึงอยู่เฉพาะเครื่องและเบราว์เซอร์นั้น ไม่ข้ามเครื่อง

- `garden:progress` บทที่ผู้เรียนติ๊กว่าอ่านจบ
- `garden:quiz` การ์ดคำถามที่ตอบแล้ว (ตอบถูกหรือผิดก็นับ) แยกตามบท

ผู้เรียนติ๊กบทได้ก็ต่อเมื่อตอบคำถามที่อยู่ใน `<Question>` ครบทุกข้อ ปุ่มข้ามคำถามยังใช้เดินต่อได้ แต่ไม่นับว่าตอบ

## ภาพที่ขยับ

ตัวสวนใช้ hook กลางตัวเดียวใน `components/useGarden.tsx` (ชั้นภาพขยับตามเมาส์ ต้นไม้เอนหนีเมาส์ ผีเสื้อบินตาม) ฉากแต่ละแบบแค่ส่ง ref ของต้นไม้ ชั้นภาพ และผีเสื้อให้ hook: `GardenHero` (หน้าแรก), `SubjectGarden` (หน้าแผนที่), `GrowArt` (การ์ดเปิดและจบบท), `FooterGarden` (หญ้าท้ายหน้า) เมื่อระบบตั้งค่า "ลดการเคลื่อนไหว" ทุกอย่างหยุดนิ่ง
