#!/usr/bin/env python3
"""Checks screen copy against the wording rules in the build instructions.

Scans the saved responses in fixtures/, the simulated backend's default copy and
the frontend source for banned words, numeric scores and over-long banners.

Run:  python3 tests/check_wording.py
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
import server  # noqa: E402  (for DEFAULT_COPY)

BANNED = ["trusted", "correct", "poisoned", "official", "confidence", "rag", "embedding", "metadata"]
BANNED_RE = re.compile(r"\b(" + "|".join(BANNED) + r")\b", re.IGNORECASE)
SCORE_RE = re.compile(r"\d+(\.\d+)?\s*%|\b0\.\d+\b")
LABEL_RE = re.compile(r"label: '([^']*)'.*?defaultReason: '([^']*)'", re.DOTALL)
MAX_BANNER_WORDS = 11  # "under 12 words"
NON_CLEAR = {"review_needed", "outdated", "not_verified", "check_failed"}

problems = []


def strings(value):
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for k, v in value.items():
            if not k.startswith("_") and k not in ("highlight", "source_url"):
                yield from strings(v)
    elif isinstance(value, list):
        for v in value:
            yield from strings(v)


def check_copy(where, text):
    if match := BANNED_RE.search(text):
        problems.append(f"{where}: banned word {match.group(0)!r} in {text!r}")
    if match := SCORE_RE.search(text):
        problems.append(f"{where}: looks like a score {match.group(0)!r} in {text!r}")


def banner_words(label, reason):
    return len(f"{label} {reason}".split())


labels = {}
states_js = (ROOT / "static/js/states.js").read_text(encoding="utf-8")
for block in re.split(r"\n  (?=\w+: \{)", states_js):
    key = block.split(":", 1)[0].strip()
    if m := LABEL_RE.search(block):
        labels[key] = m.group(1)
        check_copy(f"states.js {key}", m.group(1) + " " + m.group(2))
        if banner_words(*m.groups()) > MAX_BANNER_WORDS:
            problems.append(f"states.js {key}: banner over {MAX_BANNER_WORDS} words")

for status, copy in server.DEFAULT_COPY.items():
    for field, text in copy.items():
        check_copy(f"server.py DEFAULT_COPY[{status}].{field}", text)

for path in sorted((ROOT / "fixtures").glob("*.json")):
    fixture = json.loads(path.read_text(encoding="utf-8"))
    for text in strings(fixture):
        check_copy(path.name, text)
    status = fixture.get("status")
    if reason := fixture.get("status_reason"):
        if banner_words(labels.get(status, ""), reason) > MAX_BANNER_WORDS:
            problems.append(f"{path.name}: banner over {MAX_BANNER_WORDS} words")
    if status in NON_CLEAR:
        for field in ("limits", "next_action"):
            if not fixture.get(field):
                problems.append(f"{path.name}: {status} needs a {field} sentence")

for path in sorted((ROOT / "static").rglob("*")):
    if path.suffix in (".js", ".html"):
        for n, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            if match := BANNED_RE.search(line):
                problems.append(f"{path.relative_to(ROOT)}:{n}: banned word {match.group(0)!r}")

if problems:
    print("Wording check found problems:")
    print("\n".join(f"  - {p}" for p in problems))
    sys.exit(1)
print(f"Wording check passed ({len(labels)} states, {len(list((ROOT / 'fixtures').glob('*.json')))} fixtures).")
