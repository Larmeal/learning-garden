import { useState } from 'react';

type Lang = 'th' | 'en';

const STEPS: Record<Lang, { name: string; code: string; text: string }[]> = {
  th: [
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
],
  en: [
  {
    name: '1. One condition per engine',
    code: `class ColumnValuesAreEven(ColumnMapMetricProvider):
    condition_metric_name = "column_values.are_even"

    @column_condition_partial(engine=PandasExecutionEngine)
    def _pandas(cls, column, **kwargs):
        return column % 2 == 0

    @column_condition_partial(engine=SqlAlchemyExecutionEngine)
    def _sqlalchemy(cls, column, **kwargs):
        return column % 2 == 0`,
    text: 'This metric only answers "is this row normal?", as a boolean per row. You write one for each engine you want to support. When the class is defined, GX registers it automatically (a metaclass does it), so there is no extra register step.',
  },
  {
    name: '2. The expectation only names the metric',
    code: `class ExpectColumnValuesToBeEven(ColumnMapExpectation):
    map_metric = "column_values.are_even"
    args_keys = ("column",)`,
    text: 'ColumnMapExpectation already has all the logic (which metrics to ask for, computing mostly, shaping the result by result_format). Our class only fills in map_metric and the argument names. You call it like a built-in expectation.',
  },
  {
    name: '3. What GX builds for you',
    code: `column_values.are_even.condition
column_values.are_even.unexpected_count
column_values.are_even.unexpected_values
column_values.are_even.unexpected_index_list
column_values.are_even.unexpected_index_query`,
    text: 'From the one condition, GX derives the other metrics itself (as in the not null metric lab). With the sample [2, 4, 6, 7, 10, 11] the real result is: unexpected_count = 2, the bad values are [7, 11], and mostly works right away.',
  },
  {
    name: '4. Runs on every backend you implement',
    code: `# pandas
vd.run(batch_parameters={"dataframe": numbers})   # success False, 2 unexpected
# SQLite (the same condition becomes CASE WHEN ... % 2 = 0)
vd_sql.run()                                      # success False, 2 unexpected`,
    text: 'If you do not implement an engine, running on it does not raise. The expectation gets success=False with an exception_info ("No provider found for ... using ..."). Tried on SQLite. To support Spark too, add a condition with column_condition_partial(engine=SparkDFExecutionEngine).',
  },
],
};

const TEXT: Record<Lang, { title: string; group: string; caption1: string; caption2: string }> = {
  th: { title: 'expectation ใหม่หนึ่งตัว ประกอบจากอะไรบ้าง', group: 'ขั้น', caption1: 'โค้ดเต็มที่รันผ่านอยู่ใน ', caption2: ' (pandas และ SQLite, GX 1.24.1)' },
  en: { title: 'What one new expectation is made of', group: 'Step', caption1: 'The full code that runs is in ', caption2: ' (pandas and SQLite, GX 1.24.1)' },
};

export default function CustomAnatomy({ lang = 'th' }: { lang?: Lang }) {
  const t = TEXT[lang];
  const steps = STEPS[lang];
  const [i, setI] = useState(0);
  const s = steps[i];
  return (
    <figure className="viz">
      <div className="viz-title">{t.title}</div>
      <div className="viz-steps" role="group" aria-label={t.group}>
        {steps.map((x, n) => (
          <button key={x.name} type="button" aria-pressed={i === n} onClick={() => setI(n)}>{x.name}</button>
        ))}
      </div>
      <pre className="codeline">{s.code}</pre>
      <div className="viz-now" aria-live="polite">
        <strong>{s.name}</strong>
        <span>{s.text}</span>
      </div>
      <p className="viz-caption">{t.caption1}<code>07_custom_expectation.py</code>{t.caption2}</p>
    </figure>
  );
}
