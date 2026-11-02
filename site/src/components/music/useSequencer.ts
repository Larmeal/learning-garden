import { useCallback, useEffect, useRef, useState } from 'react';
import { audio } from './audio';

// A looping step clock. `onStep(step, when)` is called slightly ahead of time with the AudioContext offset (seconds
// from now) at which the step should sound, so labs schedule sound on the audio clock and the UI just follows
// `current`. Steps are `subdivision` per beat (2 = eighth notes in x/4).

interface Options {
  steps: number;
  bpm: number;
  subdivision: number;
  onStep: (step: number, when: number) => void;
}

export function useSequencer({ steps, bpm, subdivision, onStep }: Options) {
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(-1);
  const live = useRef({ steps, bpm, subdivision, onStep });
  live.current = { steps, bpm, subdivision, onStep };
  const timer = useRef<number | null>(null);
  const next = useRef({ step: 0, time: 0 });
  const ui = useRef<number[]>([]);

  const stop = useCallback(() => {
    if (timer.current !== null) window.clearInterval(timer.current);
    timer.current = null;
    ui.current.forEach((t) => window.clearTimeout(t));
    ui.current = [];
    setPlaying(false);
    setCurrent(-1);
  }, []);

  const start = useCallback(() => {
    const c = audio();
    if (!c) return;
    next.current = { step: 0, time: c.currentTime + 0.08 };
    setPlaying(true);
    const tick = () => {
      const { bpm, subdivision, steps, onStep } = live.current;
      const stepLen = 60 / bpm / subdivision;
      while (next.current.time < c.currentTime + 0.12) {
        const step = next.current.step % steps;
        const when = next.current.time - c.currentTime;
        onStep(step, Math.max(0, when));
        ui.current.push(window.setTimeout(() => setCurrent(step), Math.max(0, when * 1000)));
        next.current.step = step + 1;
        next.current.time += stepLen;
      }
      if (ui.current.length > 64) ui.current = ui.current.slice(-32);
    };
    tick();
    timer.current = window.setInterval(tick, 25);
  }, []);

  useEffect(() => stop, [stop]);

  return { playing, current, start, stop, toggle: () => (playing ? stop() : start()) };
}
