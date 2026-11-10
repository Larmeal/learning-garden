# Sources

Both books are kept outside this repository (markdown copies made from the PDFs, in `personal-knowledge/Clippings/singing/book/` on the owner's machine). The lessons cite them by the **printed page where the section starts**, because the markdown copies keep only some of the page numbers.

| Short name | Book | Used for |
|---|---|---|
| Davids และ LaTour | Julia Davids and Stephen LaTour, *Vocal Technique: A Guide to Classical and Contemporary Styles for Conductors, Teachers, and Singers*, second edition (Waveland Press) | Almost everything: posture, breathing, onset, resonance, vowels, registers, ranges, intonation, vibrato, tension, health, warm-up |
| Titze | Ingo R. Titze, *Principles of Voice Production* (National Center for Voice and Speech, second printing 2000) | Physics: phonation threshold pressure, spectral slope, the quarter-wave tube, intensity, vibrato as a stabilised tremor, register transitions |

## How a page number is found

A citation such as "Davids และ LaTour บทที่ 3 หน้า 45" is the printed page where the **section** that holds the statement starts (the table of contents of the book gives it). A statement deep inside a long section can be a page or two after the number. If you need the exact page, open the section.

Page numbers used, by chapter of Davids and LaTour (section, page):

- Chapter 1: Essentials of proper posture 9, Important aspects of body alignment 12.
- Chapter 2: Phases of the breathing cycle and Inhalation 19, Very brief suspension 24, Exhalation 25, Additional points about exhalation 29, Recovery 30, Breathing in contemporary styles 31, Breathing exercises 32.
- Chapter 3: How sound is initiated 37, Hydration 38, Components of the singer's instrument 39, Muscles affecting pitch 41, Firmness of glottal closure 45, Method of initiating sound 49, Some glottal onsets are useful 50, Is belting less healthy 51, Breathy onset 53, Release of sound 54, SOVT 54, Onset and release exercises 60.
- Chapter 4: Superior resonance 63, Fundamental frequency and higher harmonics 64, Structure of the vocal tract 65, Resonance and formants 67, Adjusting the larynx 78, Adjusting the oral pharynx 79, Adjusting the mouth 81, Classical versus contemporary resonance 83, Good resonance helps intonation and chest and head voice 85, Placement 86, Exercises 89.
- Chapter 5: Tongue tip 93, Basic vowel production 94, Bright versus dark 100, Vowels in contemporary styles 101, Vowel consistency and Problematic vowels 102, Modification of vowels for higher pitches 107, Vowel exercises 119.
- Chapter 6: The articulators 123, Consonant length 124, Consonants requiring special consideration 125, Think of w and y as vowels and Voiced versus unvoiced 127, Final consonants 131.
- Chapter 7: Vibrato is a natural phenomenon 135, Rate and extent 136, Style implications 139, Solving vibrato problems 140.
- Chapter 8: What are vocal registers 157, Two main registers 158, Middle register 160, Children's registers 161, Differences in styles 162, Passaggi 164, Negotiating 167, Special registers 170, Register exercises 173.
- Chapter 9: Classification and ranges (Table 9.1) 177, Tessitura 180, Singing higher pitches 182, Lower pitches for females 184, Handling leaps 185.
- Chapter 10: Causes of poor intonation 189, Exercises 196.
- Chapter 11: Legato and Staccato 199 and 202, Accents and ornaments 203, Dynamic control 206, Special vocal effects 208.
- Chapter 14: Larynx and neck 245, Jaw 247, Tongue 249, Lips and shoulders 252, Legs 253, Exercises 254.
- Chapter 15: Hydration 258, Vocal stamina 260, Stress 261, Meals 262, Gastric reflux 263, Colds 264.
- Chapter 16: Why warm-ups 281, Warm-up sequence 283, Sample sequences 286, Cool-down 287.

Page numbers used, by section of Titze: Phonation threshold pressure (chapter 4) 111 and (chapter 9) 252, Spectral slope 131, The quarter-wave resonance tube 153, half-wave tube 158, frequency spectrum of the resonating tube 159, Formant tuning 257, Vocal ring 265, Vocal registers 281 to 289, Clinical notes on registers 301, Vibrato 322, Breathing (clinical notes) 80.

## What is not from the books

- The average formants of the vowels i, ɪ, ɛ, æ, ɑ, ɔ, ʊ, u, ʌ come from Peterson and Barney (1952), the standard table, which the books reproduce only as a figure that the markdown copy does not keep. The values were written from that table, not read from the books. The vowels e and o and the neutral vowel are the author's interpolations, and the women's neutral vowel is the men's tube scaled by 0.85.
- The model of the voice in `site/src/lib/voice.ts` and the mapping from mouth shape to formants in `tract.ts` are the author's own teaching models (see `verified-findings.md`).
