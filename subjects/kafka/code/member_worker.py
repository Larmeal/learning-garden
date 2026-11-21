"""A consumer in its own process, so that an exercise can kill it without a goodbye. Usage: member_worker.py <bootstrap> <topic> <group>"""

import sys

from confluent_kafka import Consumer

bootstrap, topic, group = sys.argv[1:4]
c = Consumer({
    "bootstrap.servers": bootstrap, "group.id": group, "auto.offset.reset": "earliest", "enable.auto.commit": False,
    "session.timeout.ms": 6000, "heartbeat.interval.ms": 1000, "partition.assignment.strategy": "range", "client.id": "worker",
})
c.subscribe([topic])
while True:
    c.poll(0.2)
