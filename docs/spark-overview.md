# Apache Spark Overview

เอกสารภาพรวมสำหรับการเรียนรู้ Spark: คืออะไร มีหัวข้ออะไรบ้าง ควรเรียนอะไรก่อนหลัง ความยากของแต่ละหัวข้อ และหัวข้อเหล่านั้นเกี่ยวข้องกันอย่างไร

## 1. Spark คืออะไร

Apache Spark คือเอนจินประมวลผลข้อมูลแบบกระจาย (distributed) ที่แบ่งข้อมูลก้อนใหญ่เป็นชิ้นเล็กๆ เรียกว่า **partition** ให้หลายเครื่องหรือหลาย core ประมวลผลพร้อมกัน แล้วรวมผลกลับ

จุดเด่น:
- ประมวลผลใน memory ได้เร็ว
- มี API เดียวใช้ได้ทั้ง batch, SQL, streaming และ ML

ข้อควรเข้าใจก่อนทุกอย่าง: Spark ไม่ใช่ database และไม่ใช่ที่เก็บข้อมูล มันคือ "เครื่องคำนวณ" ที่ไปอ่านข้อมูลจากที่อื่น (ไฟล์, data lake, database) แล้วประมวลผล

## 2. แผนที่หัวข้อ เรียงตามลำดับที่ควรรู้

ระดับความยาก: ⭐ ง่าย ถึง ⭐⭐⭐⭐⭐ ยากมาก

| # | หัวข้อ | ความยาก | เหตุผลที่อยู่ลำดับนี้ |
|---|---|---|---|
| 0 | **พื้นฐานก่อนเริ่ม**: Python, SQL, ไฟล์ CSV/JSON/Parquet | ⭐ | ถ้าเขียน SQL หรือ pandas ได้อยู่แล้ว ข้ามได้ |
| 1 | **สถาปัตยกรรม**: driver, executor, cluster manager, SparkSession | ⭐⭐ | ทุกหัวข้อหลังจากนี้อิงภาพนี้ |
| 2 | **Lazy evaluation**: transformation vs action | ⭐⭐ | อธิบายว่าทำไมโค้ดบางบรรทัดไม่รันทันที เป็นต้นเหตุของความสับสนส่วนใหญ่ |
| 3 | **DataFrame API + Spark SQL**: select, filter, join, groupBy, window, จัดการ null และ schema | ⭐⭐ | งานจริงส่วนใหญ่อยู่ตรงนี้ |
| 4 | **Data I/O**: อ่านเขียน Parquet, partition บน disk, schema | ⭐⭐ | ข้อมูลเข้าออกกำหนดความเร็วของทั้งระบบ |
| 5 | **Execution model**: job, stage, task, narrow/wide transformation, **shuffle**, partition | ⭐⭐⭐⭐ | ด่านใหญ่ที่สุดของการเรียน แยกคนใช้เป็นออกจากคนเข้าใจ |
| 6 | **Catalyst, Tungsten, AQE, `explain()`** | ⭐⭐⭐⭐ | เห็นว่า Spark ปรับแผนให้เองอย่างไร และอ่าน plan เป็น |
| 7 | **Performance tuning**: data skew, join strategy (broadcast / sort-merge), cache / persist, ขนาด partition, memory และ spill | ⭐⭐⭐⭐⭐ | ต้องใช้ความรู้ของหัวข้อ 5-6 ผสมกันทั้งหมด |
| 8 | **UDF**: Python UDF, pandas UDF (Arrow) | ⭐⭐⭐ | เข้าใจว่าทำไม UDF ช้า และเมื่อไรควรเลี่ยง |
| 9 | **Structured Streaming**: micro-batch, watermark, state, checkpoint | ⭐⭐⭐⭐ | ต้องแข็งหัวข้อ 3 และ 5 ก่อน |
| 10 | **Table format สมัยใหม่**: Delta / Iceberg / Hudi | ⭐⭐⭐ | ACID และ time travel บน data lake |
| 11 | **Deployment**: Spark UI, YARN / K8s / standalone, Databricks / EMR, Spark Connect | ⭐⭐⭐ | การอ่าน Spark UI เป็นสำคัญกว่าตัวขั้นตอน deploy |
| 12 | **MLlib** | ⭐⭐⭐ | เป็นสาขาเฉพาะ เรียนเมื่อจำเป็น |
| 13 | **Internals**: RDD, scheduler, memory manager, code generation | ⭐⭐⭐⭐⭐ | สำหรับเจาะลึก ไม่จำเป็นต่อการใช้งานทั่วไป |

หมายเหตุ: RDD เป็น API ชั้นล่างที่ปัจจุบันใช้น้อยลง ควรเรียนเชิงแนวคิดพร้อมหัวข้อ 5 ไม่จำเป็นต้องใช้เขียนงานจริง

## 3. หัวข้อเกี่ยวข้องกันอย่างไร

### 3.1 เส้นทางของโค้ดหนึ่งชุด ตั้งแต่เขียนจนได้ผล

อ่านจากบนลงล่าง วงเล็บคือหัวข้อในตารางข้างบน

```
1. คุณเขียนโค้ด DataFrame หรือ SQL                      (หัวข้อ 3)
   |
   |  ยังไม่รันอะไร Spark แค่จดแผนไว้ เรียกว่า lazy      (หัวข้อ 2)
   v
2. คุณเรียก action เช่น show(), count(), write()
   |
   v
3. Catalyst ปรับแผนให้ดีขึ้นอัตโนมัติ                    (หัวข้อ 6)
   |   ดูแผนได้ด้วย explain()
   v
4. แบ่งแผนเป็น Stage ตัดที่จุดที่ต้อง shuffle            (หัวข้อ 5)
   |
   v
5. แต่ละ Stage แตกเป็น Task, 1 partition = 1 task      (หัวข้อ 5)
   |
   v
6. Executor รัน Task พร้อมกันหลายตัว                    (หัวข้อ 1)
   |
   v
7. ได้ผลลัพธ์ หรือเขียนลงไฟล์ Parquet                   (หัวข้อ 4)
```

### 3.2 ทำไม shuffle ถึงสำคัญที่สุด

Shuffle คือการที่ข้อมูลต้องย้ายข้ามเครื่องเพื่อจัดกลุ่มใหม่ เช่น `groupBy` หรือ `join` ซึ่งช้า เพราะต้องส่งข้อมูลผ่านเครือข่ายและเขียนลง disk

```
shuffle เกิดขึ้น
   |
   +--> ข้อมูลกระจายไม่เท่ากัน  = data skew   (บาง task ช้ากว่าชาวบ้าน)
   +--> ข้อมูลล้น memory        = spill       (ต้องเขียนลง disk)
   +--> ข้อมูลส่งผ่านเครือข่ายเยอะ            (job ช้าทั้งก้อน)
   |
   v
หัวข้อ 7 (Performance tuning) คือการลดหรือจัดการสามอย่างนี้
```

แนวคิดที่ต้องจำ: **ปัญหา performance ส่วนใหญ่ของ Spark คือปัญหา shuffle**

### 3.3 หัวข้อไหนต่อยอดจากอะไร

| หัวข้อ | ต้องเข้าใจอะไรมาก่อน | เพราะอะไร |
|---|---|---|
| 5 Execution model | 2 Lazy evaluation | เพราะ Spark รอเห็นงานทั้งก้อนก่อน จึงแบ่ง stage ได้ |
| 6 Catalyst | 3 DataFrame/SQL และ 2 Lazy | Catalyst ปรับแผนจากโค้ดที่เขียนด้วย DataFrame/SQL |
| 7 Tuning | 5 และ 6 | ต้องอ่านแผนและรู้ว่า shuffle อยู่ตรงไหนก่อนจะแก้ได้ |
| 8 UDF | 3 DataFrame และ 6 Catalyst | UDF ทำให้ Catalyst มองข้างในไม่เห็น จึงปรับแผนไม่ได้ |
| 9 Streaming | 3 และ 5 | Streaming คือ DataFrame ที่รันเป็นรอบๆ ต่อเนื่อง |
| 10 Table format | 4 Data I/O | เป็นชั้นที่ครอบไฟล์ Parquet ให้มีความสามารถเพิ่ม |
| 12 MLlib | 3 DataFrame | ใช้ DataFrame เป็นข้อมูลเข้า |

## 4. Learning Path 4 ช่วง

### ช่วง A: ใช้เป็น (หัวข้อ 0-4)
- **ลงมือทำ**: อ่าน CSV, filter, join, groupBy, เขียนเป็น Parquet
- **เช็กตัวเอง**: อธิบายได้ว่าทำไมบรรทัด `df.filter(...)` ไม่ทำอะไรจนกว่าจะเรียก `.show()`

### ช่วง B: เข้าใจว่ามันรันอย่างไร (หัวข้อ 5-6) ช่วงสำคัญที่สุด
- **ลงมือทำ**: รัน `groupBy` แล้วดู `explain()` และ Spark UI นับจำนวน stage และ shuffle
- **เช็กตัวเอง**: ดูโค้ดสามบรรทัดแล้วทายได้ว่ามีกี่ stage

### ช่วง C: ทำให้เร็วและเสถียร (หัวข้อ 7-8)
- **ลงมือทำ**: สร้างข้อมูล skew เอง แล้วแก้ด้วย broadcast join, salting, AQE และเทียบเวลา
- **เช็กตัวเอง**: เจอ job ช้าแล้วบอกได้ว่าติดที่ skew, shuffle ขนาดใหญ่ หรือ spill

### ช่วง D: ขยายสู่งานจริง (หัวข้อ 9-12 เลือกตามงาน)
- Streaming ถ้าทำงาน real-time
- Table format ถ้าทำ data lake
- MLlib ถ้าทำ ML

## 5. หมายเหตุเกี่ยวกับโปรเจกต์นี้

`pyproject.toml` ระบุ `pyspark>=4.2.0` ซึ่งเป็น Spark 4.x เนื้อหาหลักข้างต้นยังใช้ได้ แต่รายละเอียดเฉพาะเวอร์ชัน (เช่น ANSI mode, Spark Connect) ควรตรวจกับเวอร์ชันที่ติดตั้งจริงก่อนนำไปสอนหรือสรุป
