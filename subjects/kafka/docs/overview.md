# Kafka: overview

A learning path on Apache Kafka for a data engineer: what the log is, how topics, partitions and keys work, how producers and consumers behave, what the broker keeps on disk, how replication and the KRaft controller keep the data safe,
what delivery guarantees mean, what is inside a message, Kafka Connect and Kafka Streams, running a cluster, and a pipeline that survives a crashed consumer and a killed broker. Thai and English, built on 2026-11-20 and 2026-11-21 from
four books (the Definitive Guide, Kafka in Action, Kafka Connect and Kafka Streams in Action) and from runs against a real Kafka 4.4.0 cluster in Docker.

## Lessons

| # | Slug | Phase | Exercise | Labs |
|---|---|---|---|---|
| 1 | `what-is-kafka` | A | `01_what_is_kafka.py` | `LogLab` |
| 2 | `topics-partitions` | A | `02_topics_partitions.py` | `PartitionLab` |
| 3 | `producers` | B | `03_producers.py` | `BatchLab`, `AcksLab` |
| 4 | `consumer-groups` | B | `04_consumer_groups.py` | `ConsumerGroupLab`, `CommitLab` |
| 5 | `log-storage` | C | `05_log_storage.py` | `SegmentLab`, `CompactionLab` |
| 6 | `replication` | C | `06_replication.py` | `IsrLab` |
| 7 | `kraft` | C | `07_kraft.py` | `ElectionLab` |
| 8 | `delivery` | D | `08_delivery.py` | `DuplicateLab`, `TxnLab` |
| 9 | `schemas` | D | `09_schemas.py` | `SchemaLab` |
| 10 | `connect-streams` | E | `10_connect_streams.py` | `ConnectLab`, `StreamsLab` |
| 11 | `operations` | E | `11_operations.py` | `ListenerLab` |
| 12 | `capstone-pipeline` | E | `12_capstone_pipeline.py` | `PipelineLab` |

Every lesson has a quiz page (4 or 5 questions, Thai and English). The labs take `lang`, share `ib.tsx` and the `ib-` classes with the Iceberg and Docker labs, and the ones that show measured data read JSON that an exercise wrote with `--write`.

## How it is checked

`code/verify.py` re-runs every exercise against real brokers in Docker (`klab.py` starts a cluster, labels everything `klab=1` and removes it at the end). Each exercise asserts what its lesson prints.
The books are a second source (tag book), and claims that are only read, from the source, or that came from the author's own inference are tagged so in the sources table at the end of each lesson.

## What the exercises found that a reader may not expect

- The default hash of `confluent-kafka` (librdkafka, `consistent_random`, CRC32) puts a key in another partition than the Java client would; `partitioner=murmur2_random` matches Java, and the Java rule was reproduced in Python and matched the broker for 6 keys.
- Since Kafka 4.0 a topic's `segment.bytes` cannot be below 1 MiB; the exercise used the internal, test-only `internal.segment.bytes` to get small segments.
- Retention is decided per segment by its newest record, so a record older than `retention.ms` stays readable while its segment holds a newer one, and when every record is old the whole log goes, the active segment included.
- With three nodes that are brokers and controllers, killing two of them takes the metadata quorum away: topics cannot be described or created and the ISR cannot change. The replication exercises therefore use one dedicated controller node.
- NOT_ENOUGH_REPLICAS is retried by the client, so with `min.insync.replicas=2` and one broker left the write ends as a timeout, not as a quick error.
- A record that the leader acknowledged with `acks=all` while it was alone in the ISR was lost for good when an out-of-sync replica was made leader.
- The controller checks for an unclean election only every 5 minutes by default (`unclean.leader.election.interval.ms`); `kafka-leader-election.sh --election-type unclean` does it at once.
- A client that is aborted drops the records it has not sent yet, so `flush()` must come before `abort_transaction()` when the aborted records are meant to be in the log.
- The 8 customers of the capstone filled only 4 of the 6 partitions (keys are not spread evenly).
- Quotas allow a burst of about ten seconds of the rate before they slow a client, so a small test sees no effect.

## Not run (and why)

TLS, SASL and ACLs, `kafka-reassign-partitions`, tiered storage, MirrorMaker 2, a real Schema Registry (the "registry" in exercise 9 is a dictionary in the process), Debezium and any connector that is not a file connector, ksqlDB, Kafka Streams beyond
the `WordCountDemo` of the distribution (no topology of our own, no joins or windows), share groups (KIP-932), a cluster of more than 3 brokers, more than one machine (the brokers share one Docker host), and the Kafka source as a whole.
These are the backlog of a second pass.
