# Verified findings

Every claim in a singing lesson has one of three tags.

- **book**: stated in Davids และ LaTour or Titze. The lesson gives the book and the printed page where the section starts (see `sources.md`).
- **ran**: a number from the site's own model of the voice, checked by `node subjects/singing/code/verify.mts` (191 checks when this file was written). A ran claim is about the model. It is never a claim that a real singer measures the same.
- **author**: a choice or an inference of the person who wrote the lesson, said so in the lesson.

Nothing here was tested on a person, with a microphone or with a real recording. The synthesized sounds were checked by their spectrum, not listened to.

## The model of the voice (`voice.ts`)

| Claim | Tag |
|---|---|
| The sound is a Rosenberg-type glottal pulse (open quotient, length of the closing phase, noise) passed through five resonators (F1 to F5), an optional ring peak, an optional nasal pole, then a first difference for the lips | author |
| The numbers that turn the firmness of closure 1 to 7 into pulse shape (`LEVELS` in `voice.ts`) are chosen so that firmer closure gives stronger high harmonics and less noise, as Davids และ LaTour describe | author |
| Firmer closure gives a shallower spectral slope, in order, from −14.0 dB/octave (level 1) to −6.8 (level 7); H2 below H1 by 15.2 dB (level 1) down to 3.3 dB (level 7); the table in the in-depth page of lesson 3 | ran |
| Level 4 gives a slope of about −11 dB/octave, close to the 12 dB/octave that Titze gives for normal voice | ran, book (Titze p.131) |
| At level 4: chest H2 is 6.0 dB below H1, head 10.7 dB, falsetto 18.1 dB | ran |
| The rendered sound agrees with the analytic spectrum that the labs draw to within 1.5 dB (levels 4, 6, 7; harmonics 2 to 20) | ran |
| A looped buffer has a whole number of periods, a pitch error under 0.5 cent and no jump at the seam | ran |
| The glottal onset in the model starts 150 cents flat, pressed, after a short silence, with a click; the breathy onset has air before voice | author (the model); book for the description (Davids และ LaTour p.49 to 53) |
| Vibrato curve: top-to-bottom extent in cents, rate in Hz, terminal vibrato grows toward the end | ran |

## Tubes and formants (`voice.ts`, `tract.ts`)

| Claim | Tag |
|---|---|
| A closed-open tube resonates at (2n − 1) c / 4L; for 17.5 cm and c = 35,000 cm/s that is 500, 1500, 2500, 3500 Hz | book (Titze p.153 and 159), ran |
| 14.8 cm gives 591, 1774, 2956, 4139 Hz; 15 cm gives 583, 1750, 2917, 4083; 20 cm gives 438, 1313, 2188, 3063 | ran |
| An open-open tube has F1 = c / 2L, twice the closed-open tube; partial closure shifts it toward the quarter-wave value | book (Titze p.158), ran |
| An epilarynx tube of 2, 2.5 and 3 cm resonates at 4375, 3500 and 2917 Hz by the same formula | ran; the comparison with the singer's formant is author |
| Formants of the vowels (F1 to F3) | Peterson and Barney 1952 (not the books), e and o and the neutral vowel: author |
| The five cardinal poses of the vocal tract model give F1 and F2 within 4 percent of the table for men (12 percent for women) | ran |
| More open jaw raises F1, tongue forward raises F2, high larynx raises every formant, rounded lips lower every formant, longer tract with low larynx and rounded lips | ran for the model, book for the effect (Davids และ LaTour p.67) |
| Ring (singer's formant) 2500 to 3200 Hz men, about 3200 Hz mezzo and contralto, up to 4000 Hz soprano; about 15 dB gain; 6 dB sounds twice as loud | book (Davids และ LaTour p.67) |
| Vowel modification: for a soprano's [e] on B♭4, D5, F5, A5, C6, with F1 left alone the level at C6 is 6.3 dB below the first note; with F1 moved to 1.18 times the note it is 9.5 dB above it, a difference of 15.8 dB | ran (model only) |

## Pitch detection (`pitch.ts`)

| Claim | Tag |
|---|---|
| The detector (McLeod method) finds the pitch of synthesized voices within 1 cent on notes from 98 to 880 Hz | ran |
| It recovers the vibrato rate within 0.15 Hz and the extent within 12 percent (with the correction for the length of the frame) | ran |
| It was not tested with a microphone or with a person | not tested |

## Book claims (selected)

The lessons cite the book at the end of each paragraph. The table lists only the numbers and rules that the quizzes ask about.

| Claim | Where |
|---|---|
| A4 is 440 openings of the folds per second; vocal folds average 14.9 mm (soprano), 16.6 (contralto), 18.4 (tenor), 20.9 mm (bass) | Davids และ LaTour บทที่ 3 หน้า 37 and 39 |
| The diaphragm is high in the chest; the abdominal and rib muscles, not the diaphragm, control exhalation; delaying its rise gives finer control | บทที่ 2 หน้า 19 and 25 |
| Higher pitch and louder singing need more breath pressure, not more airflow; doubling pressure about doubles the sound level (Sundberg); A3 to E4 needs about 150% more pressure | บทที่ 2 หน้า 29 |
| Maximum phonation time falls from about 20 s to 7 s when dancing | บทที่ 2 หน้า 31 |
| Closure scale 1 to 7: 1 breathy, 4 classical or legit (flow phonation), 7 heavy belt; styles by level | บทที่ 3 หน้า 45 |
| Chest belt needs about 50 percent more breath pressure than classical; mix belt only slightly more; G5 is about the upper limit of mix belt | บทที่ 3 หน้า 45 and 51 |
| SOVT: straw diameter matters more than length; 2.5 mm coffee stirrer, 5 mm soda straw; order from most to least restriction | บทที่ 3 หน้า 54 |
| Chest voice: TA dominant, strong second harmonic; head voice: CT dominant, strong fundamental; mix has chestmix and headmix | บทที่ 8 หน้า 158 and 160 |
| Register transitions (Tables 8.1 and 8.2) and ranges (Table 9.1) | บทที่ 8 หน้า 164, บทที่ 9 หน้า 177 |
| Four actions for a smooth transition: change formants by changing the vowel, change the mode of vibration, lower breath pressure, lower firmness of closure | บทที่ 8 หน้า 167 |
| Vibrato: 5 to 8 per second, 6 Hz judged most appropriate, about 100 cents total is pleasing and 200 too much; no true straight tone; level 4 closure gives the most potential for vibrato | บทที่ 7 หน้า 135, 136, 140 |
| Titze: the stabilised-tremor model, CT stimulated at 2 to 8 Hz responded most near 5 Hz, one singer's vibrato 5.6 Hz | Titze หน้า 322 |
| Phonation threshold pressure rises with fundamental frequency and with dry tissue; speaking and singing pressures are 1.5 to 4 times the threshold; tenors 1.5 to 3.5, untrained speakers above 4 | Titze หน้า 111 and 252 |
| Spectral slope of normal voice about 12 dB/octave; modal and falsetto differ by about 6 dB/octave | Titze หน้า 131 and 289 |
| A brief points system (Brancaccio): 10 points per half hour of singing or loud talking, at most 100 per day, 50 when unwell | Davids และ LaTour บทที่ 15 หน้า 260 |
| Warm-up sequence of eight steps and the sample sequence one | บทที่ 16 หน้า 283 and 286 |

## Not checked

- Whether the synthesized voices sound like a voice to a listener. They were never played to anyone.
- The artwork (sagittal head, torso, vocal folds) is drawn for readability and is not to scale.
- The warm-up player was run in a headless browser (the audio nodes are created without an error), but nobody sang along with it.
- The microphone lab was run with a fake input device in headless Chrome (no error); it has never heard a person.
- The Thai text was written for this path and read through once; it has not been edited by the owner.
