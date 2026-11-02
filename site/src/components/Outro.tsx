import type { ReactNode } from 'react';
import GrowArt from './GrowArt';
import type { PageItem } from './PageList';
import { isFinished, useLessonStatus, useProgress } from './useProgress';
import { ui, type Lang } from '../i18n';

interface Props {
  pageId: string;
  pages: PageItem[]; // all pages of this lesson
  lessons: string[][]; // page ids of every lesson in the subject, for the "finished n of m" line
  nextHref?: string;
  nextTitle?: string;
  nextIsSameLesson: boolean;
  mapHref: string;
  subjectName: string;
  lang?: Lang;
}

// Last card of a step page. This page is ticked here once its questions are answered; the lesson's tree
// grows to full size when every page of the lesson is ticked.
export default function Outro({ pageId, pages, lessons, nextHref, nextTitle, nextIsSameLesson, mapHref, subjectName, lang = 'th' }: Props) {
  const t = ui[lang].outro;
  const tick = ui[lang].tick;
  const s = useLessonStatus(pageId, pages.map((p) => p.id));
  const { done } = useProgress();
  const finishedLessons = lessons.filter((ids) => isFinished(done, ids)).length;
  const many = pages.length > 1;
  const left = pages.filter((p) => s.remaining.includes(p.id));

  const goBackToQuestion = () => window.dispatchEvent(new Event('garden:goto-unanswered'));

  let heading = many ? t.endOfPage : t.endOfLesson;
  let text: ReactNode;
  if (s.lessonFinished) {
    heading = t.treeGrown;
    text = nextTitle ? t.nextIs(nextTitle) : t.lastLesson(subjectName);
  } else if (s.pageDone) {
    heading = t.pageDone;
    text = (
      <>
        {tick.remaining}{' '}
        {left.map((p, i) => (
          <span key={p.id}>
            {i > 0 && ', '}
            <a href={p.href}>{p.title}</a>
          </span>
        ))}
      </>
    );
  } else if (!s.canFinish) {
    text = t.unanswered(s.left);
  } else {
    text = many ? t.tickPage : t.tickLesson;
  }

  return (
    <div className="outro-card">
      <div className="art-wrap">
        <GrowArt stage={s.lessonFinished ? 'evergreen' : 'sprout'} lang={lang} />
      </div>
      <h2>{heading}</h2>
      <p>{text}</p>
      <div className="actions">
        <button type="button" className={`btn lg ${s.pageDone ? '' : 'primary'}`} disabled={!s.pageDone && !s.canFinish} aria-pressed={s.pageDone} onClick={s.toggle}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
          {s.pageDone ? tick.done : many ? tick.markPage : tick.markLesson}
        </button>
        {!s.pageDone && !s.canFinish && (
          <button type="button" className="btn lg" onClick={goBackToQuestion}>
            {t.goToQuestions}
          </button>
        )}
      </div>
      <div className="actions">
        {nextHref && (
          <a className={`btn lg ${s.pageDone ? 'primary' : ''}`} href={nextHref}>
            {nextIsSameLesson ? t.nextPage : t.nextLesson}
          </a>
        )}
        <a className="btn lg" href={mapHref}>
          {t.backToMap}
        </a>
      </div>
      <span className="outro-count">{t.count(finishedLessons, lessons.length)}</span>
    </div>
  );
}
