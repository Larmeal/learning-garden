import { useState } from 'react';

interface Pair {
  id: string;
  label: string;
  old: string;
  now: string;
  text: string;
}

// Both columns were run for real: 0.18.21 and 1.24.1 (see 08_legacy_018.py and 01_first_validation.py).
const PAIRS: Pair[] = [
  {
    id: 'data',
    label: 'ระบุข้อมูล',
    old: `validator = context.sources.pandas_default.read_dataframe(df)`,
    now: `source = context.data_sources.add_pandas("src")
asset = source.add_dataframe_asset("users")
bd = asset.add_batch_definition_whole_dataframe("all")`,
    text: '0.18 ส่ง DataFrame เข้า Validator ทันที 1.x แยก "ข้อมูลอยู่ที่ไหน" (source, asset, batch definition) ออกจากตัวข้อมูลที่ส่งตอนรัน',
  },
  {
    id: 'expect',
    label: 'เขียน expectation',
    old: `result = validator.expect_column_values_to_not_be_null("age")
# รันทันที ได้ผลคืนมา`,
    now: `exp = gxe.ExpectColumnValuesToNotBeNull(column="age")
# เป็น object ยังไม่รัน`,
    text: '0.18: expect_* เป็นเมธอดของ Validator ที่รันเดี๋ยวนั้น และข้อที่ล้มจะไม่ถูกเก็บใน suite (ทดลองแล้ว suite ว่าง 0 ข้อ) 1.x: expectation เป็นคลาส/object ที่สร้าง เก็บ และนำไปรันทีหลังได้',
  },
  {
    id: 'suite',
    label: 'รวมเป็นชุด',
    old: `validator.save_expectation_suite("my_suite")`,
    now: `suite = context.suites.add(gx.ExpectationSuite(name="my_suite"))
suite.add_expectation(exp)`,
    text: '1.x สร้าง suite ก่อนแล้วเติม expectation เข้าไป ถ้า suite ถูก add เข้า context แล้ว การเติมจะบันทึกให้เอง',
  },
  {
    id: 'run',
    label: 'สั่งตรวจ',
    old: `checkpoint = context.add_or_update_checkpoint(
    name="cp",
    validations=[{"batch_request": req, "expectation_suite_name": "my_suite"}])
checkpoint.run()`,
    now: `vd = gx.ValidationDefinition(name="vd", data=bd, suite=suite)
cp = context.checkpoints.add(gx.Checkpoint(name="cp", validation_definitions=[vd]))
cp.run(batch_parameters={"dataframe": df})`,
    text: '0.18 อ้าง suite ด้วยชื่อในค่า config (ทดลองแล้ว ชื่อ "default" ที่ไม่มีทำให้ DataContextError) 1.x มี ValidationDefinition เป็นตัวกลางจับคู่ข้อมูลกับ suite เป็น object',
  },
  {
    id: 'result',
    label: 'ผลลัพธ์',
    old: `result = checkpoint.run()
result.success`,
    now: `result = cp.run(batch_parameters={"dataframe": df})
result.success   # ไม่ raise เมื่อข้อมูลไม่ผ่าน`,
    text: 'ทั้งสองรุ่นให้ .success แต่ชื่อ class กับโครงผลต่างกัน ตัวอย่างบนเว็บส่วนใหญ่เป็นแบบ 0.x ให้ดูเลขเวอร์ชันของหน้าเอกสารเสมอ',
  },
];

export default function VersionCompare() {
  const [id, setId] = useState('data');
  const p = PAIRS.find((x) => x.id === id)!;
  return (
    <figure className="viz">
      <div className="viz-title">สิ่งเดียวกัน เขียนต่างกันใน GX 0.18 และ 1.x</div>
      <div className="seg" role="group" aria-label="หัวข้อ">
        {PAIRS.map((x) => (
          <button key={x.id} type="button" aria-pressed={id === x.id} onClick={() => setId(x.id)}>{x.label}</button>
        ))}
      </div>
      <div className="code-pair">
        <div>
          <div className="lab-label">0.18.21 (เก่า)</div>
          <pre className="codeline">{p.old}</pre>
        </div>
        <div>
          <div className="lab-label">1.x (ปัจจุบัน 1.24.1)</div>
          <pre className="codeline">{p.now}</pre>
        </div>
      </div>
      <div className="viz-now" aria-live="polite">
        <span>{p.text}</span>
      </div>
      <p className="viz-caption">
        รันทั้งสองแบบจริง: <code>08_legacy_018.py</code> สำหรับ 0.18 และ <code>01_first_validation.py</code> สำหรับ 1.x เอกสารทางการแบ่งเวอร์ชันที่ docs.greatexpectations.io (1.24.1 ล่าสุด, 0.18.21 ไม่มีการดูแลแล้ว)
      </p>
    </figure>
  );
}
