import GrowArt from './GrowArt';
import { useLessonStatus, useProgress } from './useProgress';

interface Props {
  lessonId: string;
  subjectId: string;
  total: number;
  nextHref?: string;
  nextTitle?: string;
  mapHref: string;
  subjectName: string;
}

// Last card of a step lesson. The tree only grows to full size once every question was answered and the learner ticks the lesson.
export default function Outro({ lessonId, subjectId, total, nextHref, nextTitle, mapHref, subjectName }: Props) {
  const s = useLessonStatus(lessonId);
  const { done } = useProgress();
  const doneCount = Object.keys(done).filter((k) => k.startsWith(`${subjectId}/`)).length;

  const goBackToQuestion = () => window.dispatchEvent(new Event('garden:goto-unanswered'));

  return (
    <div className="outro-card">
      <div className="art-wrap">
        <GrowArt stage={s.finished ? 'evergreen' : 'sprout'} />
      </div>
      <h2>{s.finished ? 'ต้นนี้โตเต็มที่แล้ว' : 'ถึงท้ายบทแล้ว'}</h2>
      <p>
        {s.finished
          ? nextTitle
            ? <>บทถัดไปคือ {nextTitle}</>
            : <>นี่คือบทสุดท้ายของเรื่อง {subjectName}</>
          : s.canFinish
            ? 'ตอบคำถามครบแล้ว กดติ๊กว่าอ่านจบ ต้นไม้ของบทนี้จะโตเต็มที่'
            : `ยังเหลือคำถามที่ยังไม่ได้ตอบอีก ${s.left} ข้อ ตอบให้ครบก่อน แล้วต้นไม้จะโตได้`}
      </p>
      <div className="actions">
        <button type="button" className={`btn lg ${s.finished ? '' : 'primary'}`} disabled={!s.finished && !s.canFinish} aria-pressed={s.finished} onClick={s.toggle}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
          {s.finished ? 'อ่านจบแล้ว (กดเพื่อยกเลิก)' : 'ติ๊กว่าอ่านจบแล้ว'}
        </button>
        {!s.finished && !s.canFinish && (
          <button type="button" className="btn lg" onClick={goBackToQuestion}>
            ไปตอบข้อที่เหลือ
          </button>
        )}
      </div>
      <div className="actions">
        {nextHref && (
          <a className={`btn lg ${s.finished ? 'primary' : ''}`} href={nextHref}>
            บทถัดไป
          </a>
        )}
        <a className="btn lg" href={mapHref}>
          กลับไปแผนที่
        </a>
      </div>
      <span className="outro-count">เรียนแล้ว {doneCount} จาก {total} บท</span>
    </div>
  );
}
