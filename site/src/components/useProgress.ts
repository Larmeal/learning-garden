import { useCallback, useEffect, useState } from 'react';
import type { PlantStage } from './Plant';

// Per-browser progress, kept in localStorage so it never leaves this device.
//   garden:progress  { "<subject>/<slug>": true }          lessons the learner ticked as finished
//   garden:quiz      { "<subject>/<slug>": ["<key>", ...] } question cards answered (right or wrong)
const KEY = 'garden:progress';
const QUIZ = 'garden:quiz';
const EVT = 'garden-progress';

function read<T>(key: string): Record<string, T> {
  try {
    return JSON.parse(localStorage.getItem(key) || '{}');
  } catch {
    return {};
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage blocked: the change lasts for this page view only
  }
  window.dispatchEvent(new Event(EVT));
}

// The plant a lesson shows: a seed while its content is only an outline, a sprout once the learner can start,
// a full tree after they answered every question and ticked the lesson.
export function plantStage(content: PlantStage, finished: boolean): PlantStage {
  return content === 'seed' ? 'seed' : finished ? 'evergreen' : 'sprout';
}

// Stable short key for a question, so an answer survives reloads and edits elsewhere in the lesson.
export function questionKey(q: string): string {
  let h = 5381;
  for (let i = 0; i < q.length; i++) h = ((h << 5) + h + q.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export function recordAnswer(lessonId: string, key: string) {
  const all = read<string[]>(QUIZ);
  const list = all[lessonId] ?? [];
  if (list.includes(key)) return;
  write(QUIZ, { ...all, [lessonId]: [...list, key] });
}

export function useProgress() {
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [quiz, setQuiz] = useState<Record<string, string[]>>({});

  useEffect(() => {
    const sync = () => {
      setDone(read<boolean>(KEY));
      setQuiz(read<string[]>(QUIZ));
    };
    sync();
    window.addEventListener(EVT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const toggle = useCallback((id: string) => {
    const next = read<boolean>(KEY);
    if (next[id]) delete next[id];
    else next[id] = true;
    write(KEY, next);
  }, []);

  return { done, quiz, toggle };
}

// Status of the lesson on the current page: how many questions it has, how many were answered, and whether it can be ticked.
export function useLessonStatus(lessonId: string) {
  const { done, quiz, toggle } = useProgress();
  const [keys, setKeys] = useState<string[]>([]);

  useEffect(() => {
    const found = document.querySelectorAll('[data-steps-root] [data-q]');
    setKeys([...new Set(Array.from(found, (el) => el.getAttribute('data-q') ?? ''))]);
  }, []);

  const answered = keys.filter((k) => (quiz[lessonId] ?? []).includes(k)).length;
  const total = keys.length;
  return {
    finished: !!done[lessonId],
    answered,
    total,
    left: total - answered,
    canFinish: answered >= total,
    toggle: () => toggle(lessonId),
  };
}
