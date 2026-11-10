# Singing: overview

A path of ten Thai lessons on how the singing voice works and how to practise it, written from Davids และ LaTour (*Vocal Technique*, second edition) and Titze (*Principles of Voice Production*). Thai only for now (no `lessons-en/singing/`, so the English home page lists it as "Thai only").

## Lessons

| # | Slug | Phase | What it teaches | Labs |
|---|---|---|---|---|
| 1 | `how-voice-works` | A | power, source, filter; the whole anatomy; how the folds vibrate; harmonics; why we steer by sound, not by muscles | `SingerAnatomy` |
| 2 | `posture-breath` | A | alignment, the four phases of a breath, appoggio, what the diaphragm does and does not do | `BreathLab` |
| 3 | `vocal-folds` (+ `in-depth`) | B | CT and TA, firmness of closure 1 to 7, the three onsets, release, SOVT, belt and health. In-depth: phonation threshold pressure, pulse shape and harmonics | `VocalFoldLab`, `OnsetLab` |
| 4 | `registers` | B | chest, head, mix, passaggi by voice type, four ways to cross a transition, falsetto, whistle, fry | `RegisterLab` |
| 5 | `resonance` (+ `in-depth`) | C | formants, source-filter, tract length, singer's formant, myths about placement. In-depth: the quarter-wave tube | `VocalTractLab`, `TubeLab` |
| 6 | `vowels` | C | vowel chart, bright and dark, problem vowels, modification for high pitches, consonants | `VowelMap`, `VowelModify` |
| 7 | `pitch-intonation` | D | voice types and ranges, tessitura, higher and lower pitches, leaps, causes of poor intonation | `RegisterLab view="ranges"`, `PitchMirror` |
| 8 | `vibrato-dynamics` | D | vibrato rate and extent, problems, legato, staccato, melisma, messa di voce | `VibratoLab` |
| 9 | `tension-health` | D | tension in neck, jaw, tongue, lips, shoulders, legs; hydration, rest, reflux, colds | none |
| 10 | `warm-up-practice` | D | why and how to warm up, the sequence, cool-down, a weekly plan | `WarmupPlayer` |

Every lesson has a quiz page (5 questions).

## Code

- `site/src/lib/voice.ts`: the synthesizer (source, filter, onsets, vibrato), tubes, analysis (harmonic levels, FFT), notes. Pure maths, no DOM.
- `site/src/lib/tract.ts`: poses of the mouth and throat to formants.
- `site/src/lib/pitch.ts`: pitch detector (McLeod) and a vibrato estimator.
- `site/src/components/labs/singing/`: the labs and their shared pieces (`art.tsx` is the head and torso drawing, `folds.tsx` the vocal fold drawings, `plots.tsx` the spectrum plots, `voiceAudio.ts` plays a buffer).
- `subjects/singing/code/verify.mts`: checks every number the lessons state about the model (`node subjects/singing/code/verify.mts` from the repo root).

## Choices that are not obvious

- The sounds are synthesized in the browser (a buffer is rendered when a slider moves, and looped). A buffer for a loop holds a whole number of periods so that it does not click.
- Coordinates in SVG are rounded in `plots.tsx` and `folds.tsx`. Without that, the server and the browser disagree in the last digits of a float and React reports a hydration mismatch.
- The microphone lab (`PitchMirror`) never records or sends sound; it analyses frames and throws them away. It asks for no echo cancellation, noise suppression or gain control, because those change the pitch.
- The warm-up player stops before the top of the comfortable range of the chosen voice part (Table 9.1), so it never walks a person up to a note that hurts.

## Open

- English translation (lessons, quizzes, the `en` block of the subject, a `lang` prop on every lab).
- A listening check of the synthesized voices by the owner, and fixing whatever sounds wrong.
- Thai prose read and edited by the owner.
- A glossary page (like the guitar one) for the English terms.
- Child and adolescent voices, aging voices, choral blend and intonation in ensembles (chapters 12 and 13 of Davids และ LaTour) are not covered.
