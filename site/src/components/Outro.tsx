import type { ReactNode } from 'react';
import GrowArt from './GrowArt';
import type { PageItem } from './PageList';
import { isFinished, useLessonStatus, useProgress } from './useProgress';

interface Props {
  pageId: string;
  pages: PageItem[]; // all pages of this lesson
  lessons: string[][]; // page ids of every lesson in the subject, for the "finished n of m" line
  nextHref?: string;
  nextTitle?: string;
  nextIsSameLesson: boolean;
  mapHref: string;
  subjectName: string;
}

// Last card of a step page. This page is ticked here once its questions are answered; the lesson's tree
// grows to full size when every page of the lesson is ticked.
export default function Outro({ pageId, pages, lessons, nextHref, nextTitle, nextIsSameLesson, mapHref, subjectName }: Props) {
  const s = useLessonStatus(pageId, pages.map((p) => p.id));
  const { done } = useProgress();
  const finishedLessons = lessons.filter((ids) => isFinished(done, ids)).length;
  const many = pages.length > 1;
  const left = pages.filter((p) => s.remaining.includes(p.id));

  const goBackToQuestion = () => window.dispatchEvent(new Event('garden:goto-unanswered'));

  let heading = many ? 'ถึงท้ายหน้านี้แล้ว' : 'ถึงท้ายบทแล้ว';
  let text: ReactNode;
  if (s.lessonFinished) {
    heading = 'ต้นนี้โตเต็มที่แล้ว';
    text = nextTitle ? <>ต่อไปคือ {nextTitle}</> : <>นี่คือบทสุดท้ายของเรื่อง {subjectName}</>;
  } else if (s.pageDone) {
    heading = 'หน้านี้เรียบร้อยแล้ว';
    text = (
      <>
        ต้นไม้ของบทนี้จะโตเต็มที่เมื่อครบทุกหน้า เหลืออีก:{' '}
        {left.map((p, i) => (
          <span key={p.id}>
            {i > 0 && ', '}
            <a href={p.href}>{p.title}</a>
          </span>
        ))}
      </>
    );
  } else if (!s.canFinish) {
    text = `ยังเหลือคำถามที่ยังไม่ได้ตอบอีก ${s.left} ข้อ ตอบให้ครบก่อน แล้วจึงติ๊กได้`;
  } else {
    text = many ? 'กดติ๊กว่าอ่านหน้านี้จบ ต้นไม้จะโตเต็มที่เมื่อครบทุกหน้าของบท' : 'ตอบคำถามครบแล้ว กดติ๊กว่าอ่านจบ ต้นไม้ของบทนี้จะโตเต็มที่';
  }

  return (
    <div className="outro-card">
      <div className="art-wrap">
        <GrowArt stage={s.lessonFinished ? 'evergreen' : 'sprout'} />
      </div>
      <h2>{heading}</h2>
      <p>{text}</p>
      <div className="actions">
        <button type="button" className={`btn lg ${s.pageDone ? '' : 'primary'}`} disabled={!s.pageDone && !s.canFinish} aria-pressed={s.pageDone} onClick={s.toggle}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
          {s.pageDone ? 'อ่านจบแล้ว (กดเพื่อยกเลิก)' : many ? 'ติ๊กว่าอ่านหน้านี้จบแล้ว' : 'ติ๊กว่าอ่านจบแล้ว'}
        </button>
        {!s.pageDone && !s.canFinish && (
          <button type="button" className="btn lg" onClick={goBackToQuestion}>
            ไปตอบข้อที่เหลือ
          </button>
        )}
      </div>
      <div className="actions">
        {nextHref && (
          <a className={`btn lg ${s.pageDone ? 'primary' : ''}`} href={nextHref}>
            {nextIsSameLesson ? 'หน้าถัดไป' : 'บทถัดไป'}
          </a>
        )}
        <a className="btn lg" href={mapHref}>
          กลับไปแผนที่
        </a>
      </div>
      <span className="outro-count">เรียนจบแล้ว {finishedLessons} จาก {lessons.length} บท</span>
    </div>
  );
}
