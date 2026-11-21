// Checks that the TypeScript behind the Kafka labs gives the numbers that the exercises got from real brokers.
// Run from the repo root: node subjects/kafka/code/verify_labs.mts   (Node 22.18 or newer)
// The JSON files are the ones that `python verify.py --write` saved in site/src/components/labs/kafka/.
import { readFileSync } from 'node:fs';
import { hashOf, partitionOf } from '../../../site/src/components/labs/kafka/murmur.ts';
import { commitOutcome, isrInit, isrKill, isrProduce, isrFetch, isrStart, isrUnclean, kraftCreate, kraftInit, kraftKill, rangeAssign } from '../../../site/src/components/labs/kafka/models.ts';

const dir = new URL('../../../site/src/components/labs/kafka/', import.meta.url);
const load = (name: string) => JSON.parse(readFileSync(new URL(name, dir), 'utf8'));
let n = 0;
const ok = (label: string, cond: boolean, detail = '') => {
  n++;
  console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${label}${cond ? '' : '  ' + detail}`);
  if (!cond) process.exit(1);
};

// 1. the hash and the partition of every key of exercise 02
const part = load('partitions.json');
for (const k of part.keys) {
  ok(`murmur2("${k.key}") = ${k.hash}`, hashOf(k.key) === k.hash, String(hashOf(k.key)));
  ok(`"${k.key}" goes to partition ${k.p3} of 3 and ${k.p6} of 6`, partitionOf(k.key, 3) === k.p3 && partitionOf(k.key, 6) === k.p6);
}

// 2. the range assignor against the assignments that exercise 04 saw
const groups = load('groups.json');
for (const step of groups.steps.filter((s: any) => s.members)) {
  const got = [...rangeAssign(Array.from({ length: step.members }, (_, i) => i + 1), 3).values()].map((v) => v.join(','));
  const want = Object.values(step.owners).map((v: any) => v.join(','));
  ok(`${step.members} members share 3 partitions as ${JSON.stringify(want)}`, JSON.stringify(got) === JSON.stringify(want), JSON.stringify(got));
}

// 3. commit modes against exercises 04 and 08
const a = commitOutcome('after-batch', 8);
ok('commit after the batch, crash after 8: committed 6, records 6 and 7 twice, the rest once', a.committed === 6 && a.times.join('') === '1111112211', JSON.stringify(a));
const b = commitOutcome('before', 0);
ok('commit before processing, crash at once: records 0 to 5 are lost', b.committed === 6 && b.times.slice(0, 6).every((t) => t === 0) && b.times.slice(6).every((t) => t === 1), JSON.stringify(b));
const c = commitOutcome('after-each', 8);
ok('commit after every record: nothing lost, nothing twice', c.times.every((t) => t === 1));

// 4. the ISR model against the unclean election of exercise 06
const rep = load('replication.json');
let s = isrInit(1);
for (let i = 0; i < 3; i++) s = isrProduce(s);
s = isrFetch(s);
ok('three copies of the same length and a high watermark of 3', s.brokers.every((x) => x.leo === 3) && s.hw === 3);
s = isrKill(isrKill(s, 2), 3);
for (let i = 0; i < 5; i++) s = isrProduce(s);
ok('the lone leader acknowledged 5 more records (high watermark 8)', s.hw === 8 && s.leader === 1);
s = isrKill(s, 1);
ok('the leader dies: no leader, because the other replicas are outside the ISR', s.leader === null && s.elr === 1);
s = isrStart(s, 2);
s = isrUnclean(s);
const lost = rep.steps.find((x: any) => x.what === 'unclean election').lost;
ok(`an unclean election loses ${lost} records, as in the exercise`, s.lost === lost, String(s.lost));
let t = isrInit(2);
t = isrKill(isrKill(t, 2), 3);
ok('with min.insync.replicas=2 and one broker left the write is refused', isrProduce(t).event === 'refused');

// 5. the KRaft model against exercise 07
const kr = load('kraft.json');
let k = kraftInit();
k = kraftKill(k, 1);
ok(`killing the leader raises the epoch (the model: 1 to ${k.epoch}; the real runs: ${kr.election.epoch_before} to ${kr.election.epoch_after})`, k.epoch > kr.election.epoch_before && kr.election.epoch_after > kr.election.epoch_before && k.leader !== 1);
const before = k.nodes[1].log.length;
k = kraftCreate(k);
ok('creating a topic appends one TOPIC_RECORD and two PARTITION_RECORDs (3 records)', k.nodes[1].log.length === before + 3 && kr.create_topic.length === 3);
const rest = k.nodes.filter((x) => x.alive).map((x) => x.id);
k = kraftKill(k, rest[0]);
ok('with one controller of three left there is no leader and no topic can be created', k.leader === null && kraftCreate(k).event === 'nomajority');

// 6. the log of exercise 08
const del = load('delivery.json');
ok('the transaction log has 8 offsets: a1 a2 COMMIT b1 b2 ABORT c1 COMMIT', del.log.map((r: any) => r.what).join(' ') === 'a1 a2 COMMIT b1 b2 ABORT c1 COMMIT');

console.log(`\n${n} checks`);
console.log('ok');
