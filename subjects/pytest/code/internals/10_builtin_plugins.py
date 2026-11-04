"""Lesson builtin-plugins: capture, logging, warnings, the cache, JUnit XML and subtests, each checked against a real run."""

import json
import xml.etree.ElementTree as ET

from _lab import project, run_sub

CAPTURE = {
    "test_cap.py": """
        import os
        import sys

        def test_print_and_fail():
            print("hello from print")
            print("to stderr", file=sys.stderr)
            assert False

        def test_print_and_pass():
            print("never shown unless -s or the test fails")

        def test_capsys(capsys):
            print("captured by capsys")
            sys.stderr.write("err\\n")
            out, err = capsys.readouterr()
            assert out == "captured by capsys\\n" and err == "err\\n"

        def test_capfd_sees_a_write_to_the_file_descriptor(capfd):
            os.write(1, b"from the file descriptor\\n")
            out, _ = capfd.readouterr()
            assert out == "from the file descriptor\\n"

        def test_capsys_does_not_see_the_file_descriptor(capsys):
            os.write(1, b"fd write\\n")
            out, _ = capsys.readouterr()
            assert out == ""
    """,
}

LOGGING = {
    "test_log.py": """
        import logging

        log = logging.getLogger("shop")

        def test_logs_and_fails():
            log.info("this is info")
            log.warning("this is a warning")
            assert False

        def test_caplog(caplog):
            with caplog.at_level(logging.INFO, logger="shop"):
                log.info("hello %s", "world")
            assert caplog.messages == ["hello world"]
            assert caplog.records[0].levelname == "INFO"
            caplog.clear()
            assert caplog.records == []
    """,
}

WARN = {
    "test_warn.py": """
        import warnings
        import pytest

        def noisy():
            warnings.warn("old api", DeprecationWarning, stacklevel=2)

        def test_warns_once():
            noisy()

        @pytest.mark.filterwarnings("error")
        def test_the_mark_turns_it_into_an_error():
            noisy()

        @pytest.mark.filterwarnings("ignore::DeprecationWarning")
        def test_the_mark_hides_it():
            noisy()
    """,
}

CACHE = {
    "test_cache.py": """
        def test_a(): ...
        def test_b():
            assert False
        def test_c(): ...
    """,
}

SUBTESTS = {
    "test_sub.py": """
        def test_each_row(subtests):
            for n in range(4):
                with subtests.test(msg="row", n=n):
                    assert n != 2
    """,
}

if __name__ == "__main__":
    with project(CAPTURE) as root:
        _, out = run_sub(root, "-q")
        _, out_s = run_sub(root, "-q", "-s", "test_cap.py::test_print_and_pass")
        _, out_none = run_sub(root, "-q", "--capture=no", "test_cap.py::test_print_and_pass")
    print("--- capture ---")
    assert "Captured stdout call" in out and "hello from print" in out
    assert "Captured stderr call" in out and "to stderr" in out
    assert "never shown" not in out
    assert "never shown" in out_s and "never shown" in out_none
    assert "3 passed, 1 failed" in out or "4 passed, 1 failed" in out or "1 failed, 4 passed" in out, out.splitlines()[-1]
    print(out.splitlines()[-1])

    with project(LOGGING) as root:
        _, out = run_sub(root, "-q")
        _, out_lvl = run_sub(root, "-q", "--log-level=WARNING")
        _, out_cli = run_sub(root, "-q", "-o", "log_cli=true", "-o", "log_cli_level=INFO", "test_log.py::test_logs_and_fails")
    print("--- logging ---")
    # the root logger's default level is WARNING, so INFO is dropped unless a level is set
    assert "Captured log call" in out and "WARNING  shop:test_log.py:7 this is a warning" in out and "INFO     shop" not in out
    assert "WARNING  shop:test_log.py" in out
    assert "INFO     shop:test_log.py:6 this is info" in out_cli and "live log call" in out_cli

    with project(WARN) as root:
        _, out = run_sub(root, "-q")
        _, out_err = run_sub(root, "-q", "-W", "error::DeprecationWarning")
        _, out_ini = run_sub(root, "-q", "-o", "filterwarnings=ignore::DeprecationWarning")
    print("--- warnings ---")
    assert "warnings summary" in out and "DeprecationWarning: old api" in out
    assert "1 failed" in out  # the mark turned it into an error in one test
    assert "warnings summary" not in out_ini

    with project(CACHE) as root:
        run_sub(root, "-q")
        cache = root / ".pytest_cache"
        files = sorted(str(p.relative_to(cache)).replace("\\", "/") for p in cache.rglob("*") if p.is_file())
        lastfailed = json.loads((cache / "v" / "cache" / "lastfailed").read_text())
        _, lf = run_sub(root, "-q", "--lf")
        _, ff = run_sub(root, "--ff", "-v")
        _, sw = run_sub(root, "-q", "--sw")
        _, nf = run_sub(root, "-q", "--nf")
        _, show = run_sub(root, "--cache-show")
    print("--- cache ---")
    print(files, lastfailed)
    assert lastfailed == {"test_cache.py::test_b": True}
    assert {"v/cache/lastfailed", "v/cache/nodeids", "CACHEDIR.TAG", ".gitignore", "README.md"} <= set(files)
    assert lf.strip().splitlines()[-1].startswith("1 failed in") and "passed" not in lf.strip().splitlines()[-1]
    order = [l.split()[0] for l in ff.splitlines() if l.startswith("test_cache.py::")]
    assert order == ["test_cache.py::test_b", "test_cache.py::test_a", "test_cache.py::test_c"], order
    assert "Interrupted: Test failed, continuing from this test next run." in sw and sw.strip().splitlines()[-1].startswith("1 failed, 1 passed")
    assert "cachedir:" in show

    with project(CAPTURE | WARN) as root:
        xml = root / "report.xml"
        run_sub(root, "-q", f"--junitxml={xml}")
        tree = ET.parse(xml)
        suite = tree.getroot().find("testsuite")
        print("--- junitxml ---")
        print(dict(suite.attrib))
        assert suite.get("tests") == "8" and suite.get("failures") == "2" and suite.get("errors") == "0"
        failing = [c for c in suite.findall("testcase") if c.find("failure") is not None]
        assert {c.get("name") for c in failing} == {"test_print_and_fail", "test_the_mark_turns_it_into_an_error"}
        assert failing[0].get("classname") in ("test_cap", "test_warn")

    with project(SUBTESTS) as root:
        code, out = run_sub(root, "-q")
        _, out_v = run_sub(root, "-q", "-vv")
    print("--- subtests ---")
    print(out.splitlines()[-1])
    assert code == 1
    assert "SUBFAILED[row] (n=2) test_sub.py::test_each_row" in out
    assert "FAILED test_sub.py::test_each_row - contains 1 failed subtest" in out
    assert out.strip().splitlines()[-1].startswith("2 failed, 3 subtests passed")
    assert out.splitlines()[0].startswith("uuuuF")  # u = a passed subtest, F = the failed test itself
    print("ok")
