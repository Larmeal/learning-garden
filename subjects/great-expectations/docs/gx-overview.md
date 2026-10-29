# Great Expectations Overview

เอกสารภาพรวมสำหรับการเรียนรู้ Great Expectations (GX): คืออะไร มีหัวข้ออะไรบ้าง ควรเรียนอะไรก่อนหลัง ความยากของแต่ละหัวข้อ และหัวข้อเหล่านั้นเกี่ยวข้องกันอย่างไร

เลข `#` ในตารางตรงกับ `order` ของบทใน `site/src/content/lessons/great-expectations/` และดาวตรงกับ `level` ในบทนั้น
สิ่งที่ยืนยันแล้วว่าจริง (รันเอง หรืออ่านจากซอร์ส) อยู่ใน [verified-findings.md](verified-findings.md) และสคริปต์ที่รันซ้ำได้อยู่ใน `../code/`

## 1. GX คืออะไร

Great Expectations เป็นเฟรมเวิร์ก Python สำหรับตรวจคุณภาพข้อมูล เราเขียนสิ่งที่คาดหวังจากข้อมูลเป็น **Expectation** (เช่น "คอลัมน์ `id` ต้องไม่เป็น null") แล้วสั่งตรวจกับข้อมูลจริง ได้ผลผ่าน/ไม่ผ่านพร้อมรายละเอียด และทำเป็นรายงานได้

จุดเด่น:
- expectation ชุดเดียวใช้ได้กับ pandas, Spark และ SQL
- ผลตรวจเป็นข้อมูลที่เก็บ แจ้งเตือน และทำรายงานต่อได้

ข้อควรเข้าใจก่อนทุกอย่าง: GX ไม่แก้ข้อมูลและไม่ใช่ที่เก็บข้อมูล มันคือ "ผู้ตรวจ" ที่ไปอ่านข้อมูลจากที่อื่น คำนวณข้อเท็จจริง (metric) แล้วเทียบกับสิ่งที่เราคาดหวัง

## 2. แผนที่หัวข้อ เรียงตามลำดับที่ควรรู้

ระดับความยาก: ⭐ ง่าย ถึง ⭐⭐⭐⭐⭐ ยากมาก

| # | หัวข้อ | ความยาก | เหตุผลที่อยู่ลำดับนี้ |
|---|---|---|---|
| 0 | **พื้นฐานก่อนเริ่ม**: Python, pandas, ชนิดความเสียของข้อมูล, ติดตั้ง GX 1.x | ⭐ | ถ้าใช้ pandas ได้และเคยเจอข้อมูลเสียอยู่แล้ว ข้ามได้ |
| 1 | **แนวคิดหลัก**: Context, Data Source/Asset, Batch Definition, Expectation, Suite, Validation Definition, Checkpoint | ⭐⭐ | ทุกหัวข้อหลังจากนี้อิงภาพนี้ |
| 2 | **Validation แรก**: `get_context`, pandas, suite เล็กๆ, อ่านผล | ⭐⭐ | ได้รันของจริงเร็วที่สุด |
| 3 | **Expectation และ Suite**: ชนิดของ expectation, `mostly`, suite parameter | ⭐⭐ | งานจริงส่วนใหญ่คือการเลือกและเขียน expectation |
| 4 | **อ่านผลและกับดัก**: `success` กับ `exception_info`, ตารางว่างผ่าน, `result_format` | ⭐⭐ | ผลที่ผ่านไม่ได้แปลว่าข้อมูลดี ต้องรู้ก่อนเชื่อผล |
| 5 | **Context และ Store**: ephemeral/file/cloud, โครง `gx/`, store, singleton | ⭐⭐⭐ | `run` ต้องใช้ object ที่ add เข้า context แล้ว จึงต้องรู้ก่อน checkpoint |
| 6 | **Data Source และ Batch**: fluent source, partitioner, `get_batch` | ⭐⭐⭐ | ข้อมูลจริงมาเป็นก้อนรายวัน/รายไฟล์ ต้องเลือกก้อนที่จะตรวจ |
| 7 | **Validation Definition และ Checkpoint**: `run`, `CheckpointResult`, freshness | ⭐⭐⭐ | หน่วยที่รันซ้ำได้ใน production |
| 8 | **Metric และ Execution Engine**: รอบการคำนวณ, `metric_value`/`metric_partial`, bundling, ต้นทุน | ⭐⭐⭐⭐ | ด่านใหญ่ที่สุดของการเรียน แยกคนใช้เป็นออกจากคนเข้าใจ |
| 9 | **Action และ Data Docs**: ลำดับ action, `notify_on`, severity, รายงาน HTML | ⭐⭐⭐ | ตรวจแล้วต้องมีคนรู้และอ่านผลได้ |
| 10 | **ใช้ใน pipeline จริง**: gate ด้วย `result.success`, batch parameter, orchestrator | ⭐⭐⭐⭐ | ต้องใช้หัวข้อ 4, 6, 9 ผสมกัน และตัดสินใจเชิงออกแบบ |
| 11 | **รันบน Spark และ SQL**: ต้นทุนบนข้อมูลใหญ่ | ⭐⭐⭐⭐ | ต้องเข้าใจ metric (8) และ pipeline (10) ก่อน |
| 12 | **เขียน Expectation เอง**: map metric, metaclass registry | ⭐⭐⭐⭐ | ต้องรู้ว่า expectation ขอ metric อย่างไร (8) |
| 13 | **Internals**: เดินตาม graph และอ่านซอร์สตามเส้นทางรัน | ⭐⭐⭐⭐⭐ | สำหรับเจาะลึก ไม่จำเป็นต่อการใช้งานทั่วไป |

หมายเหตุ: ตัวอย่าง GX บนเว็บจำนวนมากเป็น API รุ่น 0.x ที่ใช้กับ 1.x ไม่ได้ ควรเทียบกับเวอร์ชันที่ติดตั้งเสมอ

## 3. หัวข้อเกี่ยวข้องกันอย่างไร

### 3.1 เส้นทางของการตรวจหนึ่งครั้ง ตั้งแต่เขียนจนได้ผล

อ่านจากบนลงล่าง วงเล็บคือหัวข้อในตารางข้างบน

```
1. ระบุข้อมูล: Data Source > Data Asset > Batch Definition    (หัวข้อ 6)
   |   เป็นแค่สูตร สร้างแล้วยังไม่คำนวณอะไร (วัดแล้ว: 0 ครั้ง)
   v
2. เขียนสิ่งที่คาดหวัง: Expectation รวมเป็น Suite             (หัวข้อ 3)
   |
   v
3. add ทุกอย่างเข้า Context, ผูกด้วย Validation Definition    (หัวข้อ 5, 7)
   |   = Batch Definition + Suite
   v
4. Checkpoint.run > ValidationDefinition.run                   (หัวข้อ 7)
   |   DataFrame ส่งตอนรันเป็น batch parameter
   v
5. Validator รวม metric ของทุก expectation เป็นกราฟเดียว       (หัวข้อ 8)
   |   metric id เดียวกันคำนวณครั้งเดียว
   v
6. คำนวณเป็นรอบ: รอบละ metric ที่ dependency พร้อมแล้ว         (หัวข้อ 8)
   |   Execution Engine ของ pandas / Spark / SQL ลงมือ
   |   SQL/Spark รวม aggregate ใน domain เดียวเป็นคำสั่งเดียว
   v
7. Expectation ตัดสินจาก metric ได้ success และ result         (หัวข้อ 3, 4)
   |   ผลถูกเก็บลง store
   v
8. Action แจ้งเตือน, Data Docs ทำรายงาน                        (หัวข้อ 9)
   |   Checkpoint.run ไม่ raise ถ้าข้อมูลไม่ผ่าน
   v
9. pipeline อ่าน result.success แล้วตัดสินใจ                   (หัวข้อ 10)
```

### 3.2 ทำไม metric ถึงสำคัญที่สุด

Expectation ไม่ได้อ่านข้อมูลเอง มันบอกว่าต้องใช้ metric อะไร (จำนวนแถว, จำนวน null, ค่าสูงสุด) แล้ว engine เป็นคนคำนวณ

```
expectation หนึ่งข้อ
   |
   +--> ประกาศ metric ที่ต้องใช้ (หนึ่งตัวขึ้นไป)
   +--> metric บางตัวพึ่ง metric อื่น  = กราฟ, คำนวณเป็นรอบ
   |
   v
engine ของ backend นั้นคำนวณ
   |
   +--> pandas: คำนวณทันทีทีละตัว
   +--> SQL:    aggregate รวมเป็น SELECT เดียวต่อ domain   (วัดแล้ว)
   +--> Spark:  aggregate รวมเป็น df.agg(...).collect()     (อ่านจากซอร์ส)
```

แนวคิดที่ต้องจำ: **expectation ชุดเดียวรันได้หลาย backend เพราะ expectation ขอแค่ metric ส่วนวิธีคำนวณเป็นหน้าที่ของ engine**

ต้นทุนที่วัดได้: จำนวน metric ขึ้นกับ `result_format` (suite 5 ข้อ ใช้ 10, 13 และ 19 metric สำหรับ BOOLEAN_ONLY, BASIC และ SUMMARY บน GX 1.24.1 ส่วน 1.9.3 ได้ 11, 14, 20) และการรันซ้ำคำนวณใหม่ทั้งหมด ยังไม่ได้วัดบนข้อมูลใหญ่

### 3.3 หัวข้อไหนต่อยอดจากอะไร

| หัวข้อ | ต้องเข้าใจอะไรมาก่อน | เพราะอะไร |
|---|---|---|
| 2 Validation แรก | 1 แนวคิดหลัก | ต้องรู้ว่าแต่ละชิ้นที่สร้างคืออะไร |
| 3 Expectation และ Suite | 2 | ต้องเห็นผลของ expectation เดียวก่อนจะรวมเป็นชุด |
| 4 อ่านผลและกับดัก | 2 และ 3 | ต้องมีผลให้อ่านและรู้ว่า expectation แต่ละชนิดตัดสินอย่างไร |
| 5 Context และ Store | 2 | เจอ context มาตั้งแต่ต้น หัวข้อนี้เจาะว่าเก็บอะไรไว้ที่ไหนและทำไมต้อง add ก่อนรัน |
| 6 Data Source และ Batch | 2 และ 5 | ขยายจาก DataFrame ก้อนเดียวไปสู่ข้อมูลเป็นก้อนๆ ที่ต้อง persist |
| 7 Validation Definition และ Checkpoint | 3, 5, 6 | เป็นการจับคู่ข้อมูลกับ suite และใช้ store |
| 8 Metric และ Engine | 4 และ 7 | ต้องเห็นการตรวจทั้งเส้นและอ่านผลเป็นก่อน จึงรู้ว่าเบื้องหลังคืออะไร |
| 9 Action และ Data Docs | 7 | ทำงานต่อจากผลของ checkpoint |
| 10 ใช้ใน pipeline | 4, 6, 9 | ต้องอ่านผลเป็น เลือก batch ถูก และมีการแจ้งผล |
| 11 Spark และ SQL | 8 และ 10 | ต้องเข้าใจ metric และต้นทุนก่อนไปข้อมูลใหญ่ |
| 12 Expectation เอง | 8 | ต้องรู้ว่า expectation ขอ metric อย่างไร |
| 13 Internals | 8, 9, 5 | อ่านโค้ดได้เข้าใจเมื่อรู้ภาพรวมแล้ว |

## 4. Learning Path 5 ช่วง

### ช่วง A: ใช้เป็น (หัวข้อ 0-4)
- **ลงมือทำ**: รัน `01_first_validation.py` สร้าง DataFrame ที่มีข้อมูลเสียหลายแบบ แล้วดู `success` กับ `result` จากนั้นรัน `03_traps.py`
- **เช็กตัวเอง**: เขียน expectation สองสามข้อ ตรวจ DataFrame แล้วอ่านผลได้ว่าแถวไหนไม่ผ่านเพราะอะไร และบอกได้ว่าเมื่อไรผลที่ "ผ่าน" ไม่น่าเชื่อ

### ช่วง B: เข้าใจว่ามันทำงานอย่างไร (หัวข้อ 5-8) ช่วงสำคัญที่สุด
- **ลงมือทำ**: รัน `02_metric_rounds.py` และ `05_sql_bundling.py` ดูรอบการคำนวณและคำสั่ง SQL ที่ออกไป ตั้ง batch definition รายวัน (`04_batches.py`)
- **เช็กตัวเอง**: ดู expectation สามข้อแล้วทายได้ว่ามีกี่ metric กี่รอบ และบน SQL จะออกกี่คำสั่ง

### ช่วง C: ใช้ใน pipeline จริง (หัวข้อ 9-10)
- **ลงมือทำ**: รัน `06_actions_docs.py` ผูก checkpoint เข้ากับ pipeline เล็กๆ ที่หยุดเมื่อ `result.success` เป็น false
- **เช็กตัวเอง**: ข้อมูลไม่ผ่านแล้วตัดสินใจได้ว่าควรหยุด กักข้อมูล หรือเตือนแล้วไปต่อ และให้เหตุผลได้

### ช่วง D: ขยายสู่ข้อมูลจริง (หัวข้อ 11-12 เลือกตามงาน)
- Spark/SQL ถ้าข้อมูลไม่พอดีในเครื่องเดียว
- Expectation เอง ถ้าไม่มีตัวที่ตรงกับกฎของธุรกิจ

### ช่วง E: เจาะลึก (หัวข้อ 13 เลือกเรียน)
- เดินตาม tour 14 ขั้นของ graph ใน `graphs/gx-current/` แล้วเทียบกับเส้นทางรันใน verified-findings.md

## 5. หมายเหตุเกี่ยวกับโปรเจกต์นี้

- graph ใน `graphs/gx-current/` วิเคราะห์ `great_expectations` v1.9.3 (commit `31bdf47`) เฉพาะ package `great_expectations/` ไม่รวม test และ docs ของ GX graph มี edge เกือบทั้งหมดเป็น imports, contains, exports และ inherits (calls มี 44 เส้น) จึงบอกลำดับการเรียกไม่ได้ ต้องอ่านซอร์ส
- `../code/` เป็นโปรเจกต์ `uv` ที่ pin `great-expectations==1.24.1` (รุ่นล่าสุดตอนเขียน) สคริปต์ `01` ถึง `10` รันผ่าน และ `08_legacy_018.py` รันกับ 0.18.21 ไว้เทียบ ซอร์สที่อ่านเป็นรุ่น 1.9.3 จึงมีจุดที่พฤติกรรมต่างกันจริง (context ซ้อน, ตัวเลข metric) ดูตารางใน verified-findings.md
- ยังไม่ได้ยืนยัน: พฤติกรรม Spark ตอนรันจริง, rendering ภายใน, GX Cloud, orchestrator, การแทนค่าจาก config_variables.yml และ expectation ส่วนใหญ่ของ 60 ตัวที่มีให้
- ดาวความยากเป็นการประเมินของผู้เขียน ยังไม่ได้ทดสอบกับการเรียนจริง และตรงกับ `level` ในแต่ละบท (ปรับที่ใดที่หนึ่งก็ควรปรับอีกที่)
