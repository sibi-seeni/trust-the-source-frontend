#!/usr/bin/env python3
"""Checks the backend-generated demo files in static/demo/ before a demo.

- index.json lists cases whose files exist
- every case validates against schema/screen_response.schema.json
- each highlight appears exactly in its excerpt text (else the screen shows none)
- the screen copy (status_reason, limits, next_action) follows the wording rules
  and the banner stays under 12 words

Run:  python3 tests/check_demo_json.py      (needs:  pip install jsonschema)
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEMO = ROOT / "static" / "demo"
sys.path.insert(0, str(ROOT / "tests"))

try:
    import jsonschema
except ImportError:
    sys.exit("Needs jsonschema:  pip install jsonschema")

from check_wording import BANNED_RE, MAX_BANNER_WORDS, labels  # noqa: E402

schema = json.loads((ROOT / "schema" / "screen_response.schema.json").read_text(encoding="utf-8"))
problems = []

index = json.loads((DEMO / "index.json").read_text(encoding="utf-8"))
if not index.get("cases"):
    problems.append("index.json lists no cases")
statuses = set()
for case in index.get("cases", []):
    path = DEMO / case["file"]
    if not path.exists():
        problems.append(f"index.json lists {case['file']}, which is missing")
        continue
    data = json.loads(path.read_text(encoding="utf-8"))
    for error in jsonschema.Draft202012Validator(schema).iter_errors(data):
        problems.append(f"{path.name}: {error.json_path}: {error.message}")
    if data.get("status") != case.get("status"):
        problems.append(f"{path.name}: status {data.get('status')} but index.json says {case.get('status')}")
    statuses.add(data.get("status"))
    for e in data.get("excerpts", []):
        if e.get("highlight") and e["highlight"] not in e.get("text", ""):
            problems.append(f"{path.name}: excerpt {e.get('label')} highlight {e['highlight']!r} not in its text")
    for field in ("status_reason", "limits", "next_action"):
        if m := BANNED_RE.search(data.get(field, "")):
            problems.append(f"{path.name}: banned word {m.group(0)!r} in {field}")
    words = len(f"{labels.get(data.get('status'), '')} {data.get('status_reason', '')}".split())
    if words > MAX_BANNER_WORDS:
        problems.append(f"{path.name}: banner is {words} words")

if problems:
    print("Demo file check found problems:")
    print("\n".join(f"  - {p}" for p in problems))
    sys.exit(1)
print(f"Demo files OK ({len(index['cases'])} cases; states: {', '.join(sorted(statuses))}).")
