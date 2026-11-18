"""Lesson 10: access control and the server-side attacks that reuse the server's own power (path traversal, SSRF, unsafe deserialization, XML).

Asserts that IDOR returns another user's row, that a role check on the page but not on the endpoint leaves an admin action open,
that mass assignment lets a client set its own role, that a path with ../ escapes a folder until the resolved path is compared,
that string blocklists for SSRF are bypassed by other spellings of 127.0.0.1 while a parsed-address check is not, that pickle runs
code from the data, and that Python's XML parser does not follow an external entity. Everything uses fake data and our own code.
"""

import io
import ipaddress
import json
import pickle
import socket
import sys
import tempfile
import xml.etree.ElementTree as ET
from contextlib import redirect_stdout
from pathlib import Path
from urllib.parse import urlparse

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from seclab import check, done, show  # noqa: E402

USERS = {"ann": {"role": "user"}, "bob": {"role": "user"}, "root": {"role": "admin"}}
ORDERS = {101: {"owner": "ann", "total": 170}, 102: {"owner": "bob", "total": 900}}

# ---- 1. broken object level authorization (IDOR) ----
def get_order(order_id: int, who: str, check_owner: bool):
    o = ORDERS[order_id]
    if check_owner and o["owner"] != who and USERS[who]["role"] != "admin":
        raise PermissionError("forbidden")
    return o


check("without an owner check ann can read bob's order just by changing 101 to 102", get_order(102, "ann", False)["owner"] == "bob")
try:
    get_order(102, "ann", True)
    leaked = True
except PermissionError:
    leaked = False
check("with the check, the same request is refused", not leaked)
found = [i for i in range(100, 110) if i in ORDERS]
check("counting up finds every order: ids that are small numbers in a row are easy to walk", found == [101, 102])

# ---- 2. a role check on the button but not on the endpoint ----
def page_buttons(role: str) -> list[str]:
    return ["view orders"] + (["delete user"] if role == "admin" else [])


def delete_user_naive(target: str, who: str):
    USERS_COPY.pop(target)


def delete_user_checked(target: str, who: str):
    if USERS[who]["role"] != "admin":
        raise PermissionError("forbidden")
    USERS_COPY.pop(target)


USERS_COPY = dict(USERS)
check("the user page does not even show the delete button to ann", "delete user" not in page_buttons("user"))
delete_user_naive("bob", "ann")
check("but a request to the endpoint, sent by hand, deletes bob because the endpoint never asked who ann is", "bob" not in USERS_COPY)
USERS_COPY = dict(USERS)
try:
    delete_user_checked("bob", "ann")
    deleted = True
except PermissionError:
    deleted = False
check("a role check inside the endpoint refuses ann", not deleted and "bob" in USERS_COPY)

# ---- 3. mass assignment: the client writes fields it should not ----
def update_profile_naive(user: dict, body: dict):
    user.update(body)


def update_profile_safe(user: dict, body: dict):
    for k in ("display_name", "email"):  # an allow list of fields the client may set
        if k in body:
            user[k] = body[k]


ann = {"role": "user", "display_name": "Ann"}
update_profile_naive(ann, json.loads('{"display_name": "Ann", "role": "admin"}'))
check("a JSON body with an extra role field makes ann an admin", ann["role"] == "admin")
ann = {"role": "user", "display_name": "Ann"}
update_profile_safe(ann, json.loads('{"display_name": "Ann B", "role": "admin"}'))
check("copying only the allowed fields ignores role", ann == {"role": "user", "display_name": "Ann B"})

# ---- 4. path traversal ----
base = Path(tempfile.mkdtemp(prefix="appsec-files-"))
(base / "public").mkdir()
(base / "public" / "hello.txt").write_text("hello")
(base / "secret.txt").write_text("TOP SECRET")


def read_naive(name: str) -> str:
    return (base / "public" / name).read_text()


def read_safe(name: str) -> str:
    target = (base / "public" / name).resolve()
    if not target.is_relative_to((base / "public").resolve()):
        raise PermissionError("outside the folder")
    return target.read_text()


check("a normal name reads the public file", read_naive("hello.txt") == "hello")
check("../secret.txt walks out of the public folder", read_naive("../secret.txt") == "TOP SECRET")
try:
    read_safe("../secret.txt")
    out = True
except PermissionError:
    out = False
check("comparing the resolved path with the folder refuses it", not out)
check("the safe version still serves the normal file", read_safe("hello.txt") == "hello")

# ---- 5. SSRF: the server fetches a URL the user gave ----
BLOCK = ("127.0.0.1", "localhost")


def naive_check(url: str) -> bool:
    host = urlparse(url).hostname or ""
    return host not in BLOCK


def resolved_ip(host: str) -> ipaddress._BaseAddress:
    try:
        return ipaddress.ip_address(host)
    except ValueError:
        pass
    try:
        return ipaddress.ip_address(socket.inet_ntoa(socket.inet_aton(host)))  # accepts 127.1, 2130706433, 0x7f000001 like a real client
    except OSError:
        return ipaddress.ip_address(socket.getaddrinfo(host, None)[0][4][0])  # a name: ask the resolver, as the real fetch would


def parsed_check(url: str) -> bool:
    ip = resolved_ip(urlparse(url).hostname or "")
    return not (ip.is_loopback or ip.is_private or ip.is_link_local or ip.is_reserved)


spellings = ["http://127.0.0.1/admin", "http://localhost/admin", "http://127.1/admin", "http://2130706433/admin", "http://0x7f000001/admin", "http://[::1]/admin", "http://169.254.169.254/latest/meta-data/"]
show("naive blocklist says allowed?", {u: naive_check(u) for u in spellings})
passed = [u for u in spellings if naive_check(u)]
check("the string blocklist stops only the two names it knows (2 of 7)", len(spellings) - len(passed) == 2)
check("the other five spellings reach the same machine anyway", len(passed) == 5)
check("checking the parsed address blocks all seven", not any(parsed_check(u) for u in spellings))
check("a public address passes the parsed check", parsed_check("http://93.184.216.34/"))
check("169.254.169.254, the cloud metadata address, is link local and blocked by the parsed check", ipaddress.ip_address("169.254.169.254").is_link_local)

# ---- 6. deserialization: the data decides what runs ----
class Boom:
    def __reduce__(self):
        return (print, ("code from the pickle ran",))


blob = pickle.dumps(Boom())
buf = io.StringIO()
with redirect_stdout(buf):
    pickle.loads(blob)
check("loading a pickle runs a function chosen by whoever made the bytes", buf.getvalue().strip() == "code from the pickle ran")
check("the same idea as JSON is only data, and json.loads cannot call anything", json.loads('{"a": [1, 2]}') == {"a": [1, 2]})

# ---- 7. XML external entity ----
xxe = f'<?xml version="1.0"?><!DOCTYPE d [<!ENTITY x SYSTEM "file:///{(base / "secret.txt").as_posix()}">]><d>&x;</d>'
try:
    root = ET.fromstring(xxe)
    text = root.text or ""
    result = "parsed"
except ET.ParseError as exc:
    text, result = "", f"ParseError: {exc}"
show("XML with an external entity that points at our secret file", result)
check("Python's parser did not put the contents of the file into the document", "TOP SECRET" not in text)
if "--write" in sys.argv:
    import json as _json

    ROOT = Path(__file__).resolve().parents[4]
    OUT = ROOT / "site" / "src" / "components" / "labs" / "app-security" / "access.json"
    idor = []
    for i in range(100, 105):
        row = {"id": i, "exists": i in ORDERS}
        for check_owner in (False, True):
            try:
                o = get_order(i, "ann", check_owner) if i in ORDERS else None
                row["checked" if check_owner else "open"] = o
            except PermissionError:
                row["checked" if check_owner else "open"] = "forbidden"
        idor.append(row)
    ssrf = [{"url": u, "naive": naive_check(u), "parsed": parsed_check(u), "ip": str(resolved_ip(urlparse(u).hostname or ""))} for u in spellings]
    paths = [{"name": n, "naive": (read_naive(n) if (base / "public" / n).resolve().exists() else None), "safe": None} for n in ("hello.txt", "../secret.txt")]
    for r in paths:
        try:
            r["safe"] = read_safe(r["name"])
        except PermissionError:
            r["safe"] = "refused"
    OUT.write_text(_json.dumps({"idor": idor, "ssrf": ssrf, "paths": paths}, indent=1), encoding="utf-8")
    print(f"wrote {OUT}")
done()
