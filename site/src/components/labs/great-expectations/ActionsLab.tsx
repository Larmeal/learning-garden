import { useMemo, useState } from 'react';

type Outcome = 'pass' | 'fail-critical' | 'fail-warning';
type Notify = 'all' | 'failure' | 'critical';

interface Act {
  id: string;
  label: string;
  notify?: Notify;
  docs?: boolean;
}

// Mirrors should_notify(): all / success / failure compare with the result, a severity level matches only a failure
// whose worst expectation has exactly that severity.
function fires(notify: Notify, outcome: Outcome): boolean {
  const success = outcome === 'pass';
  if (notify === 'all') return true;
  if (notify === 'failure') return !success;
  if (success) return false;
  const severity = outcome === 'fail-critical' ? 'critical' : 'warning';
  return notify === severity;
}

export default function ActionsLab() {
  const [outcome, setOutcome] = useState<Outcome>('fail-critical');
  const [pagerNotify, setPagerNotify] = useState<Notify>('failure');
  const [boom, setBoom] = useState(false);
  const [docsOn, setDocsOn] = useState(true);

  // Declared order. UpdateDataDocsAction is moved to the front when the checkpoint runs.
  const declared: Act[] = useMemo(
    () => [
      { id: 'slack', label: 'SlackNotificationAction', notify: 'all' },
      { id: 'pager', label: 'PagerdutyAlertAction', notify: pagerNotify },
      ...(boom ? [{ id: 'custom', label: 'MyCustomAction (raise RuntimeError)' } as Act] : []),
      { id: 'email', label: 'EmailAction', notify: 'failure' },
      ...(docsOn ? [{ id: 'docs', label: 'UpdateDataDocsAction', docs: true } as Act] : []),
    ],
    [pagerNotify, boom, docsOn],
  );
  const order = [...declared.filter((a) => a.docs), ...declared.filter((a) => !a.docs)];

  let crashed = false;
  const rows = order.map((a) => {
    if (crashed) return { a, state: 'skipped' as const, text: 'ไม่ได้รัน เพราะ action ก่อนหน้า raise' };
    if (a.id === 'custom') {
      crashed = true;
      return { a, state: 'error' as const, text: 'raise RuntimeError: ทำให้ Checkpoint.run() raise ออกไป' };
    }
    if (a.docs) return { a, state: 'sent' as const, text: 'สร้างหน้า Data Docs ใหม่ (ทำก่อน action อื่นเสมอ)' };
    const go = fires(a.notify!, outcome);
    return go
      ? { a, state: 'sent' as const, text: `ส่งแจ้งเตือน (notify_on=${a.notify})` }
      : { a, state: 'quiet' as const, text: `รันแล้วแต่ไม่ส่ง (notify_on=${a.notify} ไม่ตรงกับผล)` };
  });

  return (
    <figure className="viz">
      <div className="viz-title">หลัง checkpoint ตรวจเสร็จ action แต่ละตัวทำอะไร</div>
      <div className="lab-controls">
        <div>
          <div className="lab-label">ผลการตรวจ</div>
          <div className="seg" role="group" aria-label="ผลการตรวจ">
            {([['pass', 'ผ่านทั้งหมด'], ['fail-critical', 'ล้ม (critical)'], ['fail-warning', 'ล้ม (warning)']] as const).map(([v, l]) => (
              <button key={v} type="button" aria-pressed={outcome === v} onClick={() => setOutcome(v)}>{l}</button>
            ))}
          </div>
        </div>
        <div>
          <div className="lab-label">PagerDuty notify_on</div>
          <div className="seg" role="group" aria-label="PagerDuty notify_on">
            {(['failure', 'critical'] as const).map((v) => (
              <button key={v} type="button" aria-pressed={pagerNotify === v} onClick={() => setPagerNotify(v)}>{v}</button>
            ))}
          </div>
        </div>
        <label className="check"><input type="checkbox" checked={docsOn} onChange={(e) => setDocsOn(e.target.checked)} />มี UpdateDataDocsAction</label>
        <label className="check"><input type="checkbox" checked={boom} onChange={(e) => setBoom(e.target.checked)} />มี action ที่ raise</label>
      </div>

      <div className="lab-label">ลำดับที่ GX รันจริง</div>
      <ol className="gx-acts">
        {rows.map(({ a, state, text }, i) => (
          <li key={a.id} data-state={state}>
            <span className="mono">{i + 1}</span>
            <div>
              <code>{a.label}</code>
              <div className="gx-detail">{text}</div>
            </div>
          </li>
        ))}
      </ol>

      <div className="viz-now">
        <strong>{crashed ? 'Checkpoint.run() raise exception' : 'Checkpoint.run() คืน CheckpointResult'}</strong>
        <span>
          {crashed
            ? 'แต่ผลการตรวจถูกเก็บลง store ไปแล้ว และ Data Docs (ถ้ามี) ถูกสร้างไปแล้ว ยืนยันด้วย 06_actions_docs.py ส่วน action ที่อยู่หลังตัวที่ error ไม่ถูกรันเลย'
            : outcome === 'pass'
              ? 'ไม่มี exception และ .success เป็น True'
              : 'ไม่มี exception แม้ข้อมูลไม่ผ่าน .success เป็น False ผู้เรียกต้องตรวจเอง'}
        </span>
      </div>
      <p className="viz-caption">
        เงื่อนไข notify_on เขียนตาม <code>should_notify()</code> ในซอร์ส และระดับ severity ใช้ได้เฉพาะเมื่อผลล้ม ส่วนลำดับกับพฤติกรรมเมื่อ action error ยืนยันด้วยการรัน
      </p>
    </figure>
  );
}
