import { useEffect, useMemo, useRef, useState } from 'react';
import { FullBody } from './art';
import { Pills } from '../../music/Controls';
import { NEUTRAL, type Pose } from '../../../lib/tract';

// The whole instrument in one picture: lungs, ribs, diaphragm and abdominal wall (the power), the vocal folds (the source),
// and the throat, tongue, jaw, palate and lips (the filter). Press a part to read what it does; the dots follow the air.

type Group = 'power' | 'source' | 'filter';

interface Part {
  key: string;
  name: string;
  group: Group;
  does: string;
  feel: string;
  source: string;
}

const PARTS: Part[] = [
  {
    key: 'lungs', name: 'ปอด (lungs)', group: 'power',
    does: 'เก็บอากาศไว้ และเป็นแหล่งที่ลมถูกดันออกไปหาเส้นเสียง ปอดไม่มีกล้ามเนื้อของตัวเอง จึงขยายและหดตามการเคลื่อนของซี่โครงและกะบังลม',
    feel: 'วางมือที่ซี่โครงด้านข้างแล้วหายใจเข้าช้าๆ จะรู้สึกว่าซี่โครงขยายออกด้านข้าง',
    source: 'Davids และ LaTour บทที่ 2 หัวข้อ Inhalation หน้า 19',
  },
  {
    key: 'ribs', name: 'ซี่โครงและกล้ามเนื้อซี่โครง (intercostals)', group: 'power',
    does: 'external intercostals ยกซี่โครงออกตอนหายใจเข้า internal intercostals ช่วยดันลมออกตอนหายใจออก การไม่ยกอกส่วนบนหรือกระดกไหล่ช่วยให้หายใจเต็มกว่าและไม่เกร็งคอ',
    feel: 'ถ้าไหล่ยกตอนหายใจเข้า แปลว่ากำลังใช้ clavicular breathing (หายใจด้วยอกส่วนบน) ซึ่งได้ลมน้อยและคุมลมออกยาก',
    source: 'Davids และ LaTour บทที่ 2 หัวข้อ Inhalation หน้า 19 และ Exhalation หน้า 25',
  },
  {
    key: 'diaphragm', name: 'กะบังลม (diaphragm)', group: 'power',
    does: 'กล้ามเนื้อรูปโดมใต้ปอด หดตัวแล้วเลื่อนลงทำให้อากาศไหลเข้า จุดสูงสุดของโดมอยู่สูงกว่าที่คนส่วนใหญ่คิดมาก ตอนหายใจออกเราไม่ได้คุมกะบังลมโดยตรง แต่ใช้กล้ามเนื้อซี่โครงและหน้าท้องที่ต้านไว้ไม่ให้มันขึ้นเร็วเกินไป',
    feel: 'คำว่า "ร้องจากกะบังลม" เป็นภาพช่วยจำ ตำแหน่งที่ควรสนใจคือหน้าท้องและซี่โครง',
    source: 'Davids และ LaTour บทที่ 2 หัวข้อ Inhalation หน้า 19 และ Exhalation หน้า 25',
  },
  {
    key: 'abs', name: 'กล้ามเนื้อหน้าท้อง (abdominals)', group: 'power',
    does: 'ผ่อนออกตอนหายใจเข้าเพื่อให้กะบังลมลงได้เต็มที่ ตอนหายใจออกหดตัวเบาๆ ต้านกับกล้ามเนื้อซี่โครงเพื่อคุมแรงดันลม ที่เรียกว่า appoggio',
    feel: 'วางนิ้วที่หน้าท้องระหว่างกระดูกอกกับสะดือ ควรรู้สึกว่ากล้ามเนื้อทำงานแต่ยังมีความยืดหยุ่นเหมือนฟูกที่แน่น',
    source: 'Davids และ LaTour บทที่ 2 หัวข้อ Exhalation หน้า 25',
  },
  {
    key: 'trachea', name: 'ท่อลม (trachea)', group: 'power',
    does: 'ท่อที่นำลมจากปอดขึ้นไปหากล่องเสียง เมื่อกะบังลมลงมันดึงท่อลมลงตามเล็กน้อย (tracheal pull) ทำให้กล่องเสียงต่ำลงและ epilarynx แคบลง',
    feel: 'เอานิ้วแตะที่ลูกกระเดือก หายใจเข้าแบบหาวเบาๆ จะรู้สึกว่ากล่องเสียงลดลงเล็กน้อย',
    source: 'Davids และ LaTour บทที่ 2 หัวข้อ Exhalation หน้า 25 และบทที่ 4 หัวข้อ Adjusting the larynx หน้า 78',
  },
  {
    key: 'larynx', name: 'กล่องเสียง (larynx)', group: 'source',
    does: 'โครงกระดูกอ่อนที่ห่อหุ้มเส้นเสียง แขวนอยู่กับกระดูก hyoid ซึ่งเชื่อมกับลิ้นด้วย ดังนั้นลิ้นที่เกร็งจะดึงกล่องเสียงไปด้วย กล้ามเนื้อเหนือกล่องเสียง (กลืน) ดึงขึ้น กล้ามเนื้อใต้กล่องเสียง (หาว) ดึงลง',
    feel: 'แตะที่ลูกกระเดือกแล้วกลืนน้ำลาย จะรู้สึกว่ามันขึ้น แตะแล้วทำท่าจะหาว จะรู้สึกว่ามันลง',
    source: 'Davids และ LaTour บทที่ 3 หัวข้อ Components of the singer’s instrument หน้า 39',
  },
  {
    key: 'folds', name: 'เส้นเสียง (vocal folds)', group: 'source',
    does: 'สองแผ่นเนื้อเยื่อเล็กๆ ยาวประมาณ 15 mm (soprano) ถึง 21 mm (bass) เมื่อมีแรงดันลมใต้เส้นเสียงพอ มันเปิดและปิดซ้ำๆ แต่ละรอบปล่อยลมออกมาเป็นพัฟ จำนวนรอบต่อวินาทีคือความถี่ของโน้ต โน้ต A4 หมายถึง 440 รอบต่อวินาที',
    feel: 'ไม่มีใครบังคับเส้นเสียงโดยตรงได้ เรากำหนดโน้ตด้วยการคิดถึงเสียงที่อยากได้ก่อนร้อง',
    source: 'Davids และ LaTour บทที่ 3 หัวข้อ How sound is initiated and created หน้า 37 และ Components of the singer’s instrument หน้า 39',
  },
  {
    key: 'epiglottis', name: 'ฝาปิดกล่องเสียง (epiglottis)', group: 'filter',
    does: 'พับปิดกล่องเสียงตอนกลืนเพื่อกันอาหารลงปอด ตอนร้องมันไม่ได้ปิด แต่ท่อแคบๆ ที่อยู่เหนือเส้นเสียงขึ้นไปประมาณ 2 ถึง 3 cm (epilarynx tube) เป็นที่เกิดเสียงแหลมใส (singer’s formant)',
    feel: 'ท่อนี้แคบลงเมื่อกล่องเสียงอยู่ต่ำสบายๆ และลำคอไม่เกร็ง',
    source: 'Davids และ LaTour บทที่ 4 หัวข้อ Resonance and formants หน้า 67 (Singer’s formant)',
  },
  {
    key: 'pharynx', name: 'คอหอย (pharynx)', group: 'filter',
    does: 'ช่องที่ใหญ่ที่สุดของช่องเสียง ตั้งแต่เหนือเส้นเสียงขึ้นไปถึงหลังปาก F1 มักมาจากช่องนี้ การลดกรามด้านหลังและยกเพดานอ่อนทำให้มันกว้างขึ้นสำหรับเสียงคลาสสิก',
    feel: 'ทำท่าเริ่มหาว เพื่อรู้สึกถึงคอหอยที่กว้างขึ้นและกล่องเสียงที่ต่ำลง',
    source: 'Davids และ LaTour บทที่ 4 หัวข้อ Adjusting the oral pharynx หน้า 79',
  },
  {
    key: 'tongue', name: 'ลิ้น (tongue)', group: 'filter',
    does: 'ลิ้นอยู่เกือบเต็มปาก ตำแหน่งสูงสุดของลิ้นเปลี่ยนรูปร่างของช่องปาก จึงเปลี่ยน F2 ปลายลิ้นควรพักอยู่ที่โคนฟันหน้าล่างทุกครั้งที่ร้องสระ',
    feel: 'ร้อง [i] แล้วเลื่อนลิ้นไปหลังเป็น [u] จะได้ยินสีเสียงมืดลง',
    source: 'Davids และ LaTour บทที่ 5 หัวข้อ Tip of the tongue should rest at the base of the lower front teeth หน้า 93',
  },
  {
    key: 'jaw', name: 'กราม (jaw)', group: 'filter',
    does: 'ลดกรามโดยเฉพาะด้านหลังทำให้คอหอยกว้างและยก F1 ขึ้น เสียงคลาสสิกใช้ "ปลดกรามด้านหลัง" มากกว่าอ้าปากด้านหน้า',
    feel: 'วางนิ้วใต้ขมับหน้าหู แล้วอ้าปาก จะรู้สึกว่าข้อต่อกรามคลายออกเป็นร่อง',
    source: 'Davids และ LaTour บทที่ 4 หัวข้อ Adjusting the oral pharynx หน้า 79',
  },
  {
    key: 'palate', name: 'เพดานแข็ง (hard palate)', group: 'filter',
    does: 'หลังคาของปาก ลิ้นเข้าใกล้เพดานแข็งมากเมื่อร้อง [i] จึงเกิดช่องแคบที่ทำให้ F2 สูง ตำแหน่งนี้ไม่ใช่ที่ที่เสียงไปกระทบแล้วสะท้อน คำว่า "วางเสียงที่เพดาน" เป็นภาพช่วยจำเท่านั้น',
    feel: 'ลองร้อง [i] แล้วสังเกตว่ากลางลิ้นเข้าใกล้เพดานมาก',
    source: 'Davids และ LaTour บทที่ 4 หัวข้อ Resonance and “placement” หน้า 86',
  },
  {
    key: 'velum', name: 'เพดานอ่อน (soft palate, velum)', group: 'filter',
    does: 'ยกขึ้นปิดทางเข้าจมูกเมื่อร้องสระปกติ ถ้าปล่อยต่ำ เสียงจะผ่านโพรงจมูก ทำให้ F1 เบาลงและเสียงมีกลิ่นนาสิก สไตล์ร่วมสมัยบางแบบลดเพดานอ่อนลงนิดหน่อยเพื่อให้สว่างขึ้นโดยยังไม่ได้ยินว่านาสิก',
    feel: 'หายใจเข้าทางปากอย่างตกใจ จะรู้สึกว่าเพดานอ่อนยกขึ้น',
    source: 'Davids และ LaTour บทที่ 4 หัวข้อ Structure of the vocal tract หน้า 65 และ Adjusting the oral pharynx หน้า 79',
  },
  {
    key: 'nasal', name: 'โพรงจมูก (nasal cavity)', group: 'filter',
    does: 'เป็น resonator เฉพาะเสียงนาสิก เช่น [m] [n] [ŋ] และสระนาสิกในภาษาฝรั่งเศส สำหรับสระทั่วไป เสียงที่ผู้ฟังได้ยินไม่ได้มาจากโพรงจมูกหรือไซนัส ความรู้สึกสั่นที่หน้าผากคือการสั่นที่นำผ่านกระดูก ซึ่งมีแต่คนร้องที่รู้สึก',
    feel: 'บีบจมูกตอนร้องสระ ถ้าเสียงเปลี่ยน แปลว่าลมรั่วออกทางจมูก',
    source: 'Davids และ LaTour บทที่ 4 หัวข้อ Resonance and the concepts of “chest voice” and “head voice” หน้า 85',
  },
  {
    key: 'lips', name: 'ริมฝีปาก (lips)', group: 'filter',
    does: 'ปลายสุดของช่องเสียง จู๋ริมฝีปากทำให้ท่อยาวขึ้น formant ทุกตัวต่ำลง เสียงมืดขึ้น ยิ้มกว้างทำให้ท่อสั้นลง formant สูงขึ้น เสียงสว่างขึ้น',
    feel: 'ร้อง [ɑ] แล้วค่อยๆ ยิ้มกว้าง แล้วค่อยๆ จู๋ปาก ฟังสีเสียงที่เปลี่ยนไป',
    source: 'Davids และ LaTour บทที่ 4 หัวข้อ Adjusting the mouth หน้า 81',
  },
];


const PARTS_EN: Record<string, { name: string; does: string; feel: string; source: string }> = {
  lungs: {
    name: 'Lungs',
    does: 'They store the air and are where the air is pushed out toward the vocal folds. The lungs have no muscle of their own, so they expand and shrink with the movement of the ribs and the diaphragm.',
    feel: 'Put your hand on the side of your ribs and breathe in slowly. You will feel the ribs expand to the sides.',
    source: 'Davids and LaTour, chapter 2, section Inhalation, page 19',
  },
  ribs: {
    name: 'Ribs and rib muscles (intercostals)',
    does: 'The external intercostals lift the ribs when you breathe in. The internal intercostals help push the air out when you breathe out. Not lifting the upper chest or the shoulders lets you breathe in more fully and does not tense the neck.',
    feel: 'If the shoulders rise when you breathe in, you are using clavicular breathing (breathing with the upper chest), which gives little air and makes it hard to control the air going out.',
    source: 'Davids and LaTour, chapter 2, section Inhalation, page 19, and Exhalation, page 25',
  },
  diaphragm: {
    name: 'Diaphragm',
    does: 'A dome-shaped muscle under the lungs. It contracts and moves down so that air flows in. The top of the dome is much higher than most people think. When you breathe out we do not control the diaphragm directly. We use the rib and abdominal muscles to resist it from rising too fast.',
    feel: 'The phrase "sing from the diaphragm" is a memory aid. The places worth paying attention to are the abdomen and the ribs.',
    source: 'Davids and LaTour, chapter 2, section Inhalation, page 19, and Exhalation, page 25',
  },
  abs: {
    name: 'Abdominal muscles',
    does: 'They relax outward when you breathe in so that the diaphragm can descend fully. When you breathe out they contract gently, resisting the rib muscles to control the air pressure, which is called appoggio.',
    feel: 'Put your fingers on the abdomen between the breastbone and the navel. You should feel the muscles working but still springy, like a firm mattress.',
    source: 'Davids and LaTour, chapter 2, section Exhalation, page 25',
  },
  trachea: {
    name: 'Trachea (windpipe)',
    does: 'The tube that carries air from the lungs up to the larynx. When the diaphragm descends it pulls the trachea down a little (tracheal pull), which lowers the larynx and narrows the epilarynx.',
    feel: 'Put a finger on the Adam\'s apple and breathe in as if beginning a yawn. You will feel the larynx drop slightly.',
    source: 'Davids and LaTour, chapter 2, section Exhalation, page 25, and chapter 4, section Adjusting the larynx, page 78',
  },
  larynx: {
    name: 'Larynx',
    does: 'The cartilage framework that surrounds the vocal folds. It hangs from the hyoid bone, which is also connected to the tongue, so a tense tongue pulls the larynx with it. The muscles above the larynx (swallowing) pull it up and the muscles below the larynx (yawning) pull it down.',
    feel: 'Put a finger on the Adam\'s apple and swallow, and you will feel it rise. Touch it while making the start of a yawn, and you will feel it drop.',
    source: 'Davids and LaTour, chapter 3, section Components of the singer\'s instrument, page 39',
  },
  folds: {
    name: 'Vocal folds',
    does: 'Two small flaps of tissue, about 15 mm (soprano) to 21 mm (bass) long. When there is enough air pressure below them, they open and close again and again, and each cycle lets out a puff of air. The number of cycles per second is the frequency of the note. The note A4 means 440 cycles per second.',
    feel: 'Nobody can control the vocal folds directly. We set the note by thinking of the sound we want before we sing.',
    source: 'Davids and LaTour, chapter 3, section How sound is initiated and created, page 37, and Components of the singer\'s instrument, page 39',
  },
  epiglottis: {
    name: 'Epiglottis',
    does: 'It folds over the larynx when you swallow, to keep food from going into the lungs. When you sing it does not close, but the narrow tube about 2 to 3 cm above the vocal folds (the epilarynx tube) is where the bright, ringing sound (the singer\'s formant) is made.',
    feel: 'This tube narrows when the larynx is comfortably low and the throat is not tense.',
    source: 'Davids and LaTour, chapter 4, section Resonance and formants, page 67 (Singer\'s formant)',
  },
  pharynx: {
    name: 'Pharynx',
    does: 'The largest space of the vocal tract, from just above the vocal folds up to the back of the mouth. F1 usually comes from this space. Lowering the back of the jaw and raising the soft palate makes it wider for classical sound.',
    feel: 'Start a yawn to feel the wider pharynx and the lower larynx.',
    source: 'Davids and LaTour, chapter 4, section Adjusting the oral pharynx, page 79',
  },
  tongue: {
    name: 'Tongue',
    does: 'The tongue fills almost the whole mouth. The position of its highest point changes the shape of the mouth, and so changes F2. The tip of the tongue should rest at the base of the lower front teeth every time you sing a vowel.',
    feel: 'Sing [i] and then slide the tongue back into [u], and you will hear the color of the sound get darker.',
    source: 'Davids and LaTour, chapter 5, section Tip of the tongue should rest at the base of the lower front teeth, page 93',
  },
  jaw: {
    name: 'Jaw',
    does: 'Lowering the jaw, especially at the back, makes the pharynx wider and raises F1. Classical sound uses "releasing the back of the jaw" more than opening the front of the mouth.',
    feel: 'Put your fingers under the temple in front of the ear and open your mouth. You will feel the jaw joint relax into a groove.',
    source: 'Davids and LaTour, chapter 4, section Adjusting the oral pharynx, page 79',
  },
  palate: {
    name: 'Hard palate',
    does: 'The roof of the mouth. The tongue comes very close to the hard palate when you sing [i], forming a narrow gap that makes F2 high. This is not a place where the sound hits and bounces back. The phrase "place the voice on the palate" is only a memory aid.',
    feel: 'Sing [i] and notice how close the middle of the tongue comes to the palate.',
    source: 'Davids and LaTour, chapter 4, section Resonance and "placement," page 86',
  },
  velum: {
    name: 'Soft palate (velum)',
    does: 'It lifts to close the entrance to the nose when you sing ordinary vowels. If you leave it low, the sound goes through the nasal cavity, which weakens F1 and gives a nasal color. Some contemporary styles lower the soft palate a little to be brighter without sounding nasal.',
    feel: 'Breathe in through the mouth as if startled, and you will feel the soft palate lift.',
    source: 'Davids and LaTour, chapter 4, section Structure of the vocal tract, page 65, and Adjusting the oral pharynx, page 79',
  },
  nasal: {
    name: 'Nasal cavity',
    does: 'A resonator only for nasal sounds such as [m] [n] [ŋ] and the nasal vowels of French. For ordinary vowels, the sound that the listener hears does not come from the nasal cavity or the sinuses. The vibrating feeling on the forehead is vibration carried through bone, which only the singer feels.',
    feel: 'Pinch your nose while you sing a vowel. If the sound changes, air is leaking out through the nose.',
    source: 'Davids and LaTour, chapter 4, section Resonance and the concepts of "chest voice" and "head voice," page 85',
  },
  lips: {
    name: 'Lips',
    does: 'The far end of the vocal tract. Rounding and protruding the lips makes the tube longer and every formant lower, so the sound is darker. Smiling widely makes the tube shorter, the formants higher, and the sound brighter.',
    feel: 'Sing [ɑ], slowly smile wide, then slowly round the lips, and listen to the tone color change.',
    source: 'Davids and LaTour, chapter 4, section Adjusting the mouth, page 81',
  },
};

const SHORT_EN: Record<string, string> = {
  lips: 'Lips', jaw: 'Jaw', tongue: 'Tongue', palate: 'Hard palate', velum: 'Soft palate', nasal: 'Nasal cavity', pharynx: 'Pharynx',
  epiglottis: 'Epiglottis', larynx: 'Larynx', folds: 'Vocal folds', trachea: 'Trachea', lungs: 'Lungs', ribs: 'Ribs', diaphragm: 'Diaphragm', abs: 'Abdomen',
};

const GROUPS_EN: Record<string, { text: string; blurb: string }> = {
  all: { text: 'All', blurb: 'Press a name below, or press the picture, to see what that part does' },
  power: { text: 'Power', blurb: 'The lungs, ribs, diaphragm and abdomen make the air pressure that makes the vocal folds vibrate' },
  source: { text: 'Source of the sound', blurb: 'The vocal folds turn air into puffs of air that repeat in a rhythm. The sound is still quiet and a buzz, and not yet a vowel' },
  filter: { text: 'Filter', blurb: 'The throat, mouth, nose and lips choose to strengthen some frequencies, turning the buzz into vowels and different tone colors' },
};
const ZONE_NAME_EN: Record<string, string> = { filter: 'Filter', source: 'Source', power: 'Power' };

const GROUPS: { key: Group | 'all'; text: string; blurb: string }[] = [
  { key: 'all', text: 'ทั้งหมด', blurb: 'กดชื่อส่วนด้านล่าง หรือกดที่ภาพ เพื่อดูว่าส่วนนั้นทำอะไร' },
  { key: 'power', text: 'พลังงาน (power)', blurb: 'ปอด ซี่โครง กะบังลมและหน้าท้องสร้างแรงดันลมที่ใช้ทำให้เส้นเสียงสั่น' },
  { key: 'source', text: 'ต้นกำเนิดเสียง (source)', blurb: 'เส้นเสียงแปลงลมเป็นพัฟอากาศที่ซ้ำเป็นจังหวะ เสียงที่ได้ยังเบาและเป็นเสียงบัซ ยังไม่เป็นสระ' },
  { key: 'filter', text: 'ตัวกรอง (filter)', blurb: 'ช่องคอ ปาก จมูกและริมฝีปากเลือกขยายบางความถี่ เปลี่ยนเสียงบัซให้เป็นสระและสีเสียงต่างๆ' },
];

// where each part sits in the picture (the 520 x 760 frame of the figure), which side its label goes on, and a short name for it
const ANCHOR: Record<string, { x: number; y: number; side: 'l' | 'r'; short: string }> = {
  lips: { x: 110, y: 165, side: 'l', short: 'ริมฝีปาก' },
  jaw: { x: 122, y: 214, side: 'l', short: 'กราม' },
  tongue: { x: 208, y: 228, side: 'r', short: 'ลิ้น' },
  palate: { x: 186, y: 122, side: 'r', short: 'เพดานแข็ง' },
  velum: { x: 266, y: 124, side: 'r', short: 'เพดานอ่อน' },
  nasal: { x: 196, y: 108, side: 'r', short: 'โพรงจมูก' },
  pharynx: { x: 295, y: 200, side: 'r', short: 'คอหอย' },
  epiglottis: { x: 276, y: 242, side: 'r', short: 'ฝาปิดกล่องเสียง' },
  larynx: { x: 296, y: 286, side: 'r', short: 'กล่องเสียง' },
  folds: { x: 276, y: 301, side: 'r', short: 'เส้นเสียง' },
  trachea: { x: 280, y: 352, side: 'r', short: 'ท่อลม' },
  lungs: { x: 286, y: 484, side: 'r', short: 'ปอด' },
  ribs: { x: 164, y: 466, side: 'l', short: 'ซี่โครง' },
  diaphragm: { x: 250, y: 546, side: 'r', short: 'กะบังลม' },
  abs: { x: 160, y: 640, side: 'l', short: 'หน้าท้อง' },
};
const GROUP_COLOR: Record<Group, string> = { power: 'var(--k1)', source: 'var(--accent)', filter: 'var(--sun)' };
// vertical extent of each group in the picture
const ZONE: Record<Group, [number, number]> = { filter: [0, 292], source: [292, 332], power: [332, 760] };
const ZONE_NAME: Record<Group, string> = { filter: 'ตัวกรอง', source: 'ต้นกำเนิด', power: 'พลังงาน' };

// the path of the air in the head's own coordinates (lungs, trachea, larynx, throat, mouth, lips)
const AIR: [number, number][] = [[278, 560], [278, 440], [278, 352], [282, 320], [270, 290], [236, 250], [160, 216], [90, 198], [50, 196]];

function along(path: [number, number][], u: number): [number, number] {
  const len = path.slice(1).map((p, i) => Math.hypot(p[0] - path[i][0], p[1] - path[i][1]));
  const total = len.reduce((a, b) => a + b, 0);
  let d = u * total;
  for (let i = 0; i < len.length; i++) {
    if (d <= len[i] || i === len.length - 1) {
      const t = Math.min(1, d / len[i]);
      return [path[i][0] + t * (path[i + 1][0] - path[i][0]), path[i][1] + t * (path[i + 1][1] - path[i][1])];
    }
    d -= len[i];
  }
  return path[path.length - 1];
}

export default function SingerAnatomy({ lang = 'th' }: { lang?: 'th' | 'en' }) {
  const L = (th: string, en: string) => (lang === 'en' ? en : th);
  const parts = lang === 'en' ? PARTS.map((p) => ({ ...p, ...PARTS_EN[p.key] })) : PARTS;
  const [group, setGroup] = useState<Group | 'all'>('all');
  const [pick, setPick] = useState<string>('folds');
  const [flow, setFlow] = useState(false);
  const [tick, setTick] = useState(0);
  const raf = useRef(0);

  useEffect(() => {
    if (!flow) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setTick(0.5);
      return;
    }
    const t0 = performance.now();
    const loop = (now: number) => {
      setTick((now - t0) / 4200);
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, [flow]);

  const part = parts.find((p) => p.key === pick) ?? parts[0];
  const shown = useMemo(() => parts.filter((p) => group === 'all' || p.group === group), [group, lang]);
  const pose: Pose = { ...NEUTRAL, jaw: 0.35, height: 0.3, front: 0.4 };
  const dots = [0, 0.14, 0.28, 0.42, 0.56, 0.7, 0.84].map((o) => along(AIR, (tick + o) % 1));
  const blurb = lang === 'en' ? GROUPS_EN[group].blurb : GROUPS.find((g) => g.key === group)!.blurb;
  const [reduced, setReduced] = useState(false);
  useEffect(() => setReduced(!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches), []);
  const zones = (['filter', 'source', 'power'] as Group[]).map((g) => {
    const [y0, y1] = ZONE[g];
    const lit = group === 'all' || group === g;
    return (
      <g key={g} pointerEvents="none">
        <rect x="2" y={y0 + 2} width="516" height={y1 - y0 - 4} rx="14" fill={GROUP_COLOR[g]} opacity={lit ? (group === g ? 0.2 : 0.09) : 0.03} />
        <rect x="2" y={y0 + 2} width="516" height={y1 - y0 - 4} rx="14" fill="none" stroke={GROUP_COLOR[g]} strokeWidth="1.5" opacity={lit ? 0.6 : 0.15} />
        <text x="14" y={y0 + 21} fontSize="13" fontWeight="700" fill="var(--fg)" opacity={lit ? 0.85 : 0.35}>{lang === 'en' ? ZONE_NAME_EN[g] : ZONE_NAME[g]}</text>
      </g>
    );
  });
  const A = ANCHOR[pick];
  const lx = A ? (A.side === 'l' ? A.x < 140 ? 84 : 150 : 404) : 0;

  return (
    <figure className="viz">
      <div className="viz-title">{L('เครื่องดนตรีที่เรียกว่าเสียงร้อง', 'The instrument called the singing voice')}</div>
      <Pills<Group | 'all'> label={L('ดูเป็นกลุ่ม', 'View by group')} value={group} onChange={setGroup} options={GROUPS.map((g) => ({ value: g.key, text: lang === 'en' ? GROUPS_EN[g.key].text : g.text }))} />
      <div className="viz-box" style={{ display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'flex-start', overflowX: 'visible' }}>
        <svg viewBox="0 0 520 760" role="img" aria-label={L('ภาพตัดขวางด้านข้างของศีรษะ คอ และลำตัว แสดงปอด กะบังลม ท่อลม กล่องเสียง และช่องปาก', 'A side cross-section of the head, neck and torso, showing the lungs, diaphragm, trachea, larynx and mouth')} style={{ flex: '0 0 330px', width: 330, maxWidth: '100%', minWidth: 0 }}>
          <FullBody pose={pose} breath={0.5} active={pick} onPick={setPick} folds="open" back={zones}>
            {flow && (
              <g transform="translate(40,0) scale(0.85)" pointerEvents="none">
                <path d={'M' + AIR.map((p) => p.join(',')).join(' L')} fill="none" stroke="var(--k1)" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" opacity="0.18" />
                {dots.map((d, i) => (
                  <circle key={i} cx={d[0].toFixed(1)} cy={d[1].toFixed(1)} r={6.5} fill="#fff" stroke="var(--k1)" strokeWidth="2.5" />
                ))}
              </g>
            )}
          </FullBody>
          {/* a dot on every part (press it), and the chosen part gets a pulsing ring and its name */}
          {(Object.keys(ANCHOR) as string[]).map((k) => {
            const a = ANCHOR[k];
            const g = PARTS.find((p) => p.key === k)!.group;
            const dim = group !== 'all' && group !== g;
            const on = k === pick;
            return (
              <g key={k} onClick={() => setPick(k)} style={{ cursor: 'pointer' }} opacity={dim ? 0.3 : 1}>
                <circle cx={a.x} cy={a.y} r="13" fill="transparent" />
                <circle cx={a.x} cy={a.y} r={on ? 6 : 4.5} fill={GROUP_COLOR[g]} stroke="var(--fg)" strokeWidth={on ? 2 : 1.2} />
                {on && !reduced && (
                  <circle cx={a.x} cy={a.y} r="8" fill="none" stroke={GROUP_COLOR[g]} strokeWidth="2.5">
                    <animate attributeName="r" values="8;20;8" dur="1.8s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.9;0;0.9" dur="1.8s" repeatCount="indefinite" />
                  </circle>
                )}
              </g>
            );
          })}
          {A && (
            <g pointerEvents="none">
              <line x1={A.x + (A.side === 'l' ? -7 : 7)} y1={A.y} x2={lx + (A.side === 'l' ? 4 : -4)} y2={A.y} stroke="var(--fg)" strokeWidth="1.2" />
              <text x={lx} y={A.y + 4.5} textAnchor={A.side === 'l' ? 'end' : 'start'} fontSize="13.5" fontWeight="700" fill="var(--fg)" stroke="var(--bg)" strokeWidth="4" paintOrder="stroke">{lang === 'en' ? SHORT_EN[pick] : A.short}</text>
            </g>
          )}
        </svg>
        <div style={{ flex: '1 1 300px', minWidth: 0, display: 'grid', gap: 12 }}>
          <div className="viz-steps" role="group" aria-label={L('ส่วนของร่างกาย', 'Parts of the body')}>
            {shown.map((p) => (
              <button key={p.key} type="button" aria-pressed={p.key === pick} onClick={() => setPick(p.key)}>{p.name.replace(/ \(.*\)/, '')}</button>
            ))}
          </div>
          <div className="viz-now" aria-live="polite">
            <strong>{part.name}</strong>
            <span style={{ display: 'block' }}>{part.does}</span>
            <span style={{ display: 'block', marginTop: 8 }}><b>{L('ลองสัมผัส', 'Try feeling it')}</b> {part.feel}</span>
            <span style={{ display: 'block', marginTop: 8, fontSize: 13 }}>{part.source}</span>
          </div>
          <p className="viz-caption" style={{ margin: 0 }}>{blurb}</p>
          <div className="viz-controls">
            <button type="button" className="btn sm primary" onClick={() => setFlow((v) => !v)}>{flow ? L('หยุดดูลม', 'Stop watching the air') : L('ดูลมเดินทางจากปอดถึงริมฝีปาก', 'Watch the air travel from the lungs to the lips')}</button>
          </div>
        </div>
      </div>
      <p className="viz-caption">{L('ภาพนี้วาดให้อ่านง่าย สัดส่วนจริงต่างจากนี้เล็กน้อยและต่างกันในแต่ละคน ขนาดของเส้นเสียงในภาพถูกขยายมากเพื่อให้เห็น', 'This picture is drawn to be easy to read. The real proportions differ slightly and differ from person to person. The vocal folds in the picture are enlarged a great deal so that you can see them.')}</p>
    </figure>
  );
}
