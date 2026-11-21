// The 32 bit murmur2 hash of the Java client (Utils.murmur2 in clients/.../common/utils/Utils.java, Kafka 4.4.0), and the partition rule of its default partitioner.
// node subjects/kafka/code/verify_labs.mts checks this file against the numbers that exercise 02 got from a real broker.

export function murmur2(data: Uint8Array): number {
  const m = 0x5bd1e995;
  const r = 24;
  let h = (0x9747b28c ^ data.length) | 0;
  const n4 = data.length >> 2;
  for (let i = 0; i < n4; i++) {
    const i4 = i << 2;
    let k = data[i4] | (data[i4 + 1] << 8) | (data[i4 + 2] << 16) | (data[i4 + 3] << 24);
    k = Math.imul(k, m);
    k ^= k >>> r;
    k = Math.imul(k, m);
    h = Math.imul(h, m);
    h ^= k;
  }
  const index = n4 << 2;
  const rest = data.length - index;
  if (rest >= 3) h ^= (data[index + 2] & 0xff) << 16;
  if (rest >= 2) h ^= (data[index + 1] & 0xff) << 8;
  if (rest >= 1) {
    h ^= data[index] & 0xff;
    h = Math.imul(h, m);
  }
  h ^= h >>> 13;
  h = Math.imul(h, m);
  h ^= h >>> 15;
  return h | 0;
}

export const hashOf = (key: string): number => murmur2(new TextEncoder().encode(key));
export const partitionOf = (key: string, partitions: number): number => (hashOf(key) & 0x7fffffff) % partitions;
