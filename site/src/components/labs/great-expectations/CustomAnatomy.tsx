import { useState } from 'react';

const STEPS = [
  {
    name: '1. เงื่อนไขหนึ่งข้อต่อ engine',
    code: `class ColumnValuesAreEven(ColumnMapMetricProvider):
    condition_metric_name = "column_values.are_even"

    @column_condition_partial(engine=PandasExecutionEngine)
    def _pandas(cls, column, **kwargs):
        return column % 2 == 0

    @column_condition_partial(engine=SqlAlchemyExecutionEngine)
    def _sqlalchemy(cls, column, **kwargs):
        return column % 2 == 0`,
    text: 'metric นี้ตอบแค่ว่า "แถวนี้ปกติไหม" เป็น boolean ต่อแถว ต้องเขียนหนึ่งตัวต่อ engine ที่อยากรองรับ ตอนนิยามคลาส GX ลงทะเบียนให้อัตโนมัติ (metaclass) ไม่มีขั้นตอน register เพิ่ม',
  },
  {
    name: '2. expectation แค่ชี้ชื่อ metric',
    code: `class ExpectColumnValuesToBeEven(ColumnMapExpectation):
    map_metric = "column_values.are_even"
    args_keys = ("column",)`,
    text: 'ColumnMapExpectation มีตรรกะครบแล้ว (ขอ metric อะไรบ้าง, คำนวณ mostly, จัดรูปผลตาม result_format) คลาสของเราเติมแค่ map_metric กับชื่อ argument เรียกใช้ได้เหมือน expectation ที่มีมาให้',
  },
  {
    name: '3. สิ่งที่ GX สร้างให้',
    code: `column_values.are_even.condition
column_values.are_even.unexpected_count
column_values.are_even.unexpected_values
column_values.are_even.unexpected_index_list
column_values.are_even.unexpected_index_query`,
    text: 'จากเงื่อนไขเดียว GX derive metric ที่เหลือเอง (เหมือนที่เห็นในแล็บ metric ของ not null) ผลที่ได้จริงกับตัวอย่าง [2, 4, 6, 7, 10, 11]: unexpected_count = 2, ค่าที่ผิด = [7, 11] และใช้ mostly ได้เลย',
  },
  {
    name: '4. รันได้บนทุก backend ที่ implement',
    code: `# pandas
vd.run(batch_parameters={"dataframe": numbers})   # success False, 2 unexpected
# SQLite (เงื่อนไขเดียวกันกลายเป็น CASE WHEN ... % 2 = 0)
vd_sql.run()                                      # success False, 2 unexpected`,
    text: 'ถ้าไม่ implement engine ไหน การรันบน engine นั้นไม่ raise แต่ expectation ได้ success=False พร้อม exception_info ("No provider found for ... using ...") ทดลองแล้วกับ SQLite ถ้าอยากรองรับ Spark เพิ่มเงื่อนไขด้วย column_condition_partial(engine=SparkDFExecutionEngine)',
  },
];

export default function CustomAnatomy() {
  const [i, setI] = useState(0);
  const s = STEPS[i];
  return (
    <figure className="viz">
      <div className="viz-title">expectation ใหม่หนึ่งตัว ประกอบจากอะไรบ้าง</div>
      <div className="viz-steps" role="group" aria-label="ขั้น">
        {STEPS.map((x, n) => (
          <button key={x.name} type="button" aria-pressed={i === n} onClick={() => setI(n)}>{x.name}</button>
        ))}
      </div>
      <pre className="codeline">{s.code}</pre>
      <div className="viz-now" aria-live="polite">
        <strong>{s.name}</strong>
        <span>{s.text}</span>
      </div>
      <p className="viz-caption">โค้ดเต็มที่รันผ่านอยู่ใน <code>07_custom_expectation.py</code> (pandas และ SQLite, GX 1.24.1)</p>
    </figure>
  );
}
