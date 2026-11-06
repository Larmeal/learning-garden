import { useCallback, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';

// Shared by the Spark labs that run on a clock instead of on steps. A lab draws itself as a pure function of the
// clock time t (seconds), so the person can play, pause, drag the slider and watch the same moment again.

export function useClock(duration: number, autoplay = true) {
  const reduce = useReducedMotion();
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const now = useRef(0);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (stamp: number) => {
      const next = Math.min(duration, now.current + ((stamp - last) / 1000) * speed);
      last = stamp;
      now.current = next;
      setT(next);
      if (next >= duration) setPlaying(false);
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, duration]);

  // Start on its own once, unless the person asked their system for less motion.
  useEffect(() => {
    if (autoplay && !reduce) setPlaying(true);
  }, [autoplay, reduce]);

  const seek = useCallback((to: number) => {
    const v = Math.max(0, Math.min(duration, to));
    now.current = v;
    setT(v);
    setPlaying(false);
  }, [duration]);
  const play = useCallback(() => {
    if (now.current >= duration) {
      now.current = 0;
      setT(0);
    }
    setPlaying(true);
  }, [duration]);
  const pause = useCallback(() => setPlaying(false), []);
  const restart = useCallback(() => {
    now.current = 0;
    setT(0);
    setPlaying(true);
  }, []);
  return { t, playing, speed, setSpeed, seek, play, pause, restart, duration };
}

export type Clock = ReturnType<typeof useClock>;

// 0 before a, 1 after b, a straight line in between.
export const prog = (t: number, a: number, b: number) => Math.max(0, Math.min(1, (t - a) / (b - a)));
export const smooth = (x: number) => x * x * (3 - 2 * x);
export const mix = (a: number, b: number, x: number) => a + (b - a) * x;

export type Lang = 'th' | 'en';
const CTRL = {
  th: { stop: 'หยุด', again: 'เล่นใหม่', play: 'เล่น', restart: 'เริ่มใหม่', scrub: 'เลื่อนดูเวลาในภาพเคลื่อนไหว', speed: 'ความเร็ว', jump: 'ข้ามไปช่วงที่สนใจ' },
  en: { stop: 'Pause', again: 'Replay', play: 'Play', restart: 'Restart', scrub: 'Scrub through the animation', speed: 'Speed', jump: 'Jump to a moment' },
};

export interface Mark {
  at: number;
  name: string;
  title: string;
  text: string;
}

// The "now" box, the scrub bar and the buttons that every clock lab shows under its picture.
export function ClockControls({ clock, marks, lang = 'th' }: { clock: Clock; marks: Mark[]; lang?: Lang }) {
  const c = CTRL[lang];
  let current = 0;
  marks.forEach((m, i) => {
    if (clock.t >= m.at) current = i;
  });
  const m = marks[current];
  const atEnd = clock.t >= clock.duration;
  return (
    <>
      <div className="viz-now" aria-live="off">
        <strong>{m.title}</strong>
        <span>{m.text}</span>
      </div>
      <div className="viz-controls">
        <button type="button" className="btn primary" onClick={clock.playing ? clock.pause : clock.play}>
          {clock.playing ? c.stop : atEnd ? c.again : c.play}
        </button>
        <button type="button" className="btn" onClick={clock.restart}>{c.restart}</button>
        <input
          className="viz-scrub"
          type="range"
          min={0}
          max={clock.duration}
          step={0.01}
          value={clock.t}
          aria-label={c.scrub}
          onChange={(e) => clock.seek(Number(e.target.value))}
        />
        <div className="viz-steps" role="group" aria-label={c.speed}>
          {[0.5, 1, 2].map((s) => (
            <button key={s} type="button" aria-pressed={clock.speed === s} onClick={() => clock.setSpeed(s)}>{s}x</button>
          ))}
        </div>
      </div>
      <div className="viz-steps" role="group" aria-label={c.jump}>
        {marks.map((mk, i) => (
          <button key={mk.name} type="button" aria-pressed={i === current} onClick={() => clock.seek(mk.at + 0.02)}>
            {i + 1}. {mk.name}
          </button>
        ))}
      </div>
    </>
  );
}
