// Small pure models behind the Kafka labs. node subjects/kafka/code/verify_labs.mts runs them against the numbers of the exercises.

// The range assignor: members sorted by id get contiguous partitions, the first (partitions % members) members get one more.
export function rangeAssign(members: number[], partitions: number): Map<number, number[]> {
  const sorted = [...members].sort((a, b) => a - b);
  const out = new Map<number, number[]>(sorted.map((m) => [m, []]));
  if (!sorted.length) return out;
  const base = Math.floor(partitions / sorted.length);
  const extra = partitions % sorted.length;
  let p = 0;
  sorted.forEach((m, i) => {
    const n = base + (i < extra ? 1 : 0);
    out.set(m, Array.from({ length: n }, (_, k) => p + k));
    p += n;
  });
  return out;
}

export type CommitMode = 'before' | 'after-batch' | 'after-each';

// Ten records are read in batches of six. The consumer crashes after `crashAfter` records have been processed; a new consumer starts at the committed offset and processes to the end.
// Returns how many times each record was processed in all (0 = lost) and the offset that was committed when the crash happened.
export function commitOutcome(mode: CommitMode, crashAfter: number, total = 10, batch = 6): { times: number[]; committed: number } {
  const times = new Array(total).fill(0);
  const processed = Math.min(crashAfter, total);
  let committed = 0;
  if (mode === 'before') committed = Math.min(total, (Math.floor(processed / batch) + 1) * batch); // each batch is committed before it is processed
  if (mode === 'after-batch') committed = Math.floor(processed / batch) * batch; // the last batch that was finished
  if (mode === 'after-each') committed = processed;
  for (let i = 0; i < processed; i++) times[i]++;
  for (let i = committed; i < total; i++) times[i]++; // the new consumer starts at the bookmark
  return { times, committed };
}

// ---- one partition with three replicas: leader, ISR, log end offsets and the high watermark ----
export interface Broker { id: number; alive: boolean; leo: number; inIsr: boolean }
export interface IsrState { brokers: Broker[]; leader: number | null; hw: number; elr: number | null; minIsr: number; lost: number; event: string }

export const isrInit = (minIsr = 1): IsrState => ({
  brokers: [1, 2, 3].map((id) => ({ id, alive: true, leo: 0, inIsr: true })), leader: 1, hw: 0, elr: null, minIsr, lost: 0, event: 'start',
});

function recalc(s: IsrState): IsrState {
  const live = s.brokers.filter((b) => b.alive && b.inIsr);
  return live.length && s.leader !== null ? { ...s, hw: Math.min(...live.map((b) => b.leo)) } : s;
}

const clone = (s: IsrState, event: string): IsrState => ({ ...s, brokers: s.brokers.map((b) => ({ ...b })), event });

// acks=all: the write is refused when fewer than min.insync.replicas replicas are in the ISR; otherwise the leader appends.
export function isrProduce(s: IsrState): IsrState {
  if (s.leader === null) return clone(s, 'offline');
  const n = clone(s, 'appended');
  if (n.brokers.filter((b) => b.alive && b.inIsr).length < n.minIsr) return clone(s, 'refused');
  n.brokers.find((b) => b.id === n.leader)!.leo++;
  return recalc(n);
}

// Every live follower fetches from the leader. A follower that has caught up joins the ISR. A follower with a longer log than the leader is cut back (truncated).
export function isrFetch(s: IsrState): IsrState {
  if (s.leader === null) return clone(s, 'offline');
  const n = clone(s, 'fetched');
  const lead = n.brokers.find((b) => b.id === n.leader)!;
  for (const b of n.brokers) {
    if (b.alive && b.id !== n.leader) {
      if (b.leo > lead.leo) n.event = 'truncated';
      b.leo = lead.leo;
      b.inIsr = true;
    }
  }
  return recalc(n);
}

export function isrKill(s: IsrState, id: number): IsrState {
  const n = clone(s, 'killed');
  const b = n.brokers.find((x) => x.id === id)!;
  const wasLastInIsr = b.inIsr && n.brokers.filter((x) => x.alive && x.inIsr).length === 1;
  b.alive = false;
  b.inIsr = false;
  if (n.leader === id) {
    const next = n.brokers.find((x) => x.alive && x.inIsr);
    n.leader = next ? next.id : null;
    if (!next && wasLastInIsr) n.elr = id;
  }
  return recalc(n);
}

export function isrStart(s: IsrState, id: number): IsrState {
  const n = clone(s, 'started');
  const b = n.brokers.find((x) => x.id === id)!;
  b.alive = true;
  if (n.leader === null && n.elr === id) { n.leader = id; b.inIsr = true; n.elr = null; n.event = 'clean-election'; }
  return recalc(n);
}

// The operator forces a leader from the live replicas that are not in the ISR. Records that only the old leader had are lost.
export function isrUnclean(s: IsrState): IsrState {
  const n = clone(s, 'unclean');
  const pick = n.brokers.filter((b) => b.alive).sort((a, b) => b.leo - a.leo)[0];
  if (n.leader !== null || !pick) return clone(s, 'nothing');
  n.lost = Math.max(0, n.hw - pick.leo);
  n.leader = pick.id;
  pick.inIsr = true;
  n.hw = pick.leo;
  n.elr = null;
  return n;
}

// ---- the KRaft quorum: three controllers that keep one metadata log ----
export interface KNode { id: number; alive: boolean; log: string[] }
export interface KraftState { nodes: KNode[]; leader: number | null; epoch: number; event: string }

export const kraftInit = (): KraftState => ({ nodes: [1, 2, 3].map((id) => ({ id, alive: true, log: ['F', 'R', 'R', 'R'] })), leader: 1, epoch: 1, event: 'start' });

const kcopy = (s: KraftState, event: string): KraftState => ({ ...s, nodes: s.nodes.map((n) => ({ ...n, log: [...n.log] })), event });

// A majority of the three nodes has to be alive for anyone to lead. The new leader is the live node with the longest log.
function elect(s: KraftState): KraftState {
  const live = s.nodes.filter((n) => n.alive);
  if (live.length < 2) return { ...s, leader: null, event: 'noquorum' };
  const best = [...live].sort((a, b) => b.log.length - a.log.length || a.id - b.id)[0];
  return { ...s, leader: best.id, epoch: s.epoch + 1, event: 'elected' };
}

export function kraftKill(s: KraftState, id: number): KraftState {
  const n = kcopy(s, 'killed');
  n.nodes.find((x) => x.id === id)!.alive = false;
  const live = n.nodes.filter((x) => x.alive).length;
  if (n.leader === id) return elect(n);
  if (live < 2 && n.leader !== null) return { ...n, leader: null, event: 'noquorum' };
  return n;
}

export function kraftStart(s: KraftState, id: number): KraftState {
  const n = kcopy(s, 'started');
  const me = n.nodes.find((x) => x.id === id)!;
  me.alive = true;
  if (n.leader === null) return elect(n);
  me.log = [...n.nodes.find((x) => x.id === n.leader)!.log];
  return n;
}

// Creating a topic appends a TOPIC_RECORD and one PARTITION_RECORD per partition to the leader's log, and the followers copy them.
export function kraftCreate(s: KraftState): KraftState {
  if (s.leader === null) return kcopy(s, 'nomajority');
  const n = kcopy(s, 'created');
  for (const x of n.nodes) if (x.alive) x.log.push('T', 'P', 'P');
  return n;
}
