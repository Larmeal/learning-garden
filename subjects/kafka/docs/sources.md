# Kafka: sources

The books are kept outside the repo as PDFs under `E:\Books\Data Engineering\Data Processing\Stream Processing\`. They were converted to text with PyMuPDF into a scratch folder outside the repo, with a marker for every PDF page.
A citation in a lesson gives the section or chapter and the **printed** page where the section starts, for example `Kafka: The Definitive Guide หัวข้อ Minimum In-Sync Replicas หน้า 167`, never the section sign or "ch.".
The page numbers of the Definitive Guide come from its own table of contents, the others were read from the page header or footer.

## Books that are cited

| Short name | Book | Printed page = PDF page minus | Checked on |
|---|---|---|---|
| DG | Kafka: The Definitive Guide, 2nd edition (Shapira, Palino, Sivaram and Petty, O'Reilly, 2021) | 28 | PDF 30 = page 2, 60 = 32, 100 = 72 (footer of each page) |
| KIA | Kafka in Action (Scott, Gamov and Klein, Manning) | 25 | PDF 30 = page 5, 60 = 35, 100 = 75 (header) |
| KC | Kafka Connect: Build and Run Data Pipelines (Maison and Stanley, O'Reilly) | 20 | PDF 30 = page 10, 60 = 40, 100 = 80 (footer) |
| KSA | Kafka Streams in Action, 2nd edition (Bejeck, Manning) | 26 | PDF 30 = page 4, 60 = 34, 100 = 74 (header) |

Pages cited by the lessons (DG): Enter Kafka p4, Topics and Partitions p5, Partitions p68, Quotas and Throttling p73, Consumer Groups and Partition Rebalance p80, Commits and Offsets p94, The Controller p136, KRaft p137, Replication p139,
Request Processing p142, Physical Storage p149, Indexes p155, Compaction p156, Replication (reliability) p163, Replication Factor p165, Unclean Leader Election p166, Minimum In-Sync Replicas p167, Keeping Replicas In Sync p168,
Idempotent Producer p182, Transactions p186, How Transactions Work p198. The other books are cited with the section and the page named in each lesson.

The Definitive Guide was written for Kafka 2.7 with ZooKeeper, and Kafka has moved on. What differs on Kafka 4.4.0 is listed in `verified-findings.md` and in the lessons: no ZooKeeper (KRaft only), `segment.bytes` has a floor of 1 MiB,
`linger.ms` defaults to 5 in the Java producer, the Java producer is idempotent by default, the new consumer group protocol is the broker's default, and `kafka-topics --describe` shows `Elr` columns that the book does not know.
The figures of the books could not be seen, only their captions and the text around them.

## Books that exist and were not cited

| Book | Note |
|---|---|
| Building Real-Time Analytics Systems (Needham, Kafka and Apache Pinot) | not opened for a lesson |
| Event Streams in Action (Dean and Crettaz) | not opened, older than Kafka 4 |
| Mastering Kafka Streams and ksqlDB (Seymour) | not opened; Kafka Streams is covered from KSA and from a run of `WordCountDemo` |
| Designing Data-Intensive Applications (Kleppmann, 2nd edition) | the chapter on logs and streams was not read for this subject |

## Kafka itself

Everything marked "ran" was run against the image `apache/kafka:4.4.0` (Kafka 4.4.0, KRaft mode, Java 21, Alpine Linux) started with Docker Engine 29.9.3 on Docker Desktop (WSL2), with `confluent-kafka` 2.16.2 (librdkafka 2.16.0)
and `fastavro` 1.12.1 on Python 3.14 for Windows. The source of Kafka at tag `4.4.0` is a shallow clone in `E:\Development\Project\open-source\kafka`, read with `grep` for the constants and functions that the lessons cite
(`ProducerConfig.java`, `Utils.murmur2`, `LogConfig.java`, `UnifiedLog.deleteSegments`, `ReplicationConfigs.java`, `WordCountDemo.java`); it was not read as a whole and no knowledge graph was built (`graphs/` is empty).
The Kafka documentation website was not fetched.

Images pulled from Docker Hub on 2026-11-20 (the tag `4.4.0` does not move, but Docker Hub's `latest` was still 4.3.1 on that day). One package was added to the container of the Streams exercise: `libstdc++` with `apk`, because the RocksDB library of Kafka Streams
needs it and the Alpine image does not have it.
