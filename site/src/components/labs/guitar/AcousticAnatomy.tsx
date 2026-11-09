import { useEffect, useId, useState, type ReactNode } from 'react';
import { Pills } from '../../music/Controls';
import { chord } from '../../music/audio';

// An upright drawing of a steel-string acoustic guitar (headstock at the top, low E string on the left).
// Mode "parts": pick a part, or let the tour walk from the headstock to the inside of the body; each part says what it is
// and what it does, and the x-ray view shows the truss rod, the bracing and the blocks.
// Mode "sound": five steps that follow a plucked string into the room (string, bridge, top, air in the box, sound out).
// The drawing is a diagram, not a scale model: the neck is a little wide, the motion is slowed down by hundreds of times.

type Lang = 'th' | 'en';
type Mode = 'parts' | 'sound';
type Region = 'head' | 'neck' | 'body' | 'inside';

interface PartText { say: string; what: string; does: string; tip?: string }
interface StageText { title: string; short: string; text: string; parts: string[] }
interface Text {
  title: string;
  modeLabel: string;
  modes: [string, string];
  regions: Record<Region, string>;
  tourOn: string;
  tourOff: string;
  xrayOn: string;
  xrayOff: string;
  inside: string;
  whatIs: string;
  does: string;
  tip: string;
  reading: string;
  svgLabel: (part: string) => string;
  soundLabel: string;
  stageLabel: string;
  pluck: string;
  auto: string;
  autoStop: string;
  prev: string;
  next: string;
  captionParts: string;
  captionSound: string;
  parts: Record<string, PartText>;
  stages: StageText[];
}

const TEXT: Record<Lang, Text> = {
  th: {
    title: 'กีต้าร์โปร่ง แต่ละส่วนคืออะไรและทำหน้าที่อะไร',
    modeLabel: 'ดูแบบ',
    modes: ['ส่วนประกอบ', 'เสียงเดินทางอย่างไร'],
    regions: { head: 'หัว', neck: 'คอ', body: 'ตัว', inside: 'ข้างใน' },
    tourOn: 'เดินชมทีละส่วน',
    tourOff: 'หยุดเดินชม',
    xrayOn: 'มองทะลุตัวกีต้าร์',
    xrayOff: 'ปิดการมองทะลุ',
    inside: 'ส่วนนี้ซ่อนอยู่ข้างใน ภาพจึงเปิดเป็นแบบมองทะลุให้',
    whatIs: 'คืออะไร',
    does: 'ทำหน้าที่อะไร',
    tip: 'ควรรู้',
    reading: 'อ่านว่า',
    svgLabel: (part) => `แผนภาพกีต้าร์โปร่ง ส่วนที่เลือก: ${part}`,
    soundLabel: 'ภาพเคลื่อนไหวเสียงเดินทางจากสายไปถึงหู ขั้นที่เลือก:',
    stageLabel: 'ขั้น',
    pluck: 'ดีดสตรัม (ฟังเสียงและเล่นทีละขั้น)',
    auto: 'เล่นต่อเนื่อง',
    autoStop: 'หยุดเล่นต่อเนื่อง',
    prev: 'ก่อนหน้า',
    next: 'ถัดไป',
    captionParts: 'ภาพเป็นแผนภาพ ไม่ใช่สัดส่วนจริง เช่น คอวาดกว้างกว่าจริงเล็กน้อยเพื่อให้เห็นสายและเฟร็ต',
    captionSound: 'การสั่นในภาพช้ากว่าจริงหลายร้อยเท่า สายจริงสั่นร้อยกว่าถึงหลายร้อยครั้งต่อวินาที',
    parts: {
      headstock: {
        say: 'เฮดสต็อก',
        what: 'ส่วนบนสุดของกีต้าร์ เป็นแผ่นไม้ที่ติด tuning machines และมักมีโลโก้ของยี่ห้อ',
        does: 'เป็นที่ยึดปลายสายด้านหนึ่ง กีต้าร์ส่วนใหญ่เอียง headstock ไปด้านหลังเล็กน้อย เพื่อให้สายกดลงบน nut แน่นและไม่ดีดแล้วสั่นรัว',
      },
      tuners: {
        say: 'ทูนนิง แมชชีน',
        what: 'ชุดลูกบิดโลหะ หนึ่งชุดต่อหนึ่งสาย ข้างในมีเฟือง (gear) และ post ที่ปลายสายพันอยู่',
        does: 'หมุนเพื่อดึงสายให้ตึงขึ้นหรือคลายลง ความตึงเปลี่ยนจึงทำให้ระดับเสียงเปลี่ยน เฟืองทดแรงให้ปรับละเอียดและทำให้สายไม่คลายเอง',
        tip: 'ตั้งสายโดยไล่ขึ้นหาเสียงที่ต้องการเสมอ ถ้าเลยไปแล้วให้คลายลงต่ำกว่าเดิมแล้วค่อยขึ้นใหม่ สายจะอยู่ตัวกว่า',
      },
      nut: {
        say: 'นัต',
        what: 'แผ่นเล็กๆ ที่ปลายคอ ฝั่ง headstock ทำจากกระดูก plastic หรือวัสดุสังเคราะห์ มีร่องหกร่องให้สายพาด',
        does: 'กำหนดระยะห่างระหว่างสายและความสูงของสายตรงปลายคอ และเป็นปลายด้านหนึ่งของส่วนที่สั่นได้ (เฟร็ต 0)',
        tip: 'ถ้าร่องบน nut สูงเกินไป สายเปล่าจะกดยากและโน้ตแถวเฟร็ตต้นๆ เพี้ยนสูง',
      },
      neck: {
        say: 'เน็ค',
        what: 'แท่งไม้ยาวที่ต่อจาก headstock ไปถึงตัว ไม้ที่พบบ่อยคือ mahogany หรือ maple',
        does: 'รับแรงดึงของสายทั้งหกที่ดึงเข้าหาตัวกีต้าร์ ต้องแข็งพอไม่ให้โค้งงอ และต้องจับถนัดมือ รูปตัดขวางของคอ (เช่นแบบ C, D, V) มีผลต่อความรู้สึกเวลากำ',
      },
      fretboard: {
        say: 'เฟร็ตบอร์ด',
        what: 'แผ่นไม้เนื้อแข็งสีเข้มที่ติดบนคอ มักเป็น rosewood หรือ ebony เรียกอีกอย่างว่า fingerboard',
        does: 'เป็นพื้นให้ฝังลวดเฟร็ต และเป็นผิวที่นิ้วกดสายลงไป ผิวต้องเรียบและราบ เพราะถ้ามีจุดสูงต่ำสายจะบัซ',
      },
      frets: {
        say: 'เฟร็ต',
        what: 'ลวดโลหะ (มักเป็น nickel silver) ที่ฝังขวางบน fretboard ระยะห่างแคบลงเรื่อยๆ เมื่อไปทางตัว',
        does: 'เมื่อกดสายลงชิดเฟร็ต สายจะไปสิ้นสุดที่เฟร็ตนั้นแทนที่จะเป็น nut ส่วนที่สั่นได้จึงสั้นลงทีละครึ่งเสียง (semitone)',
        tip: 'วางนิ้วชิดด้านหลังลวดเฟร็ต (ด้านที่ใกล้ headstock) จะใช้แรงน้อยที่สุดและเสียงไม่บัซ',
      },
      inlays: {
        say: 'อินเลย์',
        what: 'จุดที่ฝังบนหน้า fretboard ส่วนใหญ่อยู่ที่เฟร็ต 3, 5, 7, 9, 12 (สองจุด), 15 และ 17 และมักมีจุดเล็กที่ขอบคอด้านข้างด้วย',
        does: 'บอกตำแหน่งให้รู้โดยไม่ต้องนับเฟร็ต เฟร็ต 12 มีสองจุดเพราะเป็นตำแหน่งของ octave เสียงที่ได้ซ้ำกับสายเปล่าที่สูงขึ้นหนึ่ง octave',
      },
      strings: {
        say: 'สตริง',
        what: 'สายเหล็กหกเส้น เส้นหนาทางซ้ายพันด้วยลวดโลหะ เส้นบางทางขวาเป็นลวดเรียบ สาย 6 หนาที่สุดและต่ำที่สุด (E) สาย 1 บางที่สุดและสูงที่สุด (e)',
        does: 'เป็นต้นกำเนิดของเสียง ความยาว ความตึง และความหนาของสายตัดสินระดับเสียง ส่วนที่เหลือของกีต้าร์ทำหน้าที่ขยายเสียงจากสายให้ได้ยินชัด',
      },
      heel: {
        say: 'ฮีล',
        what: 'ส่วนที่คอไปต่อกับตัว (ส้นคอ) ด้านหลังเป็นก้อนโค้งที่ใช้มือจับเวลาเล่นเฟร็ตสูงๆ',
        does: 'ยึดคอเข้ากับ neck block ข้างในตัว และรับแรงดึงของสายทั้งหมด ตำแหน่งที่คอเข้าตัวบอกชนิดของกีต้าร์ เช่น แบบ 14-fret clear (คอแยกจากตัวที่เฟร็ต 14) กับแบบ 12-fret',
        tip: 'ถ้ารอยต่อตรงนี้แยกหรือคอเอียง ให้ส่งช่างซ่อม ไม่ควรแก้เอง',
      },
      top: {
        say: 'ท็อป (ซาวด์บอร์ด)',
        what: 'แผ่นไม้ด้านหน้าของกล่องเสียง เรียกว่า top หรือ soundboard มักเป็น spruce หรือ cedar ที่เบาและแข็งตามเส้นใย และบางเพียงไม่กี่มิลลิเมตร',
        does: 'เป็นส่วนที่ส่งเสียงออกมามากที่สุด เพราะกว้างและสั่นตามสายได้ง่าย ไม้ของ top กำหนดโทนของกีต้าร์โปร่งมากกว่าชิ้นอื่น',
      },
      soundhole: {
        say: 'ซาวด์โฮล',
        what: 'รูกลมบนหน้ากีต้าร์ ใต้ปลายของ fretboard',
        does: 'ให้อากาศในกล่องไหลเข้าออกตามจังหวะที่ top สั่น ช่วยเสริมเสียงต่ำและปล่อยเสียงออกมา',
        tip: 'ลองเอามือปิดรูแล้วดีดสายเปล่า เสียงจะทึบและส่วนที่ต่ำหายไปชัดเจน',
      },
      rosette: {
        say: 'โรเซตต์',
        what: 'วงลายรอบ soundhole ทำจากไม้สลับสี วงแหวน หรือหอยมุก',
        does: 'ส่วนใหญ่เป็นงานตกแต่ง และช่วยป้องกันขอบรูจากรอยร้าวได้เล็กน้อย ลายของมันแทบไม่มีผลกับเสียง',
      },
      bridge: {
        say: 'บริดจ์',
        what: 'แผ่นไม้เนื้อแข็ง (มักเป็น rosewood หรือ ebony) ที่ติดกาวกับ top ใต้ soundhole',
        does: 'ยึดปลายสายอีกด้านหนึ่ง และส่งแรงสั่นของสายลงสู่ top ต้องติดแน่นมาก เพราะรับแรงดึงเต็มที่ตลอดเวลา',
        tip: 'ถ้า bridge เริ่มลอกขึ้นจาก top ให้หยุดเล่นและส่งช่างทันที',
      },
      saddle: {
        say: 'แซดเดิล',
        what: 'แท่งบางๆ ที่เสียบอยู่ในร่องบน bridge ทำจากกระดูก Tusq หรือ plastic',
        does: 'เป็นจุดที่สายสิ้นสุดฝั่งตัวกีต้าร์ ระยะจาก nut ถึง saddle คือ scale length ความสูงของมันกำหนด action ส่วนปลายบนที่เอียงเล็กน้อยใช้ชดเชย intonation (สายเบสต้องยาวกว่าสายแหลมนิดหน่อย)',
      },
      pins: {
        say: 'บริดจ์ พิน',
        what: 'หมุดสีขาวหรือดำที่เสียบในรูบน bridge หกอัน',
        does: 'ล็อกปลายสายฝั่งตัว ปลายสายมีห่วงหรือลูกบอลเล็กๆ (ball end) ถูกหมุดดันให้ติดอยู่ใต้ bridge ส่วนร่องเล็กๆ ที่ข้างหมุดเป็นทางให้สายผ่านขึ้นไปหา saddle',
        tip: 'ตอนเปลี่ยนสาย ให้ร่องข้างหมุดหันไปทาง saddle และดึงสายขึ้นเบาๆ เพื่อให้ ball end เข้าที่',
      },
      pickguard: {
        say: 'พิกการ์ด',
        what: 'แผ่นพลาสติกบางที่ติดบน top ใต้ soundhole ด้านสายแหลม',
        does: 'กัน top จากรอยขีดข่วนของปิ๊กและเล็บเวลาสตรัมแรงๆ',
      },
      binding: {
        say: 'ไบนดิง',
        what: 'แถบเส้นเล็กๆ ของไม้หรือพลาสติก ติดรอบขอบที่ top และ back ไปเจอกับ sides',
        does: 'ปิดรอยต่อของไม้และปกป้องปลายเส้นใยไม้ตรงขอบจากการกระแทกและความชื้น',
      },
      sides: {
        say: 'ไซด์ แอนด์ แบ็ค',
        what: 'ผนังข้างและแผ่นหลังของกล่อง ทำจากไม้บางที่ดัดตามรูปตัว ที่พบบ่อยคือ mahogany, rosewood และ maple',
        does: 'ปิดกล่องให้อากาศอยู่ข้างใน และสะท้อนเสียงที่เข้าไปในกล่องให้ออกมาทางหน้า เรื่องที่ไม้ของ back และ sides ทำให้โทนต่างกันแค่ไหน ช่างทำกีต้าร์ยังถกกันอยู่ เสียงส่วนใหญ่ยังมาจาก top',
      },
      bouts: {
        say: 'เบาท์ส',
        what: 'รูปร่างของกล่อง ประกอบด้วย upper bout (ส่วนบนที่แคบกว่า), waist (เอวที่คอด) และ lower bout (ส่วนล่างที่กว้างที่สุด)',
        does: 'ขนาดและรูปทรงกำหนดลักษณะเสียง กล่องใหญ่แบบ dreadnought ให้เสียงดังและหนา กล่องเล็กอย่าง parlor ให้เสียงใกล้ชิดและกระชับ เอวที่คอดช่วยให้วางแขนและนั่งเล่นถนัด',
      },
      endpin: {
        say: 'เอนด์ พิน',
        what: 'ปุ่มโลหะกลมที่ท้ายตัว ในกีต้าร์โปร่งไฟฟ้า (electro-acoustic) ตรงนี้มักเป็นช่องเสียบสาย jack ด้วย',
        does: 'ให้ผูกสายสะพายด้านท้าย อีกด้านของสายสะพายผูกที่ส้นคอหรือที่ headstock',
      },
      truss: {
        say: 'ทรัสร็อด',
        what: 'แกนโลหะที่ซ่อนอยู่ในคอ ปรับได้ด้วยประแจจากที่ headstock หรือจากใน soundhole',
        does: 'ดันคอให้ตรงต้านแรงดึงของสาย ถ้าคอโค้งมากเกินไปก็ปรับแกนนี้ให้ตรงขึ้น',
        tip: 'ถ้าไม่เคยปรับ ให้ช่างทำ ถ้าปรับเองให้หมุนทีละหนึ่งในสี่รอบแล้วรอให้คอปรับตัวก่อน การฝืนหมุนอาจทำให้แกนหรือคอเสียหาย',
      },
      bracing: {
        say: 'เบรซซิง',
        what: 'โครงไม้เส้นเรียวที่ติดกาวใต้ top (กีต้าร์สายเหล็กมักใช้ X-bracing ส่วน classical ใช้ fan bracing) และมีโครงรองที่ back ด้วย',
        does: 'ทำให้ top บางพอจะสั่นได้ แต่ไม่ยวบหรือแตกจากแรงดึงสายทั้งชุดซึ่งรวมกันแล้วหลายสิบกิโลกรัมแรง รูปแบบและความหนาของโครงเป็นตัวกำหนดโทนอย่างมาก',
      },
      blocks: {
        say: 'บล็อกส์',
        what: 'ก้อนไม้ภายในสองก้อน neck block อยู่ใต้ส้นคอ และ tail block อยู่ที่ปลายล่างของตัว',
        does: 'neck block ยึดคอและรับแรงดึงของสาย ส่วน tail block ประสาน sides สองข้างเข้าด้วยกันตรงท้ายตัว และเป็นที่ติด end pin',
      },
    },
    stages: [
      {
        title: 'สายสั่น',
        short: 'สายสั่น',
        text: 'เมื่อดีดสาย สายจะสั่นไปมา แต่สายบางมาก ผลักอากาศได้น้อยจนเสียงเบา ถ้าลองดีดสายของกีต้าร์ไฟฟ้าที่ไม่ได้เสียบ amp จะได้ยินเสียงเบาแบบนี้ ที่เหลือของขั้นตอนทั้งหมดมีไว้ขยายเสียงจากสาย',
        parts: ['strings'],
      },
      {
        title: 'แรงสั่นลงสู่ Bridge',
        short: 'ลง Bridge',
        text: 'ปลายสายด้านตัวพาดอยู่บน saddle และ saddle อยู่ในร่องของ bridge ซึ่งติดกาวแน่นกับ top แรงสั่นของสายจึงส่งผ่านลงไปดัน-ดึง top ในจังหวะเดียวกับสาย',
        parts: ['saddle', 'bridge'],
      },
      {
        title: 'Top สั่นตาม',
        short: 'Top สั่น',
        text: 'top บาง กว้าง และมี bracing ค้ำอยู่ จึงสั่นเป็นแผ่นและผลักอากาศได้มากกว่าสายหลายเท่า นี่คือขั้นที่ทำให้เสียงดังขึ้นจริงๆ ภาพแสดงแบบมองทะลุเพื่อให้เห็นโครงข้างใต้',
        parts: ['top', 'bracing'],
      },
      {
        title: 'อากาศในกล่องสั่น',
        short: 'อากาศ',
        text: 'top ที่ขยับเข้าออกทำให้อากาศในกล่องถูกอัดและคลายสลับกัน อากาศก้อนนี้ดันเข้าออกทาง soundhole คล้ายการเป่าปากขวด และช่วยเสริมเสียงต่ำที่ราว 100 Hz (ใกล้โน้ต G2 ถึง A2 ค่าจริงต่างกันไปตามรุ่น)',
        parts: ['soundhole'],
      },
      {
        title: 'เสียงแผ่ออกถึงหู',
        short: 'เสียงออก',
        text: 'เสียงออกมาทั้งจากผิวของ top และจาก soundhole ไปทุกทิศ ส่วน back และ sides สะท้อนเสียงในกล่องให้ออกมาข้างหน้า หูของเราจับความดันอากาศที่เปลี่ยนไปมานี้ได้เป็นเสียง',
        parts: ['sides', 'soundhole'],
      },
    ],
  },
  en: {
    title: 'An acoustic guitar: what each part is and what it does',
    modeLabel: 'View',
    modes: ['Parts', 'How the sound travels'],
    regions: { head: 'Head', neck: 'Neck', body: 'Body', inside: 'Inside' },
    tourOn: 'Walk through the parts',
    tourOff: 'Stop the walk',
    xrayOn: 'See through the guitar',
    xrayOff: 'Turn off see-through',
    inside: 'This part is hidden inside, so the drawing opens it up for you',
    whatIs: 'What it is',
    does: 'What it does',
    tip: 'Good to know',
    reading: '',
    svgLabel: (part) => `Diagram of an acoustic guitar, selected part: ${part}`,
    soundLabel: 'Animation of sound travelling from the string to the ear, selected step:',
    stageLabel: 'Step',
    pluck: 'Strum (hear it and play the steps)',
    auto: 'Play on',
    autoStop: 'Stop playing on',
    prev: 'Previous',
    next: 'Next',
    captionParts: 'This is a diagram, not a scale drawing. For example the neck is drawn a little wider than real so that the strings and frets can be seen.',
    captionSound: 'The vibration in the picture is hundreds of times slower than real. A real string vibrates from about a hundred to several hundred times a second.',
    parts: {
      headstock: {
        say: '',
        what: 'The top end of the guitar. A piece of wood that carries the tuning machines and usually the logo of the brand.',
        does: 'It holds one end of each string. On most guitars the headstock is tilted back a little so that the strings press down on the nut and do not rattle.',
      },
      tuners: {
        say: '',
        what: 'The metal knobs, one for each string. Inside each one is a gear and a post that the end of the string is wound on.',
        does: 'Turn one to tighten or loosen the string. The tension changes, so the pitch changes. The gear lets you adjust in small steps and keeps the string from slipping back.',
        tip: 'Always tune up to the note. If you go past it, loosen the string below the note and come up again. The string then stays in tune better.',
      },
      nut: {
        say: '',
        what: 'A small strip at the end of the neck, on the headstock side. It is made of bone, plastic or a synthetic material, with six slots for the strings.',
        does: 'It sets the distance between the strings and their height at the end of the neck, and it is one end of the part that can vibrate (fret 0).',
        tip: 'If the slots in the nut are too high, the open strings are hard to press and the notes near the first frets sound sharp.',
      },
      neck: {
        say: '',
        what: 'The long piece of wood from the headstock to the body. Mahogany and maple are common.',
        does: 'It carries the pull of the six strings toward the body. It has to be stiff enough not to bend, and comfortable to hold. The shape of its cross section (for example a C, D or V profile) changes how it feels in your hand.',
      },
      fretboard: {
        say: '',
        what: 'A dark, hard board on the neck, often rosewood or ebony. It is also called the fingerboard.',
        does: 'The fret wires are set into it, and your fingers press the strings against it. The surface has to be smooth and flat, because any high or low spot makes a string buzz.',
      },
      frets: {
        say: '',
        what: 'Metal wires (often nickel silver) set across the fretboard. They get closer together toward the body.',
        does: 'When you press a string down next to a fret, the string ends at that fret instead of at the nut. The vibrating part gets shorter by one semitone for each fret.',
        tip: 'Put your finger just behind the fret wire (the side nearer the headstock). That takes the least force and does not buzz.',
      },
      inlays: {
        say: '',
        what: 'The dots set into the face of the fretboard, mostly at frets 3, 5, 7, 9, 12 (two dots), 15 and 17. There are often small dots on the side of the neck too.',
        does: 'They tell you where you are without counting frets. Fret 12 has two dots because it marks the octave: the note is the open string, one octave higher.',
      },
      strings: {
        say: '',
        what: 'Six steel strings. The thick ones on the left are wound with metal wire, the thin ones on the right are plain wire. String 6 is the thickest and lowest (E), string 1 is the thinnest and highest (e).',
        does: 'They are where the sound starts. Length, tension and thickness set the pitch. The rest of the guitar is there to make the sound of the strings loud enough to hear.',
      },
      heel: {
        say: '',
        what: 'The place where the neck joins the body. The back of it is a rounded block that your hand rests on when you play high up.',
        does: 'It fixes the neck to the neck block inside the body and carries all the pull of the strings. Where the neck meets the body tells the type of guitar, for example a 14-fret clear body (the neck leaves the body at fret 14) or a 12-fret body.',
        tip: 'If this joint opens up or the neck leans, take it to a repair person. Do not fix it yourself.',
      },
      top: {
        say: '',
        what: 'The wood on the front of the sound box, called the top or the soundboard. It is often spruce or cedar, light and stiff along the grain, and only a few millimeters thick.',
        does: 'It sends out the most sound, because it is wide and moves easily with the string. The wood of the top shapes the tone of an acoustic guitar more than any other piece.',
      },
      soundhole: {
        say: '',
        what: 'The round hole in the top of the guitar, below the end of the fretboard.',
        does: 'The air in the box moves in and out through it as the top vibrates. That strengthens the low notes and lets the sound out.',
        tip: 'Cover the hole with your hand and pluck an open string. The sound becomes dull and the low part is clearly gone.',
      },
      rosette: {
        say: '',
        what: 'The ring of decoration around the soundhole, made of inlaid woods, rings or mother of pearl.',
        does: 'It is mostly decoration, and it protects the edge of the hole from cracks a little. Its pattern has almost no effect on the sound.',
      },
      bridge: {
        say: '',
        what: 'A block of hard wood (often rosewood or ebony) that is glued to the top, below the soundhole.',
        does: 'It holds the other end of the strings and passes their vibration down into the top. It must be glued on very firmly, because it takes the full pull all the time.',
        tip: 'If the bridge starts to lift off the top, stop playing and take it to a repair person at once.',
      },
      saddle: {
        say: '',
        what: 'A thin bar that sits in a slot on the bridge, made of bone, Tusq or plastic.',
        does: 'It is where the string ends on the body side. The distance from the nut to the saddle is the scale length, and its height sets the action. The top edge is angled a little to compensate the intonation (the bass strings need to be a bit longer than the treble strings).',
      },
      pins: {
        say: '',
        what: 'The six white or black pegs that sit in holes in the bridge.',
        does: 'They lock the body end of each string. The end of the string has a small ball (the ball end) that the peg pushes against the underside of the bridge. The small groove on the side of the peg gives the string a path up to the saddle.',
        tip: 'When you change strings, turn the groove of the peg toward the saddle and pull the string up gently so that the ball end seats.',
      },
      pickguard: {
        say: '',
        what: 'A thin plastic plate on the top, below the soundhole on the treble side.',
        does: 'It protects the top from the scratches of the pick and of fingernails when you strum hard.',
      },
      binding: {
        say: '',
        what: 'A thin strip of wood or plastic around the edge where the top and the back meet the sides.',
        does: 'It covers the seam between the pieces of wood and protects the exposed ends of the wood fibers at the edge from knocks and moisture.',
      },
      sides: {
        say: '',
        what: 'The side walls and the back plate of the box. They are thin wood bent to the shape of the body, often mahogany, rosewood or maple.',
        does: 'They close the box so the air stays inside, and they reflect the sound in the box back out through the front. Makers still argue about how much the wood of the back and the sides changes the tone. Most of the sound still comes from the top.',
      },
      bouts: {
        say: '',
        what: 'The shape of the box: the upper bout (the narrower top part), the waist (the narrow middle) and the lower bout (the widest part).',
        does: 'The size and shape set the character of the sound. A big dreadnought box sounds loud and thick. A small parlor box sounds close and tight. The narrow waist makes it comfortable to rest your arm and to sit with.',
      },
      endpin: {
        say: '',
        what: 'The round metal button at the bottom of the body. On an electro-acoustic guitar it is often the output jack as well.',
        does: 'It is where one end of the guitar strap goes. The other end goes on the heel or on the headstock.',
      },
      truss: {
        say: '',
        what: 'A metal rod hidden in the neck. You adjust it with a wrench, from the headstock or from inside the soundhole.',
        does: 'It pushes the neck straight against the pull of the strings. If the neck bends too much, you adjust this rod to straighten it.',
        tip: 'If you have never done it, ask a technician. If you do it yourself, turn it a quarter turn at a time and wait for the neck to settle. Forcing it can damage the rod or the neck.',
      },
      bracing: {
        say: '',
        what: 'Thin strips of wood glued under the top (steel-string guitars usually have X-bracing, classical guitars have fan bracing). There are smaller braces on the back too.',
        does: 'They let the top be thin enough to vibrate, without sagging or breaking under the pull of the whole set of strings, which adds up to tens of kilograms of force. The pattern and thickness of the braces shape the tone a great deal.',
      },
      blocks: {
        say: '',
        what: 'Two blocks of wood inside. The neck block is under the heel, and the tail block is at the bottom end of the body.',
        does: 'The neck block holds the neck and takes the pull of the strings. The tail block joins the two sides together at the bottom of the body, and it is where the end pin is fixed.',
      },
    },
    stages: [
      {
        title: 'The string vibrates',
        short: 'String',
        text: 'When you pluck, the string swings back and forth. But a string is very thin, and it pushes very little air, so the sound is faint. Pluck an electric guitar that is not plugged in and you hear a faint sound like this. Everything after this step exists to make the sound of the string louder.',
        parts: ['strings'],
      },
      {
        title: 'The vibration goes into the bridge',
        short: 'Bridge',
        text: 'The body end of the string rests on the saddle, and the saddle sits in the bridge, which is glued firmly to the top. The vibration of the string passes through and pushes and pulls the top in time with the string.',
        parts: ['saddle', 'bridge'],
      },
      {
        title: 'The top vibrates too',
        short: 'Top',
        text: 'The top is thin, wide and held by braces, so it vibrates as a plate and moves much more air than a string can. This is the step that makes the sound loud. The picture opens up the guitar so that you can see the braces underneath.',
        parts: ['top', 'bracing'],
      },
      {
        title: 'The air in the box vibrates',
        short: 'Air',
        text: 'As the top moves in and out, the air in the box is squeezed and released in turn. That air pushes in and out of the soundhole, a little like blowing across a bottle, and it strengthens the low notes around 100 Hz (close to G2 or A2; the real value differs from guitar to guitar).',
        parts: ['soundhole'],
      },
      {
        title: 'The sound spreads to your ear',
        short: 'Sound out',
        text: 'Sound comes out of the surface of the top and out of the soundhole, in every direction. The back and the sides reflect the sound inside the box so that it comes out at the front. Your ear picks up these changes in air pressure as sound.',
        parts: ['sides', 'soundhole'],
      },
    ],
  },
};

// ------------------------------------------------------------------------------------------------------ geometry

const CX = 260;
const W = 520;
const H = 680;
const NUT_Y = 120;
const SCALE = 390;
const FB_END = 380;
const SOUND = { x: CX, y: 422, r: 30 };
const fretY = (n: number) => NUT_Y + SCALE * (1 - 2 ** (-n / 12));
const fbHalf = (y: number) => 19 + ((y - 121) * 5) / 259;
const headHalf = (y: number) => 30 - ((y - 32) * 10) / 80;

const L = (d: number, y: number) => `${CX - d},${y}`;
const R = (d: number, y: number) => `${CX + d},${y}`;
const BODY =
  `M${L(24, 334)} C${L(54, 336)} ${L(86, 352)} ${L(88, 394)} C${L(90, 428)} ${L(74, 446)} ${L(74, 474)} C${L(76, 500)} ${L(118, 514)} ${L(118, 580)} C${L(118, 626)} ${L(70, 650)} ${CX},650 ` +
  `C${R(70, 650)} ${R(118, 626)} ${R(118, 580)} C${R(118, 514)} ${R(76, 500)} ${R(74, 474)} C${R(74, 446)} ${R(90, 428)} ${R(88, 394)} C${R(86, 352)} ${R(54, 336)} ${R(24, 334)} Z`;
const PICKGUARD = `M${R(38, 454)} C${R(54, 440)} ${R(84, 444)} ${R(88, 466)} C${R(90, 486)} ${R(72, 494)} ${R(58, 482)} C${R(48, 474)} ${R(40, 468)} ${R(38, 454)} Z`;
const HEAD = `M${L(20, 112)} L${L(30, 32)} Q${L(30, 22)} ${L(20, 22)} L${R(20, 22)} Q${R(30, 22)} ${R(30, 32)} L${R(20, 112)} Z`;
const poly = (pts: [number, number][]) => pts.map((p) => p.join(',')).join(' ');
const NECK_PTS = poly([[CX - 21, 121], [CX + 21, 121], [CX + 26, 336], [CX - 26, 336]]);
const FB_PTS = poly([[CX - 19, 121], [CX + 19, 121], [CX + 24, FB_END], [CX - 24, FB_END]]);

// strings, 0 = low E (left) to 5 = high e (right)
const nutX = (i: number) => CX - 16 + 6.4 * i;
const saddleX = (i: number) => CX - 35 + 14 * i;
const saddleY = (i: number) => 510.8 - 0.74 * i;
const POSTS: [number, number][] = [[CX - 22, 86], [CX - 22, 64], [CX - 22, 42], [CX + 22, 42], [CX + 22, 64], [CX + 22, 86]];
const KNOBS: [number, number][] = POSTS.map(([x, y], i) => [i < 3 ? CX - headHalf(y) - 15 : CX + headHalf(y) + 15, y]);
const strW = (i: number) => 2.2 - i * 0.25;
const stringPath = (i: number) => `M${POSTS[i][0]},${POSTS[i][1]} L${nutX(i)},113 L${saddleX(i)},${saddleY(i)}`;
const fretLines = Array.from({ length: 18 }, (_, k) => {
  const y = fretY(k + 1);
  return { y, x1: CX - fbHalf(y), x2: CX + fbHalf(y) };
});
const INLAYS: [number, number][] = [3, 5, 7, 9, 15, 17].map((n): [number, number] => [CX, (fretY(n - 1) + fretY(n)) / 2]);
const y12 = (fretY(11) + fretY(12)) / 2;
INLAYS.push([CX - 8, y12], [CX + 8, y12]);

// ------------------------------------------------------------------------------------------------------ parts

interface S { fill: string; fo: number; stroke: string; sw: number; lw: number }
const HL: S = { fill: 'var(--accent)', fo: 0.3, stroke: 'var(--accent)', sw: 3, lw: 4 };
const HIT: S = { fill: 'transparent', fo: 1, stroke: 'transparent', sw: 0, lw: 8 };
const solid = (s: S) => ({ fill: s.fill, fillOpacity: s.fo, stroke: s.stroke, strokeWidth: s.sw });
const lineOf = (s: S, w = s.lw) => ({ fill: 'none', stroke: s.stroke, strokeWidth: w, strokeLinecap: 'round' as const });

interface PartDef {
  id: string;
  name: string;
  short?: string;
  region: Region;
  anchor: [number, number];
  side: 'l' | 'r';
  z: number;
  internal?: boolean;
  nohit?: boolean;
  shape: (s: S) => ReactNode;
}

const xbrace = [
  [CX - 80, 410, CX + 100, 572],
  [CX + 80, 410, CX - 100, 572],
] as const;

const PARTS: PartDef[] = [
  { id: 'headstock', name: 'Headstock', region: 'head', anchor: [CX - 24, 50], side: 'l', z: 1, shape: (s) => <path d={HEAD} {...solid(s)} /> },
  {
    id: 'tuners', name: 'Tuning Machines', short: 'Tuners', region: 'head', anchor: [KNOBS[1][0], KNOBS[1][1]], side: 'l', z: 2,
    shape: (s) => <>{KNOBS.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="9" {...solid(s)} />)}</>,
  },
  { id: 'nut', name: 'Nut', region: 'head', anchor: [CX - 20, 117], side: 'l', z: 3, shape: (s) => <rect x={CX - 21} y="112" width="42" height="9" rx="2" {...solid(s)} /> },
  { id: 'neck', name: 'Neck', region: 'neck', anchor: [CX - 24, 270], side: 'l', z: 1, shape: (s) => <polygon points={NECK_PTS} {...solid(s)} /> },
  { id: 'fretboard', name: 'Fretboard', region: 'neck', anchor: [CX + 20, 310], side: 'r', z: 2, shape: (s) => <polygon points={FB_PTS} {...solid(s)} /> },
  {
    id: 'frets', name: 'Frets', region: 'neck', anchor: [CX + 18, fretY(5)], side: 'r', z: 4,
    shape: (s) => <>{fretLines.map((f) => <line key={f.y} x1={f.x1} x2={f.x2} y1={f.y} y2={f.y} {...lineOf(s)} />)}</>,
  },
  {
    id: 'inlays', name: 'Inlays', region: 'neck', anchor: [CX, (fretY(6) + fretY(7)) / 2], side: 'r', z: 5,
    shape: (s) => <>{INLAYS.map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="6" {...solid(s)} />)}</>,
  },
  {
    id: 'strings', name: 'Strings', region: 'neck', anchor: [CX + 22, 250], side: 'r', z: 3,
    shape: (s) => <>{Array.from({ length: 6 }, (_, i) => <path key={i} d={stringPath(i)} {...lineOf(s, Math.min(s.lw, 5))} strokeLinejoin="round" />)}</>,
  },
  { id: 'heel', name: 'Heel', region: 'neck', anchor: [CX + 28, 340], side: 'r', z: 2, shape: (s) => <rect x={CX - 32} y="320" width="64" height="34" rx="10" {...solid(s)} /> },
  { id: 'top', name: 'Top (Soundboard)', short: 'Top', region: 'body', anchor: [CX + 62, 560], side: 'r', z: 0, shape: (s) => <path d={BODY} {...solid(s)} /> },
  { id: 'soundhole', name: 'Soundhole', region: 'body', anchor: [CX - 18, 436], side: 'l', z: 3, shape: (s) => <circle cx={SOUND.x} cy={SOUND.y} r={SOUND.r + 2} {...solid(s)} /> },
  {
    id: 'rosette', name: 'Rosette', region: 'body', anchor: [CX - 38, 414], side: 'l', z: 2,
    shape: (s) => <circle cx={SOUND.x} cy={SOUND.y} r="36" fill="none" stroke={s.stroke} strokeWidth={s.lw + 4} />,
  },
  { id: 'bridge', name: 'Bridge', region: 'body', anchor: [CX + 46, 512], side: 'r', z: 4, shape: (s) => <rect x={CX - 47} y="496" width="94" height="32" rx="5" {...solid(s)} /> },
  {
    id: 'saddle', name: 'Saddle', region: 'body', anchor: [CX - 32, 510], side: 'l', z: 5,
    shape: (s) => <line x1={CX - 40} y1="511.6" x2={CX + 40} y2="507.6" {...lineOf(s, s.lw + 2)} />,
  },
  {
    id: 'pins', name: 'Bridge Pins', region: 'body', anchor: [CX + 36, 521], side: 'r', z: 6,
    shape: (s) => <>{Array.from({ length: 6 }, (_, i) => <circle key={i} cx={saddleX(i)} cy={saddleY(i) + 11} r="6" {...solid(s)} />)}</>,
  },
  {
    id: 'pickguard', name: 'Pickguard', region: 'body', anchor: [CX + 86, 468], side: 'r', z: 4,
    shape: (s) => <path d={PICKGUARD} {...solid(s)} />,
  },
  { id: 'binding', name: 'Binding', region: 'body', anchor: [CX - 118, 580], side: 'l', z: 1, shape: (s) => <path d={BODY} fill="none" stroke={s.stroke} strokeWidth={s.lw + 4} strokeLinejoin="round" /> },
  {
    id: 'sides', name: 'Sides + Back', region: 'body', anchor: [CX + 122, 596], side: 'r', z: -1,
    shape: (s) => <path d={BODY} transform="translate(6,7)" fill="none" stroke={s.stroke} strokeWidth={s.lw + 2} strokeLinejoin="round" />,
  },
  {
    id: 'bouts', name: 'Bouts + Waist', region: 'body', anchor: [CX - 118, 580], side: 'l', z: 0, nohit: true,
    shape: (s) => (
      <g>
        {([['Upper Bout', 394, 88], ['Waist', 474, 74], ['Lower Bout', 580, 118]] as const).map(([label, y, d]) => (
          <g key={label}>
            <line x1={CX - d} x2={CX + d} y1={y} y2={y} {...lineOf(s, 3)} />
            <line x1={CX - d} x2={CX - d} y1={y - 8} y2={y + 8} {...lineOf(s, 3)} />
            <line x1={CX + d} x2={CX + d} y1={y - 8} y2={y + 8} {...lineOf(s, 3)} />
            <text x={CX} y={y - 7} textAnchor="middle" style={{ fontSize: 14, fontWeight: 700, fill: 'var(--fg)', fillOpacity: 1, strokeOpacity: 1, paintOrder: 'stroke', stroke: 'var(--surface)', strokeWidth: 4 }}>{label}</text>
          </g>
        ))}
      </g>
    ),
  },
  { id: 'endpin', name: 'End Pin', region: 'body', anchor: [CX + 4, 646], side: 'r', z: 6, shape: (s) => <circle cx={CX} cy="645" r="8" {...solid(s)} /> },
  {
    id: 'truss', name: 'Truss Rod', region: 'inside', anchor: [CX, 200], side: 'l', z: 6, internal: true,
    shape: (s) => (
      <>
        <line x1={CX} x2={CX} y1="104" y2="398" {...lineOf(s, s.lw)} />
        <circle cx={CX} cy="104" r="6" {...solid(s)} />
        <circle cx={CX} cy="398" r="5" {...solid(s)} />
      </>
    ),
  },
  {
    id: 'bracing', name: 'Bracing', region: 'inside', anchor: [CX - 30, 456], side: 'l', z: 6, internal: true,
    shape: (s) => (
      <>
        {xbrace.map(([x1, y1, x2, y2], i) => <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} {...lineOf(s, s.lw + 4)} />)}
        <line x1={CX - 84} y1="374" x2={CX + 84} y2="374" {...lineOf(s, s.lw + 2)} />
        <line x1={CX - 58} y1="560" x2={CX - 44} y2="618" {...lineOf(s, s.lw)} />
        <line x1={CX + 58} y1="560" x2={CX + 44} y2="618" {...lineOf(s, s.lw)} />
        <rect x={CX - 44} y="494" width="88" height="38" rx="4" {...solid(s)} />
      </>
    ),
  },
  {
    id: 'blocks', name: 'Neck + Tail Block', short: 'Blocks', region: 'inside', anchor: [CX + 30, 346], side: 'r', z: 6, internal: true,
    shape: (s) => (
      <>
        <rect x={CX - 32} y="336" width="64" height="26" rx="4" {...solid(s)} />
        <rect x={CX - 26} y="626" width="52" height="22" rx="4" {...solid(s)} />
      </>
    ),
  },
];

const REGIONS: Region[] = ['head', 'neck', 'body', 'inside'];

// ------------------------------------------------------------------------------------------------------ drawing

const TOP_FILL = 'color-mix(in srgb, var(--soil) 55%, var(--surface))';
const DARK_WOOD = '#3B2A20';
const CREAM = '#F1ECDD';
const METAL = '#C9CFC4';
const OPEN_STRUM = [40, 47, 52, 56, 59, 64];

/** A fixed scatter of points inside the box, used for the air in stage 4 (the same on every render). */
const AIR = (() => {
  const pts: { x: number; y: number; ph: number }[] = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  while (pts.length < 70) {
    const x = CX - 120 + rnd() * 240;
    const y = 338 + rnd() * 312;
    const half = y < 394 ? 70 : y < 474 ? 80 : 112;
    if (Math.abs(x - CX) < half && Math.hypot(x - SOUND.x, y - SOUND.y) > SOUND.r + 6) pts.push({ x, y, ph: Math.hypot(x - SOUND.x, y - SOUND.y) * 0.035 });
  }
  return pts;
})();

function wiggle(i: number, t: number, amp: number) {
  const x0 = nutX(i);
  const y0 = 113;
  const x1 = saddleX(i);
  const y1 = saddleY(i);
  const f = 1.1 + 0.28 * (5 - i);
  const a = amp * Math.cos(2 * Math.PI * f * t);
  const pts: string[] = [];
  for (let k = 0; k <= 28; k++) {
    const u = k / 28;
    pts.push(`${k === 0 ? 'M' : 'L'}${(x0 + (x1 - x0) * u + a * Math.sin(Math.PI * u)).toFixed(1)},${(y0 + (y1 - y0) * u).toFixed(1)}`);
  }
  return pts.join(' ');
}

export default function AcousticAnatomy({ lang = 'th', mode: firstMode = 'parts', start = 'soundhole' }: { lang?: Lang; mode?: Mode; start?: string }) {
  const T = TEXT[lang];
  const uid = useId().replace(/\W/g, '');
  const [mode, setMode] = useState<Mode>(firstMode);
  const [pick, setPick] = useState(start);
  const [xray, setXray] = useState(false);
  const [tour, setTour] = useState(false);
  const [stage, setStage] = useState(1);
  const [auto, setAuto] = useState(false);
  const [time, setTime] = useState(0);
  const [still, setStill] = useState(false);

  useEffect(() => {
    setStill(!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  }, []);

  // clock for the sound view
  useEffect(() => {
    if (mode !== 'sound' || still) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      setTime((now - t0) / 1000);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mode, still]);

  // the walk through the parts
  useEffect(() => {
    if (!tour || mode !== 'parts') return;
    const id = setInterval(() => {
      setPick((cur) => {
        const k = PARTS.findIndex((p) => p.id === cur);
        return PARTS[(k + 1) % PARTS.length].id;
      });
    }, 5200);
    return () => clearInterval(id);
  }, [tour, mode]);

  // the steps of the sound
  useEffect(() => {
    if (!auto || mode !== 'sound') return;
    const id = setInterval(() => setStage((s) => (s % 5) + 1), 3400);
    return () => clearInterval(id);
  }, [auto, mode]);

  const part = PARTS.find((p) => p.id === pick) ?? PARTS[0];
  const t = still ? 0.35 : time;
  const showX = mode === 'sound' ? stage === 3 || stage === 4 : xray || !!part.internal;
  const clip = `ga-clip-${uid}`;

  const choose = (id: string) => {
    setTour(false);
    setPick(id);
  };
  const pluckAll = () => {
    chord(OPEN_STRUM, { dur: 2.6, spread: 0.035 });
    setStage(1);
    setAuto(true);
  };
  const step = (d: number) => {
    if (mode === 'parts') {
      const k = PARTS.findIndex((p) => p.id === pick);
      choose(PARTS[(k + d + PARTS.length) % PARTS.length].id);
    } else {
      setAuto(false);
      setStage((cur) => ((cur - 1 + d + 5) % 5) + 1);
    }
  };

  const op = (k: number) => (stage === k ? 1 : stage > k ? 0.4 : 0);

  // ---- sound view layers
  const ripple = (k: number) => {
    const ph = (t * 0.5 + k / 3) % 1;
    return { r: 14 + ph * 170, o: (1 - ph) * 0.65 };
  };
  const wave = (k: number) => {
    const ph = (t * 0.42 + k / 3) % 1;
    return { r: SOUND.r + 6 + ph * 190, o: (1 - ph) * 0.8 };
  };
  const pulse = Math.sin(2 * Math.PI * 1.3 * t);

  const label = (() => {
    if (mode !== 'parts') return null;
    const [ax, ay] = part.anchor;
    const left = part.side === 'l';
    const ex = left ? 148 : 372;
    return (
      <g pointerEvents="none">
        <line x1={ax} y1={ay} x2={ex} y2={ay} stroke="var(--fg)" strokeWidth="1.6" />
        <circle cx={ax} cy={ay} r="4.5" fill="var(--accent)" stroke="var(--surface)" strokeWidth="1.5" />
        <text x={left ? ex : ex} y={ay - 7} textAnchor={left ? 'end' : 'start'} style={{ fontSize: 18, fontWeight: 700, fill: 'var(--fg)', paintOrder: 'stroke', stroke: 'var(--surface)', strokeWidth: 4 }}>
          {part.short ?? part.name}
        </text>
      </g>
    );
  })();

  const stageText = T.stages[stage - 1];
  const info = T.parts[part.id];

  return (
    <figure className="viz">
      <style>{`
        .ga-cq{container-type:inline-size}
        .ga-wrap{display:flex;flex-direction:column;gap:16px}
        .ga-stage{display:grid;grid-template-columns:minmax(200px,300px) minmax(0,1fr);gap:20px;align-items:start;background:var(--surface);border:2px solid var(--line);border-radius:var(--radius);padding:14px}
        .ga-art svg{display:block;width:100%;height:auto}
        .ga-ctrl{min-width:0;display:flex;flex-direction:column;gap:12px}
        @container (max-width: 480px){
          .ga-stage{grid-template-columns:minmax(0,1fr);gap:12px}
          .ga-art{max-width:340px;width:100%;margin:0 auto}
        }
        .ga-group{display:grid;grid-template-columns:48px minmax(0,1fr);gap:8px;align-items:start}
        .ga-group b{font-size:14px;color:var(--muted);padding-top:7px}
        .ga-pop{min-width:0;font-size:16px;line-height:1.7}
        .ga-pop-head{display:flex;justify-content:space-between;align-items:flex-start;gap:8px}
        .ga-pop p{margin:10px 0 0}
        .ga-pop b{display:block;color:var(--accent);font-size:13px;line-height:1.4}
        .ga-name{font-family:var(--display);font-weight:600;font-size:22px;line-height:1.3}
        .ga-name small{font-family:inherit;font-weight:400;font-size:15px;color:var(--muted);margin-left:8px}
        .ga-note{font-size:14px;color:var(--muted);margin-top:4px}
        .ga-nav{display:flex;gap:6px;flex:none}
        .ga-nav button{all:unset;cursor:pointer;box-sizing:border-box;width:30px;height:30px;border-radius:99px;border:2px solid var(--line);background:var(--surface);text-align:center;line-height:24px;font-size:20px}
        .ga-nav button:focus-visible{outline:3px solid color-mix(in srgb, var(--brand) 55%, transparent);outline-offset:2px}
        .ga-hl > *{animation:ga-pulse 1.5s ease-in-out infinite}
        @keyframes ga-pulse{0%,100%{fill-opacity:.18;stroke-opacity:.7}50%{fill-opacity:.45;stroke-opacity:1}}
        @media (prefers-reduced-motion: reduce){.ga-hl > *{animation:none}}
      `}</style>
      <div className="viz-title">{T.title}</div>
      <Pills<Mode> label={T.modeLabel} value={mode} onChange={(m) => { setMode(m); setTour(false); setAuto(false); }} options={[{ value: 'parts', text: T.modes[0] }, { value: 'sound', text: T.modes[1] }]} />

      <div className="ga-cq">
      <div className="ga-wrap">
        <div className="ga-stage">
          <div className="ga-art">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={mode === 'parts' ? T.svgLabel(part.name) : `${T.soundLabel} ${stage}`}>
            <defs>
              <clipPath id={clip}><path d={BODY} /></clipPath>
            </defs>

            {/* sides and back, seen as a sliver behind the top */}
            <path d={BODY} transform="translate(6,7)" fill="var(--soil-dark)" />
            {/* top, with the binding drawn as the edge */}
            <path d={BODY} fill={TOP_FILL} stroke={CREAM} strokeWidth="5" strokeLinejoin="round" />

            {/* sound view: the top moves (stage 3) */}
            {mode === 'sound' && stage >= 3 && (
              <g clipPath={`url(#${clip})`} opacity={op(3)}>
                <path d={BODY} fill="var(--accent)" fillOpacity={0.1 + 0.07 * pulse} />
                {[0, 1, 2].map((k) => {
                  const r = ripple(k);
                  return <ellipse key={k} cx={CX} cy={510} rx={r.r} ry={r.r * 0.92} fill="none" stroke="var(--accent)" strokeWidth="3" opacity={r.o} />;
                })}
              </g>
            )}

            {/* inside of the box: braces, blocks, truss rod */}
            {showX && (
              <g opacity="0.9" pointerEvents="none">
                <rect x={CX - 32} y="336" width="64" height="26" rx="4" fill={DARK_WOOD} />
                <rect x={CX - 26} y="626" width="52" height="22" rx="4" fill={DARK_WOOD} />
                <rect x={CX - 44} y="494" width="88" height="38" rx="4" fill={DARK_WOOD} opacity="0.8" />
                {xbrace.map(([x1, y1, x2, y2], i) => <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={DARK_WOOD} strokeWidth="8" strokeLinecap="round" />)}
                <line x1={CX - 84} y1="374" x2={CX + 84} y2="374" stroke={DARK_WOOD} strokeWidth="6" strokeLinecap="round" />
                <line x1={CX - 58} y1="560" x2={CX - 44} y2="618" stroke={DARK_WOOD} strokeWidth="5" strokeLinecap="round" />
                <line x1={CX + 58} y1="560" x2={CX + 44} y2="618" stroke={DARK_WOOD} strokeWidth="5" strokeLinecap="round" />
              </g>
            )}

            {/* sound view: the air in the box (stage 4) */}
            {mode === 'sound' && stage >= 4 && (
              <g opacity={op(4)} pointerEvents="none">
                <g clipPath={`url(#${clip})`}>
                  {AIR.map((a, i) => {
                    const dx = SOUND.x - a.x;
                    const dy = SOUND.y - a.y;
                    const d = Math.hypot(dx, dy) || 1;
                    const m = 9 * Math.sin(2 * Math.PI * 1.3 * t + a.ph * 4);
                    return <circle key={i} cx={a.x + (dx / d) * m} cy={a.y + (dy / d) * m} r="2.6" fill="var(--brand)" fillOpacity="0.8" />;
                  })}
                </g>
                <circle cx={SOUND.x} cy={SOUND.y} r={SOUND.r + 3 + 3 * pulse} fill="none" stroke="var(--brand)" strokeWidth="3" />
              </g>
            )}

            {/* rosette and soundhole */}
            <circle cx={SOUND.x} cy={SOUND.y} r="37" fill="none" stroke="#2B2420" strokeWidth="2" />
            <circle cx={SOUND.x} cy={SOUND.y} r="34" fill="none" stroke={CREAM} strokeWidth="3" />
            <circle cx={SOUND.x} cy={SOUND.y} r={SOUND.r} fill="#1D1915" stroke={CREAM} strokeWidth="2" />
            <ellipse cx={SOUND.x} cy={SOUND.y + 6} rx={SOUND.r - 6} ry={SOUND.r - 12} fill="#2A241E" />

            {/* pickguard */}
            <path d={PICKGUARD} fill="#2F2924" fillOpacity="0.88" />

            {/* bridge, saddle and pins (they push on the top in stage 2) */}
            <g transform={mode === 'sound' && stage >= 2 ? `translate(${CX},512) scale(${1 + 0.07 * pulse * (stage === 2 ? 1 : 0.5)}) translate(${-CX},-512)` : undefined}>
              <rect x={CX - 47} y="496" width="94" height="32" rx="5" fill={DARK_WOOD} />
              {Array.from({ length: 6 }, (_, i) => <circle key={i} cx={saddleX(i)} cy={saddleY(i) + 11} r="3.4" fill={CREAM} stroke="#1D1915" strokeWidth="0.8" />)}
              <line x1={CX - 40} y1="511.6" x2={CX + 40} y2="507.6" stroke={CREAM} strokeWidth="4" strokeLinecap="round" />
              {mode === 'sound' && stage >= 2 && (
                <rect x={CX - 47} y="496" width="94" height="32" rx="5" fill="none" stroke="var(--accent)" strokeWidth="3" opacity={op(2)} />
              )}
            </g>

            {/* headstock, neck, fretboard */}
            <polygon points={NECK_PTS} fill="var(--soil)" stroke="#1D1915" strokeOpacity="0.4" strokeWidth="1" />
            <polygon points={FB_PTS} fill={DARK_WOOD} />
            {fretLines.map((f) => <line key={f.y} x1={f.x1} x2={f.x2} y1={f.y} y2={f.y} stroke="#D7DAD2" strokeWidth="1.8" />)}
            {INLAYS.map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="3.4" fill={CREAM} />)}
            <path d={HEAD} fill="#2E2520" stroke="var(--line-strong)" strokeWidth="1.5" />
            <rect x={CX - 12} y="54" width="24" height="4" rx="2" fill={CREAM} opacity="0.55" />
            <rect x={CX - 7} y="62" width="14" height="3" rx="1.5" fill={CREAM} opacity="0.35" />
            {KNOBS.map(([x, y], i) => (
              <g key={i}>
                <line x1={x + (i < 3 ? 15 : -15)} y1={y} x2={x} y2={y} stroke={METAL} strokeWidth="3" />
                <circle cx={x} cy={y} r="7.5" fill={METAL} stroke="#6E746C" strokeWidth="1.2" />
              </g>
            ))}
            {POSTS.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3.2" fill={METAL} stroke="#6E746C" strokeWidth="0.8" />)}
            <rect x={CX - 21} y="112" width="42" height="8" rx="2" fill={CREAM} />

            {/* truss rod, seen through the neck in the x-ray */}
            {mode === 'parts' && showX && (
              <g pointerEvents="none">
                <line x1={CX} x2={CX} y1="104" y2="398" stroke="#E9B949" strokeOpacity="0.9" strokeWidth="3" strokeDasharray="7 5" strokeLinecap="round" />
                <circle cx={CX} cy="104" r="5" fill="#E9B949" />
              </g>
            )}

            {/* strings: still in the parts view, moving in the sound view */}
            {mode === 'sound'
              ? Array.from({ length: 6 }, (_, i) => (
                  <g key={i}>
                    <path d={wiggle(i, t, 5 - i * 0.3)} fill="none" stroke="#1D1915" strokeOpacity="0.35" strokeWidth={strW(i) + 1.6} strokeLinecap="round" />
                    <path d={wiggle(i, t, 5 - i * 0.3)} fill="none" stroke={stage === 1 ? 'var(--accent)' : '#D9DCD4'} strokeWidth={strW(i) + (stage === 1 ? 0.8 : 0)} strokeLinecap="round" />
                  </g>
                ))
              : Array.from({ length: 6 }, (_, i) => (
                  <g key={i}>
                    <path d={stringPath(i)} fill="none" stroke="#1D1915" strokeOpacity="0.35" strokeWidth={strW(i) + 1.6} strokeLinecap="round" strokeLinejoin="round" />
                    <path d={stringPath(i)} fill="none" stroke="#D9DCD4" strokeWidth={strW(i)} strokeLinecap="round" strokeLinejoin="round" />
                  </g>
                ))}

            {/* end pin */}
            <circle cx={CX} cy="645" r="6" fill={METAL} stroke="#6E746C" strokeWidth="1.2" />

            {/* sound view: the sound leaves (stage 5) */}
            {mode === 'sound' && stage >= 5 && (
              <g opacity={op(5)} pointerEvents="none">
                {[0, 1, 2].map((k) => {
                  const w = wave(k);
                  return <circle key={k} cx={SOUND.x} cy={SOUND.y} r={w.r} fill="none" stroke="var(--accent)" strokeWidth="3.5" opacity={w.o} />;
                })}
              </g>
            )}

            {/* parts view: highlight of the chosen part, then its label */}
            {mode === 'parts' && (
              <g className="ga-hl" pointerEvents="none">
                {part.shape(HL)}
              </g>
            )}
            {label}

            {/* parts view: what can be clicked */}
            {mode === 'parts' && (
              <g aria-hidden="true">
                {[...PARTS]
                  .filter((p) => !p.nohit && (!p.internal || showX))
                  .sort((a, b) => a.z - b.z)
                  .map((p) => (
                    <g key={p.id} onClick={() => choose(p.id)} style={{ cursor: 'pointer' }}>
                      {p.shape(HIT)}
                    </g>
                  ))}
              </g>
            )}
          </svg>
          </div>

          <div className="ga-pop" aria-live="polite">
            <div className="ga-pop-head">
              <div className="ga-name">
                {mode === 'parts' ? part.name : `${stage}. ${stageText.title}`}
                {mode === 'parts' && lang === 'th' && info.say && <small>{T.reading} {info.say}</small>}
              </div>
              <div className="ga-nav">
                <button type="button" aria-label={T.prev} onClick={() => step(-1)}>‹</button>
                <button type="button" aria-label={T.next} onClick={() => step(1)}>›</button>
              </div>
            </div>
            {mode === 'parts' ? (
              <>
                {part.internal && <div className="ga-note">{T.inside}</div>}
                <p><b>{T.whatIs}</b>{info.what}</p>
                <p><b>{T.does}</b>{info.does}</p>
                {info.tip && <p><b>{T.tip}</b>{info.tip}</p>}
              </>
            ) : (
              <p>{stageText.text}</p>
            )}
          </div>
        </div>

        <div className="ga-ctrl">
          {mode === 'parts' ? (
            <>
              {REGIONS.map((r) => (
                <div key={r} className="ga-group" role="group" aria-label={T.regions[r]}>
                  <b>{T.regions[r]}</b>
                  <div className="viz-steps">
                    {PARTS.filter((p) => p.region === r).map((p) => (
                      <button key={p.id} type="button" aria-pressed={p.id === part.id} onClick={() => choose(p.id)}>{p.name}</button>
                    ))}
                  </div>
                </div>
              ))}
              <div className="viz-controls">
                <button type="button" className="btn sm primary" aria-pressed={tour} onClick={() => setTour((v) => !v)}>{tour ? T.tourOff : T.tourOn}</button>
                <button type="button" className="btn sm" aria-pressed={xray} onClick={() => setXray((v) => !v)}>{xray ? T.xrayOff : T.xrayOn}</button>
              </div>
            </>
          ) : (
            <>
              <div className="ga-group" role="group" aria-label={T.stageLabel}>
                <b>{T.stageLabel}</b>
                <div className="viz-steps">
                  {T.stages.map((s, i) => (
                    <button key={i} type="button" aria-pressed={stage === i + 1} onClick={() => { setAuto(false); setStage(i + 1); }}>{i + 1} {s.short}</button>
                  ))}
                </div>
              </div>
              <div className="viz-controls">
                <button type="button" className="btn sm primary" onClick={pluckAll}>{T.pluck}</button>
                <button type="button" className="btn sm" aria-pressed={auto} onClick={() => setAuto((v) => !v)}>{auto ? T.autoStop : T.auto}</button>
              </div>
            </>
          )}
        </div>
      </div>
      </div>
      <p className="viz-caption">{mode === 'parts' ? T.captionParts : T.captionSound}</p>
    </figure>
  );
}
