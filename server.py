#!/usr/bin/env python3
"""Demo server for the trust layer warning screen.

Serves the static frontend from static/ and a simulated trust layer backend:

    GET /api/scenarios          list of saved demo responses (for the demo toolbar)
    GET /api/check?scenario=X   the trust layer response for one saved scenario

The simulated backend stands in for the experiment harness. When a saved
scenario lists several check outcomes, the server (not the frontend) decides
which status the screen shows. Swap handle_check() for a call to the real
harness later; the frontend only depends on the response shape.

Standard library only. Run:  python3 server.py [port]
"""
import json
import sys
import time
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parent
STATIC_DIR = ROOT / "static"
FIXTURES_DIR = ROOT / "fixtures"

# Pretend the checks take a moment, so the loading state is visible on every switch.
CHECK_DELAY_S = 0.8

# Every status the frontend understands, most serious first.
SEVERITY = ["check_failed", "review_needed", "outdated", "not_verified", "all_clear"]

# Copy the simulated backend fills in when a scenario leaves it out.
DEFAULT_COPY = {
    "check_failed": {
        "status_reason": "treat this answer as unchecked.",
        "limits": "At least one check did not finish, so this answer was not fully checked.",
        "next_action": "Open the sources yourself, or run the check again before relying on the answer.",
    },
    "review_needed": {
        "status_reason": "These sources state different values.",
        "limits": "We found disagreement. We have not established which value applies.",
        "next_action": "Open both sources, check an independent reference or ask the document owner.",
    },
    "outdated": {
        "status_reason": "this answer uses an older document.",
        "limits": "We found a newer version. We have not checked whether the older value still applies.",
        "next_action": "Open the newer document and confirm the value before you use this answer.",
    },
    "not_verified": {
        "status_reason": "we had nothing to check this source against.",
        "limits": "We had only this one source, so we could not compare it with anything.",
        "next_action": "Open the source and compare it with an independent reference before relying on it.",
    },
    "all_clear": {
        "status_reason": "no conflicts found in the sources used",
        "limits": "We compared the sources used for this answer. We did not check documents outside the library.",
        "next_action": "Use the answer as usual, or open the sources to read the passages.",
    },
}


def resolve_status(outcomes):
    """Pick the one status the screen shows when several checks report.

    outcomes: list of status strings, one per check, for example
              ["outdated", "review_needed"]. A check that errored or timed out
              reports "check_failed".
    Returns one value from SEVERITY.
    """
    # TODO(human)
    raise NotImplementedError("resolve_status is not written yet")


def build_response(fixture):
    """Turn a saved scenario into the response the frontend renders."""
    response = {k: v for k, v in fixture.items() if not k.startswith("_")}

    outcomes_by_check = fixture.get("_check_outcomes")
    if outcomes_by_check is not None:
        outcomes = list(outcomes_by_check.values())
        failed = response.get("checks_failed", [])
        outcomes += ["check_failed"] * len(failed)
        response["status"] = resolve_status(outcomes)
        response["checks_run"] = [c for c in outcomes_by_check if c not in failed]

    status = response.get("status")
    if status != "loading" and status not in SEVERITY:
        raise ValueError(f"unknown status {status!r}")
    for field, text in DEFAULT_COPY.get(status, {}).items():
        response.setdefault(field, text)
    return response


def failed_response(fixture, error):
    """A check_failed response that keeps whatever was retrieved. Never all clear."""
    print(f"  ! check could not be completed: {error}", file=sys.stderr)
    response = {
        "question_id": fixture.get("question_id"),
        "question": fixture.get("question", ""),
        "answer": fixture.get("answer", ""),
        "status": "check_failed",
        "excerpts": fixture.get("excerpts", []),
        "checks_run": [],
        "checks_failed": ["simulated_backend"],
    }
    response.update(DEFAULT_COPY["check_failed"])
    return response


def load_scenarios():
    scenarios = {}
    for path in FIXTURES_DIR.glob("*.json"):
        scenarios[path.stem] = json.loads(path.read_text(encoding="utf-8"))
    return scenarios


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(STATIC_DIR), **kwargs)

    def end_headers(self):
        # The demo edits fixtures live; never serve a stale copy.
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        url = urlparse(self.path)
        if url.path == "/api/scenarios":
            return self.handle_scenarios()
        if url.path == "/api/check":
            return self.handle_check(parse_qs(url.query))
        return super().do_GET()

    def handle_scenarios(self):
        scenarios = load_scenarios()
        listing = [
            {"id": name, "title": f.get("_title", name), "order": f.get("_order", 99)}
            for name, f in scenarios.items()
        ]
        listing.sort(key=lambda s: (s["order"], s["id"]))
        self.send_json(listing)

    def handle_check(self, query):
        name = (query.get("scenario") or ["review_needed"])[0]
        scenarios = load_scenarios()
        if name not in scenarios:
            return self.send_json({"error": f"unknown scenario {name!r}"}, HTTPStatus.NOT_FOUND)

        fixture = scenarios[name]
        if fixture.get("_simulate") == "http_500":
            return self.send_json({"error": "The checks service did not respond."},
                                  HTTPStatus.INTERNAL_SERVER_ERROR)

        if fixture.get("status") != "loading":
            time.sleep(CHECK_DELAY_S)
        try:
            body = build_response(fixture)
        except Exception as error:  # any backend fault becomes a visible failed check
            body = failed_response(fixture, error)
        self.send_json(body)

    def send_json(self, body, status=HTTPStatus.OK):
        data = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    try:
        server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    except OSError:
        sys.exit(f"Port {port} is already in use. Stop the other server, "
                 f"or pick another port: python3 server.py {port + 1}")
    print(f"Trust layer demo running at http://localhost:{port}  (Ctrl+C to stop)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
