# Networking: sources

The books are kept outside the repo (`E:\books\Networking & Security\...` and `E:\books\DevOps & Cloud\...`). A citation in a lesson gives the section or chapter number and the **printed** page where
the section starts, for example `TCPIP หัวข้อ 13.7 หน้า 636`, never the section sign or "ch.".

## Books that are cited

| Short name | Book | Printed page = PDF page minus | Checked on |
|---|---|---|---|
| TCPIP | TCP/IP Illustrated, Volume 1, 2nd edition (Fall and Stevens) | 39 | PDF 48 = page 9, 51 = 12, 56 = 17; the text of the PDF is only readable with PyMuPDF (`pdftotext` shifts capital letters) |
| NK | Networking and Kubernetes: A Layered Approach (Strong and Lancey) | 14 | PDF 120 = page 106 (Setting Up Namespaces), 176 = page 162 (kube-proxy modes), 88 = page 74 (iptables load balancing), checked on those pages only |

Pages cited by the lessons: TCPIP 1.3.3 p18, 1.5.3 p22, 8.3.2 p364, 13.5 p620, 13.7 p636 to 637, 17.1 p793 and p796 (and the pages of lessons 1 to 9 listed in `verified-findings.md`); NK chapter 2 pages 74 and 75,
chapter 3 page 106 and chapter 4 page 162.

## Books that are cited a little

| Short name | Book | Printed page = PDF page minus | Checked on |
|---|---|---|---|
| AIO | Networking All-in-One For Dummies (Lowe), Book 2 chapter 1 | 29 | PDF 108 = page 79, 109 = 80, 110 = 81, 117 = 88, 118 = 89; the text was read with PyMuPDF |

Cited only by lesson 1, for the seven OSI layers (page 80), Table 1-1 with the switch as a layer 2 device and the remark that real protocols do not follow OSI to the letter (page 81), and the Presentation layer (pages 88 to 89).

## Books that are not cited

The owner also has TCP/IP Illustrated Volume 1 1st edition and Network Warrior. The first was converted to text and searched while planning the order of topics, Network Warrior was not opened. **No claim of any lesson cites these two**: where the 2nd edition of TCP/IP Illustrated or Networking and Kubernetes covered a topic they were used instead, and Network Warrior
is about configuring Cisco devices, which the subject leaves out on purpose (see `overview.md`). The owner asked to use every book by topic, so this is a gap, and a later pass could add Network Warrior to a
lesson on switches and VLANs.

## RFCs (read, not run)

The RFC text was opened, and section numbers were checked against it. HTTP/2, HTTP/3, QUIC and TLS 1.3 are not in the books above.

| RFC | Used for |
|---|---|
| 8446 | TLS 1.3 handshake and message order (lesson 11) |
| 9113 | HTTP/2: framing, streams, HPACK (lesson 12) |
| 9000 | QUIC: streams, handshake, Initial packet size (lesson 12) |
| 9114 | HTTP/3, named only (lesson 12, not run) |

## Source checkouts

None. No source tree was read: every "source" claim of the subject is a book or an RFC, and everything else was run.

## Software that the exercises ran on

Ubuntu 22.04 in WSL2 (kernel 6.18), Python 3.10 on the Linux side, iproute2 5.15, iptables 1.8.7 (nf_tables), tcpdump 4.99.1, OpenSSL 3.0.2, `dhclient` for lesson 5; exercise 12 needs the libraries `h2` 4.4.1 and
`aioquic` 1.3.0 in `code/vendor/` (ignored by git, see the head of `exercises/12_http.py`). Packets are parsed with `struct` in `wire.py`, no scapy.
