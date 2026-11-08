import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { splitLinks } from '../../../lib/inline-links';
import type { Lang } from './stepper';

// The history of Spark as a timeline. The line draws itself down the page when the lab comes into view, and every
// period opens a card with what happened, why it matters and where the source is. The play button walks through the
// periods one by one. Dates are from the Apache Spark news and release pages; the text of every card says where it came from.
// The links inside a card are written as [text](/path/#heading) like in lesson text; their headings were checked with
// `npm run check:refs` when this file was written, but that check does not read this file, so change them with care.

type Kind = 'before' | 'origin' | 'release' | 'result';

// Same order as the cards in TEXT. The colour of the dot tells what kind of moment it is.
const META: { kind: Kind; href: string }[] = [
  { kind: 'before', href: 'https://research.google/pubs/mapreduce-simplified-data-processing-on-large-clusters/' },
  { kind: 'before', href: 'https://bigdatawire.com/2015/04/15/from-spiders-to-elephants-the-history-of-hadoop' },
  { kind: 'origin', href: 'https://spark.apache.org/history.html' },
  { kind: 'origin', href: 'https://spark.apache.org/history.html' },
  { kind: 'origin', href: 'https://www.usenix.org/conference/nsdi12/technical-sessions/presentation/zaharia' },
  { kind: 'origin', href: 'https://spark.apache.org/history.html' },
  { kind: 'origin', href: 'https://spark.apache.org/news/index.html' },
  { kind: 'release', href: 'https://spark.apache.org/news/index.html' },
  { kind: 'result', href: 'https://www.databricks.com/blog/2014/10/10/spark-petabyte-sort.html' },
  { kind: 'release', href: 'https://spark.apache.org/releases/spark-release-1-3-0.html' },
  { kind: 'release', href: 'https://spark.apache.org/releases/spark-release-2-0-0.html' },
  { kind: 'release', href: 'https://spark.apache.org/releases/spark-release-3-0-0.html' },
  { kind: 'release', href: 'https://spark.apache.org/releases/spark-release-4-0-0.html' },
  { kind: 'release', href: 'https://spark.apache.org/news/index.html' },
];

interface Card {
  when: string;
  name: string;
  text: string;
  where?: string;
  src: string;
}

const TEXT: Record<Lang, {
  title: string;
  play: string;
  stop: string;
  again: string;
  prev: string;
  next: string;
  kinds: Record<Kind, string>;
  whereLabel: string;
  srcLabel: string;
  hint: string;
  cards: Card[];
}> = {
  th: {
    title: 'ประวัติของ Spark ตั้งแต่ก่อนมี Spark จนถึงปัจจุบัน',
    play: 'เล่นต่อเนื่อง',
    stop: 'หยุด',
    again: 'เล่นใหม่',
    prev: '← ก่อนหน้า',
    next: 'ถัดไป →',
    kinds: { before: 'ก่อนมี Spark', origin: 'จุดเริ่มต้นของโปรเจกต์', release: 'รุ่นที่ออก', result: 'ผลที่วัดได้' },
    whereLabel: 'ในเส้นทางนี้',
    srcLabel: 'ที่มา',
    hint: 'กดที่ช่วงเวลาไหนก็ได้เพื่อดูรายละเอียด กดซ้ำเพื่อปิด',
    cards: [
      {
        when: '2003 ถึง 2004',
        name: 'Google ออก GFS และ MapReduce',
        text: 'ตอนนั้นข้อมูลของเว็บใหญ่เกินกว่าคอมพิวเตอร์เครื่องเดียวจะประมวลผลไหว Google จึงเสนอระบบเก็บไฟล์แบบกระจาย (GFS) และวิธีเขียนงานที่ผู้ใช้เขียนแค่สองฟังก์ชัน คือ map กับ reduce ส่วนการแบ่งงานไปคอมพิวเตอร์หลายเครื่องและการรับมือกับคอมพิวเตอร์ที่เสียระหว่างทาง ระบบจัดการให้เอง',
        src: 'paper MapReduce (OSDI 2004)',
      },
      {
        when: '2006',
        name: 'Hadoop เกิดขึ้น',
        text: 'Doug Cutting กับ Mike Cafarella กำลังสร้าง Nutch ซึ่งเป็นเครื่องมือค้นหา แล้วพบว่าโครงสร้างเดิมรองรับเว็บที่ใหญ่ขนาดนั้นไม่ไหว พวกเขาจึงทำระบบแนวเดียวกับ GFS และ MapReduce แยกออกมาเป็น Hadoop โดยมี Yahoo ช่วยทั้งทีมและคอมพิวเตอร์ หลังจากนั้นบริษัททั่วไปก็ใช้ cluster ของคอมพิวเตอร์ธรรมดาประมวลผลข้อมูลก้อนใหญ่ได้ (แต่ละแหล่งให้เดือนไม่ตรงกัน ที่ตรงกันคือปี 2006)',
        src: 'BigDATAwire (แหล่งรอง)',
      },
      {
        when: '2009',
        name: 'Spark เริ่มเป็นงานวิจัยที่ AMPLab',
        text: 'Spark เริ่มจากงานวิจัยของ UC Berkeley AMPLab ส่วนปัญหาที่มันตั้งใจแก้ ตามที่ paper ปี 2012 เล่าไว้ คืองานที่ต้องใช้ข้อมูลชุดเดิมซ้ำหลายรอบ ซึ่ง MapReduce ต้องอ่านจาก disk ใหม่ทุกครั้ง',
        where: 'ดูปัญหานี้ในหน้า[Spark คืออะไร](/spark/foundations/overview/#mapreduce-ติดตรงไหน)',
        src: 'หน้า History ของ Apache Spark',
      },
      {
        when: 'ต้นปี 2010',
        name: 'เปิดเป็น open source',
        text: 'โค้ดถูกเปิดให้ทุกคนใช้ได้ หลังจากนั้นก็มีนักพัฒนามาช่วยกันสร้างต่อ จนปัจจุบันมีนักพัฒนาหลายร้อยคนจากหลายร้อยองค์กร',
        src: 'หน้า History ของ Apache Spark',
      },
      {
        when: '2012',
        name: 'paper RDD',
        text: 'ทีมวิจัยตีพิมพ์ paper Resilient Distributed Datasets ที่การประชุม NSDI อธิบายว่าทำไมงานที่วนซ้ำและการสำรวจข้อมูลแบบโต้ตอบถึงช้าบน MapReduce แล้วเสนอ RDD ที่จำ "สูตร" ของข้อมูล (lineage) แทนการเก็บสำเนา paper รายงานว่าเร็วกว่า Hadoop ได้ถึง 20 เท่าในงานที่วนซ้ำ',
        where: 'lineage อยู่ใน[บทที่ 13](/spark/internals/#rdd-และ-lineage)',
        src: 'paper RDD (NSDI 2012)',
      },
      {
        when: '2013',
        name: 'ย้ายเข้า Apache Software Foundation',
        text: 'โปรเจกต์ย้ายไปอยู่กับ Apache Software Foundation หน้า History ของโปรเจกต์ระบุแค่ปี ไม่ได้ระบุเดือน',
        src: 'หน้า History ของ Apache Spark',
      },
      {
        when: '27 ก.พ. 2014',
        name: 'เป็น top-level project',
        text: 'Apache Software Foundation ประกาศว่า Spark ผ่านการเป็น incubator แล้ว และเป็น top-level project ของมูลนิธิ',
        src: 'หน้า News ของ Apache Spark',
      },
      {
        when: '30 พ.ค. 2014',
        name: 'Spark 1.0',
        text: 'รุ่นแรกที่รับประกันว่า API หลักจะไม่เปลี่ยน และเป็นรุ่นแรกที่มี Spark SQL ในรุ่นนี้ MLlib ได้อัลกอริทึมใหม่ และการรองรับ YARN ก็ปลอดภัยขึ้น',
        src: 'หน้า News ของ Apache Spark',
      },
      {
        when: 'ปลายปี 2014',
        name: 'เรียงข้อมูล 100 TB (Daytona GraySort)',
        text: 'Databricks รายงานว่า Spark เรียงข้อมูล 100 TB เสร็จใน 23 นาทีด้วยคอมพิวเตอร์ 206 เครื่อง ส่วนสถิติเดิมของ Hadoop MapReduce ใช้คอมพิวเตอร์ 2,100 เครื่อง 72 นาที คิดเป็นเร็วกว่าราว 3 เท่าด้วยคอมพิวเตอร์น้อยกว่าราว 10 เท่า สิ่งที่ควรรู้คือการเรียงรอบนั้นทำบน disk และไม่ได้ใช้ cache ใน memory ของ Spark ผลนี้จึงมาจากการออกแบบ engine โดยเฉพาะ shuffle ไม่ได้มาจาก memory อย่างเดียว และเป็นตัวเลขของฝ่ายที่ส่งเข้าแข่ง (Spark ชนะร่วมกับทีม Themis ของ UCSD)',
        where: 'ดู shuffle ใน[บทที่ 5](/spark/execution-model/#ทำไม-shuffle-ถึงแพง)',
        src: 'บล็อกของ Databricks',
      },
      {
        when: '13 มี.ค. 2015',
        name: 'Spark 1.3: DataFrame',
        text: 'เพิ่ม DataFrame API ซึ่ง release notes เรียกว่า "an evolution of the base RDD API that includes named fields along with schema information" คือ RDD ที่มีชื่อคอลัมน์และ schema ติดมาด้วย และ Spark SQL พ้นสถานะ alpha ในตอนนั้นเป็นรุ่นที่ใหญ่ที่สุดของโปรเจกต์ มีผู้ร่วมพัฒนา 174 คน',
        where: 'DataFrame อยู่ใน[บทที่ 3](/spark/dataframe-sql/)',
        src: 'release notes 1.3.0',
      },
      {
        when: '26 ก.ค. 2016',
        name: 'Spark 2.0',
        text: 'DataFrame กับ Dataset กลายเป็นชนิดเดียวกันใน Scala และ Java (ใน Python ใช้ DataFrame อยู่แล้ว) และ SparkSession กลายเป็นจุดเริ่มต้นจุดเดียว นอกจากนี้ยังมี whole-stage code generation ที่ release notes บอกว่าเร็วขึ้น 2 ถึง 10 เท่าในตัวดำเนินการทั่วไป และ Structured Streaming รุ่นทดลองรุ่นแรก',
        where: 'ดู[Structured Streaming](/spark/structured-streaming/) และ[whole-stage codegen](/spark/internals/#whole-stage-codegen-java-ที่-spark-เขียนให้)',
        src: 'release notes 2.0.0',
      },
      {
        when: '18 มิ.ย. 2020',
        name: 'Spark 3.0',
        text: 'เพิ่ม Adaptive Query Execution ที่ปรับแผนระหว่างรันตามข้อมูลจริง เพิ่ม dynamic partition pruning และความเข้ากันได้กับ ANSI SQL release notes บอกว่าใน TPC-DS ขนาด 30 TB รุ่น 3.0 เร็วกว่ารุ่น 2.4 ราว 2 เท่า',
        where: 'ดู AQE ใน[บทที่ 6](/spark/catalyst-aqe/#aqe-ทำสามอย่าง)',
        src: 'release notes 3.0.0',
      },
      {
        when: '23 พ.ค. 2025',
        name: 'Spark 4.0',
        text: 'ANSI SQL mode กลายเป็นค่าเริ่มต้น มีชนิดข้อมูล VARIANT, SQL user-defined function และ SQL pipe syntax Spark Connect ขยายขึ้นมาก รวมถึง Python client ตัวเบาขนาด 1.5 MB (pyspark-client) นอกจากนี้ยังเลิกรองรับ Scala 2.12 และ JDK 8 กับ 11 โดยให้ Scala 2.13 กับ JDK 17 เป็นค่าเริ่มต้น',
        where: 'ดู Spark Connect ใน[บทที่ 11](/spark/deployment-spark-ui/#spark-connect-client-กับ-server-แยกกัน)',
        src: 'release notes 4.0.0',
      },
      {
        when: 'ธ.ค. 2025 ถึง ต.ค. 2026',
        name: 'Spark 4.1, 4.2 และ 4.3',
        text: '4.1.0 ออกวันที่ 16 ธ.ค. 2025 4.2.0 ออกวันที่ 14 ก.ค. 2026 และ 4.3.0 ออกวันที่ 30 ต.ค. 2026 บทเรียนชุดนี้รันบน PySpark 4.2.0 ส่วนรุ่นทั้งสามนี้เพิ่มอะไรบ้าง หน้านี้ยังไม่ได้ไปอ่านจาก release notes',
        src: 'หน้า News ของ Apache Spark',
      },
    ],
  },
  en: {
    title: 'The history of Spark, from before Spark existed to today',
    play: 'Autoplay',
    stop: 'Stop',
    again: 'Play again',
    prev: '← Previous',
    next: 'Next →',
    kinds: { before: 'Before Spark', origin: 'How the project began', release: 'A release', result: 'A measured result' },
    whereLabel: 'In this path',
    srcLabel: 'Source',
    hint: 'Click any period to see the details, click again to close it',
    cards: [
      {
        when: '2003 to 2004',
        name: 'Google publishes GFS and MapReduce',
        text: 'The data of the web had become too big for one machine to process. Google described a distributed file system (GFS) and a way of writing jobs where the user writes only two functions, map and reduce. Splitting the work over many machines, and coping with machines that die halfway, is left to the system.',
        src: 'the MapReduce paper (OSDI 2004)',
      },
      {
        when: '2006',
        name: 'Hadoop appears',
        text: 'Doug Cutting and Mike Cafarella were building the search engine Nutch and found that its design could not handle a web that large. They built a system in the style of GFS and MapReduce and split it out as Hadoop, with Yahoo providing a team and machines. After that, ordinary companies could process big data on a cluster of ordinary machines. (Sources disagree on the month. They agree on the year, 2006.)',
        src: 'BigDATAwire (a secondary source)',
      },
      {
        when: '2009',
        name: 'Spark starts as research at the AMPLab',
        text: 'Spark began as research at the UC Berkeley AMPLab. The problem it set out to solve, as the 2012 paper tells it, was work that reuses the same data many times, where MapReduce had to read from disk again on every round.',
        where: 'See this problem on the page [What Spark is](/en/spark/foundations/overview/#where-mapreduce-got-stuck)',
        src: 'the History page of Apache Spark',
      },
      {
        when: 'Early 2010',
        name: 'Released as open source',
        text: 'The code was opened for anyone to use. Developers then joined in, and today hundreds of developers from hundreds of organizations work on it.',
        src: 'the History page of Apache Spark',
      },
      {
        when: '2012',
        name: 'The RDD paper',
        text: 'The research team published the paper Resilient Distributed Datasets at NSDI. It explains why iterative jobs and interactive data mining are slow on MapReduce, and proposes the RDD, which remembers the "recipe" of the data (its lineage) instead of keeping copies. The paper reports up to 20 times faster than Hadoop on iterative jobs.',
        where: 'Lineage is in [lesson 13](/en/spark/internals/#rdd-and-lineage)',
        src: 'the RDD paper (NSDI 2012)',
      },
      {
        when: '2013',
        name: 'Moves to the Apache Software Foundation',
        text: 'The project moved to the Apache Software Foundation. The History page of the project gives the year but not the month.',
        src: 'the History page of Apache Spark',
      },
      {
        when: '27 Feb 2014',
        name: 'Becomes a top-level project',
        text: 'The Apache Software Foundation announced that Spark had left the incubator and become a top-level project of the foundation.',
        src: 'the News page of Apache Spark',
      },
      {
        when: '30 May 2014',
        name: 'Spark 1.0',
        text: 'The first release that guarantees the core API will not change, and the first with Spark SQL. In this release MLlib also got new algorithms, and support for YARN became more secure.',
        src: 'the News page of Apache Spark',
      },
      {
        when: 'Late 2014',
        name: 'Sorting 100 TB (Daytona GraySort)',
        text: 'Databricks reported that Spark sorted 100 TB in 23 minutes on 206 machines, while the earlier Hadoop MapReduce record used 2,100 machines and took 72 minutes. That is about 3 times faster with about 10 times fewer machines. Note that the sort ran on disk and did not use Spark\'s in-memory cache, so the result comes from the design of the engine, the shuffle above all, and not from memory alone. It is also a figure from the team that entered the contest (Spark tied with the Themis team from UCSD).',
        where: 'See the shuffle in [lesson 5](/en/spark/execution-model/#why-a-shuffle-is-expensive)',
        src: 'the Databricks blog',
      },
      {
        when: '13 Mar 2015',
        name: 'Spark 1.3: DataFrame',
        text: 'Adds the DataFrame API, which the release notes call "an evolution of the base RDD API that includes named fields along with schema information", that is, an RDD with column names and a schema attached. Spark SQL leaves alpha. At the time it was the largest release of the project, with 174 contributors.',
        where: 'DataFrame is in [lesson 3](/en/spark/dataframe-sql/)',
        src: 'the 1.3.0 release notes',
      },
      {
        when: '26 Jul 2016',
        name: 'Spark 2.0',
        text: 'DataFrame and Dataset become one type in Scala and Java (Python already used DataFrame), and SparkSession becomes the single entry point. This release also brings whole-stage code generation, which the release notes say gives 2 to 10 times speedups on common operators, and the first experimental Structured Streaming.',
        where: 'See [Structured Streaming](/en/spark/structured-streaming/) and [whole-stage codegen](/en/spark/internals/#whole-stage-codegen-java-that-spark-writes-for-you)',
        src: 'the 2.0.0 release notes',
      },
      {
        when: '18 Jun 2020',
        name: 'Spark 3.0',
        text: 'Adds Adaptive Query Execution, which changes the plan while the query runs, based on the real data, plus dynamic partition pruning and ANSI SQL compliance. The release notes say that on TPC-DS at 30 TB, 3.0 is roughly twice as fast as 2.4.',
        where: 'See AQE in [lesson 6](/en/spark/catalyst-aqe/#aqe-does-three-things)',
        src: 'the 3.0.0 release notes',
      },
      {
        when: '23 May 2025',
        name: 'Spark 4.0',
        text: 'ANSI SQL mode becomes the default. New: the VARIANT data type, SQL user-defined functions and SQL pipe syntax. Spark Connect grows a lot, including a light Python client of 1.5 MB (pyspark-client). Scala 2.12 and JDK 8 and 11 are dropped, with Scala 2.13 and JDK 17 as the defaults.',
        where: 'See Spark Connect in [lesson 11](/en/spark/deployment-spark-ui/#spark-connect-the-client-and-the-server-are-separate)',
        src: 'the 4.0.0 release notes',
      },
      {
        when: 'Dec 2025 to Oct 2026',
        name: 'Spark 4.1, 4.2 and 4.3',
        text: '4.1.0 came out on 16 Dec 2025, 4.2.0 on 14 Jul 2026 and 4.3.0 on 30 Oct 2026. These lessons run on PySpark 4.2.0. What the three releases added has not been read from the release notes for this page.',
        src: 'the News page of Apache Spark',
      },
    ],
  },
};

const rich = (s: string): ReactNode[] => splitLinks(s).map((p, i) => (typeof p === 'string' ? p : <a key={i} href={p.href}>{p.text}</a>));

const AUTOPLAY_MS = 5200;

export default function SparkTimelineLab({ lang = 'th' }: { lang?: Lang }) {
  const T = TEXT[lang];
  const last = T.cards.length - 1;
  const [sel, setSel] = useState(0);
  // The card of the selected period can be closed again; the line stays filled up to it.
  const [open, setOpen] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [shown, setShown] = useState(false);
  const root = useRef<HTMLElement>(null);

  // The list fades in one period after another, the first time the lab is on screen.
  useEffect(() => {
    const el = root.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!playing) return;
    if (sel >= last) {
      setPlaying(false);
      return;
    }
    const t = window.setTimeout(() => setSel((s) => s + 1), AUTOPLAY_MS);
    return () => window.clearTimeout(t);
  }, [playing, sel, last]);

  const go = (n: number) => {
    setPlaying(false);
    setOpen(true);
    setSel(Math.max(0, Math.min(last, n)));
  };
  // A click on the period that is already open closes its card.
  const pick = (n: number) => {
    if (n === sel) {
      setPlaying(false);
      setOpen((o) => !o);
    } else go(n);
  };
  const toggle = () => {
    setOpen(true);
    if (sel >= last) setSel(0);
    setPlaying((p) => !p);
  };

  return (
    <figure className="viz tl" ref={root} data-shown={shown ? '' : undefined}>
      <div className="viz-title">{T.title}</div>
      <div className="lab-controls">
        <button type="button" className="btn" onClick={() => go(sel - 1)} disabled={sel === 0}>{T.prev}</button>
        <button type="button" className="btn primary" onClick={toggle}>{playing ? T.stop : sel >= last ? T.again : T.play}</button>
        <button type="button" className="btn" onClick={() => go(sel + 1)} disabled={sel === last}>{T.next}</button>
      </div>
      <ul className="tl-legend" aria-label={T.hint}>
        {(Object.keys(T.kinds) as Kind[]).map((k) => (
          <li key={k} data-kind={k}>
            <span className="tl-dot-mini" />
            {T.kinds[k]}
          </li>
        ))}
        <li className="tl-hint">{T.hint}</li>
      </ul>
      <ol className="tl-list">
        {T.cards.map((c, i) => {
          const isOpen = open && i === sel;
          return (
            <li key={i} className="tl-item" data-kind={META[i].kind} data-sel={isOpen ? '' : undefined} data-done={i < sel || (i === sel && !open) ? '' : undefined} style={{ ['--i' as string]: i }}>
              <button type="button" className="tl-node" aria-expanded={isOpen} aria-controls={`tl-card-${i}`} onClick={() => pick(i)}>
                <span className="tl-dot" aria-hidden="true" />
                <span className="tl-date">{c.when}</span>
                <span className="tl-name">{c.name}</span>
              </button>
              <div className="tl-detail" id={`tl-card-${i}`} role="region" aria-label={c.name} {...(isOpen ? {} : { inert: true })}>
                <div>
                  <div className="tl-card" aria-live={isOpen && !playing ? 'polite' : 'off'}>
                    <p>{rich(c.text)}</p>
                    {c.where && <p className="tl-where"><b>{T.whereLabel}:</b> {rich(c.where)}</p>}
                    <p className="tl-src"><b>{T.srcLabel}:</b> <a href={META[i].href}>{c.src}</a></p>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </figure>
  );
}
