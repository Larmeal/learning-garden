import { useMemo, useState } from 'react';
import type { Lang } from '../../../i18n';

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

const TEXT: Record<Lang, {
  skipped: string;
  error: string;
  docs: string;
  sent: (n: string) => string;
  quiet: (n: string) => string;
  custom: string;
  title: string;
  outcomeLabel: string;
  outcomes: [Outcome, string][];
  hasDocs: string;
  hasBoom: string;
  orderLabel: string;
  raised: string;
  returned: string;
  crashedNote: string;
  passNote: string;
  failNote: string;
  caption: string;
}> = {
  th: {
    skipped: 'ไม่ได้รัน เพราะ action ก่อนหน้า raise',
    error: 'raise RuntimeError: ทำให้ Checkpoint.run() raise ออกไป',
    docs: 'สร้างหน้า Data Docs ใหม่ (ทำก่อน action อื่นเสมอ)',
    sent: (n) => `ส่งแจ้งเตือน (notify_on=${n})`,
    quiet: (n) => `รันแล้วแต่ไม่ส่ง (notify_on=${n} ไม่ตรงกับผล)`,
    custom: 'MyCustomAction (raise RuntimeError)',
    title: 'หลัง checkpoint ตรวจเสร็จ action แต่ละตัวทำอะไร',
    outcomeLabel: 'ผลการตรวจ',
    outcomes: [['pass', 'ผ่านทั้งหมด'], ['fail-critical', 'ล้ม (critical)'], ['fail-warning', 'ล้ม (warning)']],
    hasDocs: 'มี UpdateDataDocsAction',
    hasBoom: 'มี action ที่ raise',
    orderLabel: 'ลำดับที่ GX รันจริง',
    raised: 'Checkpoint.run() raise exception',
    returned: 'Checkpoint.run() คืน CheckpointResult',
    crashedNote: 'แต่ผลการตรวจถูกเก็บลง store ไปแล้ว และ Data Docs (ถ้ามี) ถูกสร้างไปแล้ว ยืนยันด้วย 06_actions_docs.py ส่วน action ที่อยู่หลังตัวที่ error ไม่ถูกรันเลย',
    passNote: 'ไม่มี exception และ .success เป็น True',
    failNote: 'ไม่มี exception แม้ข้อมูลไม่ผ่าน .success เป็น False ผู้เรียกต้องตรวจเอง',
    caption: 'เงื่อนไข notify_on เขียนตาม',
  },
  en: {
    skipped: 'Did not run, because an earlier action raised',
    error: 'raise RuntimeError: makes Checkpoint.run() raise as well',
    docs: 'Builds the new Data Docs page (always done before the other actions)',
    sent: (n) => `Sends the notification (notify_on=${n})`,
    quiet: (n) => `Ran but sends nothing (notify_on=${n} does not match the result)`,
    custom: 'MyCustomAction (raise RuntimeError)',
    title: 'After the checkpoint finishes, what does each action do',
    outcomeLabel: 'Validation result',
    outcomes: [['pass', 'All passed'], ['fail-critical', 'Failed (critical)'], ['fail-warning', 'Failed (warning)']],
    hasDocs: 'Has UpdateDataDocsAction',
    hasBoom: 'Has an action that raises',
    orderLabel: 'Order in which GX really runs them',
    raised: 'Checkpoint.run() raises an exception',
    returned: 'Checkpoint.run() returns a CheckpointResult',
    crashedNote: 'But the validation result is already saved in the store, and Data Docs (if present) are already built. Confirmed by 06_actions_docs.py. Actions after the one that failed never run.',
    passNote: 'No exception, and .success is True.',
    failNote: 'No exception even though the data failed. .success is False. The caller must check it.',
    caption: 'The notify_on conditions follow',
  },
};

export default function ActionsLab({ lang = 'th' }: { lang?: Lang }) {
  const t = TEXT[lang];
  const [outcome, setOutcome] = useState<Outcome>('fail-critical');
  const [pagerNotify, setPagerNotify] = useState<Notify>('failure');
  const [boom, setBoom] = useState(false);
  const [docsOn, setDocsOn] = useState(true);

  // Declared order. UpdateDataDocsAction is moved to the front when the checkpoint runs.
  const declared: Act[] = useMemo(
    () => [
      { id: 'slack', label: 'SlackNotificationAction', notify: 'all' },
      { id: 'pager', label: 'PagerdutyAlertAction', notify: pagerNotify },
      ...(boom ? [{ id: 'custom', label: t.custom } as Act] : []),
      { id: 'email', label: 'EmailAction', notify: 'failure' },
      ...(docsOn ? [{ id: 'docs', label: 'UpdateDataDocsAction', docs: true } as Act] : []),
    ],
    [pagerNotify, boom, docsOn, t],
  );
  const order = [...declared.filter((a) => a.docs), ...declared.filter((a) => !a.docs)];

  let crashed = false;
  const rows = order.map((a) => {
    if (crashed) return { a, state: 'skipped' as const, text: t.skipped };
    if (a.id === 'custom') {
      crashed = true;
      return { a, state: 'error' as const, text: t.error };
    }
    if (a.docs) return { a, state: 'sent' as const, text: t.docs };
    const go = fires(a.notify!, outcome);
    return go
      ? { a, state: 'sent' as const, text: t.sent(a.notify!) }
      : { a, state: 'quiet' as const, text: t.quiet(a.notify!) };
  });

  return (
    <figure className="viz">
      <div className="viz-title">{t.title}</div>
      <div className="lab-controls">
        <div>
          <div className="lab-label">{t.outcomeLabel}</div>
          <div className="seg" role="group" aria-label={t.outcomeLabel}>
            {t.outcomes.map(([v, l]) => (
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
        <label className="check"><input type="checkbox" checked={docsOn} onChange={(e) => setDocsOn(e.target.checked)} />{t.hasDocs}</label>
        <label className="check"><input type="checkbox" checked={boom} onChange={(e) => setBoom(e.target.checked)} />{t.hasBoom}</label>
      </div>

      <div className="lab-label">{t.orderLabel}</div>
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
        <strong>{crashed ? t.raised : t.returned}</strong>
        <span>
          {crashed ? t.crashedNote : outcome === 'pass' ? t.passNote : t.failNote}
        </span>
      </div>
      <p className="viz-caption">
        {lang === 'en' ? (
          <>
            {t.caption} <code>should_notify()</code> in the source. A severity level only works when the result is a failure. The order and the behavior
            when an action errors were confirmed by running it.
          </>
        ) : (
          <>
            {t.caption} <code>should_notify()</code> ในซอร์ส และระดับ severity ใช้ได้เฉพาะเมื่อผลล้ม ส่วนลำดับกับพฤติกรรมเมื่อ action error ยืนยันด้วยการรัน
          </>
        )}
      </p>
    </figure>
  );
}
