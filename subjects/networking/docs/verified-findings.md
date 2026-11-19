# Networking: verified findings

Every claim of a lesson carries one of four tags: **ran** (an exercise in `code/exercises/NN_*.py` asserts it, Linux network namespaces in WSL), **book** (section or chapter number and the printed page), **RFC** (section number, opened and read) or **author** (advice, framing or an inference). "Not run" lists what the lesson says it did not try. This file is generated from the source table at the end of each English lesson, so when a table changes, regenerate it.


## Lesson 1: How one request travels (`big-picture`)

| Statement | Source |
|---|---|
| A 65-byte request becomes ten TCP packets plus two ARP frames | ran: `exercises/01_big_picture.py` |
| Ethernet 14, IP 20, TCP 32 and HTTP 65 bytes make a 131-byte frame | ran: `exercises/01_big_picture.py` |
| IP addresses, ports and data are the same on both sides of the router, while MAC addresses and TTL change | ran: `exercises/01_big_picture.py` |
| Type 0x0800, Protocol 6 and the destination port pick the next layer | ran and book: TCPIP section 1.3.2, page 16 |
| One connection is identified by four numbers | ran and book: TCPIP section 1.3.3, page 17 |
| Four TCP/IP layers, and the comparison with seven OSI layers | book: TCPIP section 1.3.1, page 13; AIO Book 2 chapter 1, page 80 |
| The seven OSI layers, and a switch is a layer 2 device | book: AIO Book 2 chapter 1, page 81 (table 1-1) |
| The Presentation layer converts formats, compresses and encrypts | book: AIO Book 2 chapter 1, pages 88 to 89 |
| Real protocols do not follow OSI to the letter | book: AIO Book 2 chapter 1, page 81 |
| L4 spreads whole connections, L7 reads the HTTP message | ran: `exercises/13_proxies_containers.py` (the names are the author's) |
| JDBC, S3 and Kafka sit at the Application layer over TCP, and walking up through the layers | author (not run) |
| The end-to-end argument | book: TCPIP section 1.1.2, page 6 |
| The picture of a parcel and delivery slips | author |



## Lesson 2: IP addresses, subnets and CIDR (`ip-addresses`)

| Statement | Source |
|---|---|
| An IPv4 address is a 32-bit number, and the network address and broadcast come from the mask | ran: `exercises/02_ip_addresses.py` and book: TCPIP section 2.3.3, page 39, section 2.3.5, page 42 |
| The sizes of prefixes (/8 to /32) and the number of hosts | ran: `exercises/02_ip_addresses.py` |
| The kernel chooses "direct" or "via router" by whether the destination is inside the prefix's network (8 prefixes, 5 destinations) | ran: `exercises/02_ip_addresses.py` |
| VLSM and aggregation | ran and book: TCPIP section 2.3.4, page 41, section 2.4, page 46 |
| The old classful system | book: TCPIP section 2.3.1, page 34 and the table on page 36 |
| Private, loopback, link-local and multicast addresses | book: TCPIP section 2.5, pages 50 to 51, and ran |
| 100.64.0.0/10 is neither private nor global | ran: `exercises/02_ip_addresses.py` |
| 100.64.0.0/10 is used by carriers for stacked NAT | author (not in this book) |
| IPv6 squeezed with `::` and /64 | ran and book: TCPIP section 2.3.6, page 43 |



## Lesson 3: Ethernet, switches and ARP (`link-layer`)

| Statement | Source |
|---|---|
| An Ethernet header is 14 bytes with a destination MAC, a source MAC and a Type | ran: `exercises/03_link_layer.py` and book: TCPIP section 3.2, pages 80 and 86 |
| The group bit and the locally-set bit | ran: `exercises/03_link_layer.py` |
| A switch floods a frame whose destination it has not seen, then uses one port after learning | ran: `exercises/03_link_layer.py` and book: TCPIP section 3.4, pages 98 to 100 |
| The table the switch learned (a on p1, b on p2) | ran: `exercises/03_link_layer.py` |
| An ARP request is broadcast and the reply is unicast, 42 bytes | ran and book: TCPIP section 4.2, page 166, section 4.4, page 170 |
| The neighbour cache | ran and book: TCPIP section 4.3, page 169 |
| MSS equals MTU minus 40 | ran and book: TCPIP section 13.3.1, page 606 |
| A tunnel or VPN with a lower MTU needs the MSS adjusted | author |
| Wi-Fi, VLANs, spanning tree | not run |



## Lesson 4: Routers, TTL and the path of a packet (`ip-routing`)

| Statement | Source |
|---|---|
| A router lowers the TTL by one and recomputes the checksum (64, 63, 62, 61), and every header passes the check | ran: `exercises/04_ip_routing.py` and book: TCPIP section 5.2, pages 183 to 186 |
| Connected rows and forwarding rows in the routing table | ran and book: TCPIP section 5.4, page 208 |
| Longest prefix match | ran and book: TCPIP section 5.4, page 209 |
| Traceroute uses the TTL with ICMP Time Exceeded and Port Unreachable | ran and book: TCPIP section 8.3, pages 361 to 364 and 375 to 376 |
| A routing loop is stopped by the TTL | ran |
| Fragmentation, and offsets in multiples of 8 | ran and book: TCPIP section 10.7, page 488 |
| Path MTU discovery with ICMP Type 3 Code 4 | ran and book: TCPIP section 13.4, page 612 |
| OSPF, BGP and IPv6 | not run |



## Lesson 5: DHCP, NAT and firewalls (`nat-dhcp`)

| Statement | Source |
|---|---|
| DHCP uses DISCOVER, OFFER, REQUEST and ACK, and DISCOVER goes from 0.0.0.0 to 255.255.255.255 | ran: `exercises/05_nat_dhcp.py` and book: TCPIP section 6.2, pages 234 to 239 |
| What OFFER and ACK carry (mask, router, DNS, lease) and the magic cookie | ran and book: TCPIP section 6.2, pages 238 to 239 |
| NAT changes the source to the router's address, and PAT changes a port that collides | ran and book: TCPIP section 7.3, pages 303 to 306 |
| The router keeps a row per connection (conntrack) and translates the way back | ran |
| The outside cannot start a conversation (refused) | ran and book: TCPIP section 7.3, page 303 |
| A stateful firewall and the counter of default drops | ran and book: TCPIP section 7.2, page 300 |
| NAT traversal, IPv6 NAT and the firewall of a real router | not run (book: TCPIP section 7.4, page 316) |
| NAT is not a firewall | author |



## Lesson 6: UDP and DNS (`udp-dns`)

| Statement | Source |
|---|---|
| The UDP header is 8 bytes, a frame is 14 + 20 + 8 + data, and the checksum covers a pseudo-header | ran: `exercises/06_udp_dns.py` and book: TCPIP section 10.2, page 474, section 10.3, page 475 |
| A lost datagram is not reported to the sender, and messages arrive as pieces of the size sent | ran: `exercises/06_udp_dns.py` |
| The resolver walks from the root through the TLD to the authoritative server with referrals and glue | ran and book: TCPIP section 11.3, page 516, section 11.5, page 518 |
| The RD, RA and AA flags and the query ID | ran and book: TCPIP section 11.5, page 518 |
| Names written as length-prefixed labels, and the pointer 0xC00C | ran and book: TCPIP section 11.5, page 518 |
| The cache and the falling TTL, 123 ms against 0 ms | ran and book: TCPIP section 11.4, page 517 |
| CNAME and NXDOMAIN | ran |
| The wait after changing an IP depends on the TTL | author |
| Real DNS on the internet, DNSSEC, DNS over TCP, DoH | not run |



## Lesson 7: A TCP connection from start to end (`tcp-connections`)

| Statement | Source |
|---|---|
| The three-way handshake, SYN and FIN use one sequence number, ack is the next byte awaited | ran: `exercises/07_tcp_connections.py` and book: TCPIP section 13.2, pages 595 to 602 |
| The first data can leave after 1 round trip (20 ms in the exercise) | ran: `exercises/07_tcp_connections.py` |
| The options in the SYN (MSS, SACK, timestamp, window scale), and a window of 63 meaning 64,512 bytes | ran and book: TCPIP section 13.3, pages 606 to 609 |
| The four segments of the close | ran and book: TCPIP section 13.5, pages 616 to 619 |
| TIME-WAIT stays on the side that closed first for about 60 seconds, with two reasons | ran (timer 59 and 45 seconds) and book: TCPIP section 13.5, pages 620 to 624 |
| A port nobody listens on answers RST,ACK at once | ran and book: TCPIP section 13.6, page 626 |
| The SYN is sent again at 0, 1, 2, 3.1, 4.1, 5.1 and 7.1 seconds | ran (a Linux kernel with tcp_syn_linear_timeouts=4) |
| A fast refused means the server is there but nobody listens, and a slow timeout suggests a firewall | author |
| Simultaneous open, SYN cookies, TCP Fast Open | not run |



## Lesson 8: TCP resends, waits and cannot keep up (`tcp-reliability`)

| Statement | Source |
|---|---|
| A single lost segment is sent again when the timer runs out, with gaps of 246, 248 and 492 milliseconds | ran: `exercises/08_tcp_reliability.py` and book: TCPIP section 14.3, pages 651 and 655 and section 14.4, page 665 |
| Three duplicate ACKs make the sender resend at once (fast retransmit), repairing in 1 RTT | ran and book: TCPIP section 14.5, pages 667 to 669 |
| SACK says the ranges received after the hole, so only the lost segment is resent | ran and book: TCPIP section 14.6, pages 671 to 676 |
| The Linux kernel sometimes resends once more and answers with a D-SACK | author (seen in some runs, only the part recorded in the lesson was checked) |
| Nagle sends 10 and 40 bytes, NODELAY sends five of 10 bytes | ran and book: TCPIP section 15.4, pages 696 and 700 |
| A header of 66 bytes per segment makes NODELAY spend 330 bytes of headers on 50 bytes of data | calculated from the run ([lesson 1](/en/networking/big-picture/)) |
| The window falls to 0, the sender stops, probes 496 and 964 milliseconds apart, then continues once the window opens | ran and book: TCPIP section 15.5, pages 700 to 711 |
| Delayed ACK, silly window syndrome, RACK, TLP | not run |



## Lesson 9: How TCP learns how fast to send (`tcp-congestion`)

| Statement | Source |
|---|---|
| Congestion collapse, and BDP = speed x round trip, which is 20,000 bytes in the exercise | ran: `exercises/09_tcp_congestion.py` and book: TCPIP section 16.1, pages 728 and 730 |
| Slow start: cwnd begins at 10 and doubles every round trip | ran and book: TCPIP section 16.2, pages 731 to 733 and 738 |
| The first loss makes ssthresh half of cwnd (61 to 33) | ran and book: TCPIP section 16.2, pages 733 to 736 |
| Add 1 per round trip (measured 0.99) and cut by half (AIMD) make a sawtooth that peaks at 33 to 34 segments | ran and book: TCPIP section 16.2, page 735 |
| Throughput 7.66 of 8 Mbit/s | ran |
| The long queue: a big loss (412 against 40), mean round trip 476 against 39 milliseconds, finished at the same 3.13 seconds | ran |
| Bufferbloat happens in equipment with too much buffer | ran (the phenomenon) and book: TCPIP section 16.10, pages 781 to 782 |
| AQM and ECN | book: TCPIP section 16.11, pages 782 to 785 (not run) |
| The right window is near the BDP | book: TCPIP section 16.1, page 730 |
| The 30 KB queue (near the BDP) beats the 600 KB queue on delay | ran and author (an observation, not a rule from the book) |
| CUBIC, BBR and several users competing | not run (book: TCPIP section 16.7, page 768, section 16.8, pages 772 to 777) |



## Lesson 10: What a programmer sees through a socket (`sockets`)

| Statement | Source |
|---|---|
| The socket API: socket, bind, listen, accept, connect, send, recv, close | book: TCPIP section 1.5.3, page 22 |
| Three writes of 5 bytes became one read of 15 bytes, on the wire three segments, and recv(4) gave 4, 4, 4, 3 | ran: `exercises/10_sockets.py` and book: TCPIP section 12.2, pages 585 to 588 |
| The queue of listen: finished handshakes waiting for accept, the kernel answering on the program's behalf | ran and book: TCPIP section 13.7, pages 636 to 637 |
| listen(2) accepts three, the fourth onwards get silence, the SYN is sent again about a second apart, ListenOverflows 10 | ran (the behaviour of the Linux used for the test) |
| The largest backlog is somaxconn, and it does not limit all connections | book: TCPIP section 13.7, pages 636 to 637 |
| The default ephemeral range 32768 to 60999, and EADDRNOTAVAIL when it runs out | ran and book: TCPIP section 1.3.3, page 18 (the idea) |
| Only 2 of the 3 numbers of a small range could be used | ran (the cause was not checked) |
| bind fails after a close because of TIME-WAIT, and SO_REUSEADDR relaxes the rule | ran and book: TCPIP section 13.5, page 620 |
| Nearly every real server sets SO_REUSEADDR, and too low a backlog is a silent cause of trouble | author |
| Non-blocking sockets, select, epoll, Unix domain sockets, Windows and macOS | not run |



## Lesson 11: How TLS makes an ordinary cable safe (`tls`)

| Statement | Source |
|---|---|
| TLS gives encryption and authentication on top of TCP, and anonymous connections are exposed to MITM | book: TCPIP section 18.9.1, page 877 |
| The ClientHello is readable: SNI, versions, an x25519 key share of 32 bytes, 18 cipher suites, record version 0x0301 | ran: `exercises/11_tls.py` and RFC 8446 sections 4.1.2 and 4.2.8 |
| The handshake messages after the ServerHello in TLS 1.3 are all encrypted, and the certificate and request are not seen on the wire | ran and RFC 8446 sections 1.2 and 2 |
| The 410-byte record is the certificate and the two 250-byte records are tickets | author (inferred from the sizes, not decrypted) |
| TLS 1.2 sends the certificate (390 bytes) in plain | ran and book: TCPIP section 18.9.1, pages 881 to 888 |
| TLS 1.3 takes 3 round trips (64 ms), TLS 1.2 takes 4 (84 ms), plain HTTP takes 2 (42 ms) | ran and RFC 8446 section 2 |
| Nagle makes TLS 1.3 take one more round trip (84 ms) when TCP_NODELAY is not set | ran (a review of [lesson 8](/en/networking/tcp-reliability/)) |
| A client checks the chain of signatures, the name in the SAN and the expiry date, with the error message of each case | ran and book: TCPIP section 18.9.1, page 871 and RFC 8446 section 4.4.2 |
| The server name in the ClientHello and the destination IP are still seen on the wire | ran |
| TLS does not protect a server that has been broken into, and a proxy that decrypts sees the data | author |
| Session resumption, 0-RTT, mTLS, CRL and OCSP, ALPN, ECH | not run |



## Lesson 12: HTTP/1.1, HTTP/2 and QUIC (`http`)

| Statement | Source |
|---|---|
| HTTP/1.1 needs several connections when requests are wanted at once | RFC 9113 section 1 |
| Six requests: a new connection every time 857 ms, keep-alive 752 ms, six connections 149 ms, HTTP/2 135 ms | ran: `exercises/12_http.py` (the numbers wobble a little on each run) |
| HTTP/2 frames: a 9-byte header, a 24-byte preface, odd stream numbers for the client, HEADERS, DATA, SETTINGS, WINDOW_UPDATE | ran and RFC 9113 sections 3.4, 4.1, 5 and 6 |
| HPACK makes a repeated request 8 bytes instead of 17 | ran and RFC 9113 section 4.3 |
| HTTP/2 still runs on TCP and does not fix TCP head-of-line blocking | RFC 9113 section 1 (our measurement of this is not cited) |
| QUIC: over UDP, a first datagram of 1200 bytes, Initial version 1, long header then short header, fully encrypted | ran and RFC 9000 sections 14.1 and 17.2 |
| QUIC streams have no ordering between them, and HTTP/3 relies on that | RFC 9000 section 2 and RFC 9114 (not run) |
| QUIC took 3 round trips, the same as TCP + TLS 1.3 (302 against 305 ms), in this run with aioquic 1.3.0 | ran (cause unknown) |
| Theory says QUIC should cost one round trip less | RFC 9000 section 7 (it differs from what we measured) |
| Real HTTP/3, streams blocking each other when a packet is lost, 0-RTT, connection migration, HTTP/2 over TLS | not run |



## Lesson 13: Proxies, Load Balancers and Container Networks (`proxies-and-containers`)

| Statement | Source |
|---|---|
| A container is a namespace + veth + bridge, in ten steps | book: Networking and Kubernetes chapter 3 page 106, and ran: `exercises/13_proxies_containers.py` (a bridge with two ports in the forwarding state, k1 has eth0 10.244.0.2/24 and a default route via 10.244.0.1) |
| Two containers on one bridge talk at layer 2: TTL 64, ARP | ran |
| MASQUERADE: the outside server sees 10.0.2.1 and never 10.244.0.2, and there is a conntrack entry | ran, and book: Networking and Kubernetes chapter 2 page 74 |
| The call to the outside also succeeded before the MASQUERADE rule in the exercise, because the server has a way back | ran (the case of a real network with no way back was not tried) |
| A published port is a DNAT rule: the SYN is 10.0.1.1:8080 on the cable and 10.244.0.2:80 on the bridge, with the same source | ran |
| A connection-level load balancer with iptables: an address with no owner, 8 new connections alternate k1 k2, 8 requests on one connection all go to k1, the backend sees the real client | ran, and book: Networking and Kubernetes chapter 2 pages 74 and 75, chapter 4 page 162 (the book uses random, and the exercise uses nth so that the result is exact) |
| A request-level reverse proxy: alternates backends even on one connection, the backend sees peer 10.244.0.1 and X-Forwarded-For 10.0.1.2 | ran (a proxy written with asyncio for the exercise) |
| A backend dies: layer 4 gets ECONNREFUSED on every second connection, the proxy in the exercise tries the next one and gets all 8 | ran |
| kube-proxy userspace mode runs a web server that terminates connections and proxies them, and iptables mode is connection fan-out | book: Networking and Kubernetes chapter 4 page 162 (not run) |
| Trust X-Forwarded-For only when it comes from our own proxy | author |
| Docker, Kubernetes, CNI, IPVS, overlay across hosts, cloud load balancers, real health checks, a backend that dies silently as a whole computer | not run |



## Lesson 14: When the Network Misbehaves, Where to Look First (`debugging-and-failure`)

| Statement | Source |
|---|---|
| The minimum of ping is 20 ms when the path delays 10 ms each way | ran: `exercises/14_debugging.py` |
| Connect = 1 RTT, Wait = 1 RTT + the server's work, Transfer of 50 KB ≈ 2 RTT (normal 20 / 71 / 40) | ran |
| A slow network lengthens every phase (200 / 251 / 401) and a slow program lengthens only Wait (20 / 321 / 40) | ran |
| Nothing listening and a firewall REJECT (ICMP or RST) give refused at once | ran |
| A firewall DROP gives a timeout of 3.5 s, the SYN reaches the server 4 times at 0.0, 1.0, 2.0, 3.1 s, the client is in SYN-SENT | ran |
| A router with no route gives unreachable at once | ran |
| A cut cable gives a timeout of 3.0 s, the same as DROP from the client's side | ran |
| A lossy link at 40%: every connection succeeds, but sometimes with whole seconds of delay | ran (the numbers change every run) |
| Destination Unreachable has codes such as Host Unreachable and Port Unreachable | book: TCP/IP Illustrated 2nd edition section 8.3.2 page 364 |
| An idle connection carries no packets and the state in a NAT can disappear, keepalive can detect it | book: TCP/IP Illustrated 2nd edition section 17.1 pages 793 and 796 (not run) |
| The order of things to try, have a timeout and keepalive in the program, whole-second times as the fingerprint of a repeated SYN | author |
| The links to Spark, Iceberg and Git | author (no real network was run) |
| Keepalive, a NAT timeout, a DNS outage, a TLS failure, dig, traceroute, curl -w | not run |

