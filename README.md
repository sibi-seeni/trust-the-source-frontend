# Trust layer warning screen (sponsor demo)

The screen an analyst sees when the trust layer checks an AI answer: the question, the check status, the answer (held back when needed), the source excerpts behind it, what the check did not establish, and a clear next step.

The frontend only displays what the trust layer returns. It never decides whether an answer is safe. For the demo, a small Python server stands in for the experiment harness and serves saved responses.

## Run the demo (about 2 minutes)

You need Python 3.9 or newer. There's nothing to install.

```bash
cd trust-the-source-frontend
python3 server.py
```

Open <http://localhost:8000>. To use another port, run `python3 server.py 8080`.

Use the **Demo state** dropdown at the top to switch between saved responses. You can also link straight to one, for example <http://localhost:8000/?state=outdated>.

## Demo script

0. **Landing page** (opens by default). It shows Signet, the question box and the document area. Drag in a document or two; they're listed but stay in the browser. Type any question and press Enter. Until the harness is connected, every typed question goes to the review needed result, with your question in the question bar.
1. **Review needed** (the slide 8 walkthrough). Point out the banner, the held-back answer, excerpts A and B with $2,800 and $2,240 highlighted, the limits line and the next action.
2. Click **Open source** on excerpt A. No document link is set, so the full passage opens in a dialog.
3. Click **Ask document owner**. A message with the question and both excerpts is copied to the clipboard.
4. Click **Show answer anyway**. The answer appears and the banner stays.
5. Pick **Used excerpt A**, click **Mark as reviewed**, then answer **Was this warning helpful?**
6. Switch to **All clear**, **Newer version available**, **Could not verify**, **Check did not run** and **Backend error** to show the other states.
7. Afterwards, click **Download log** to save everything the sponsors clicked as a JSON file.

## Saved responses (`fixtures/`)

| File | Shows |
| --- | --- |
| `review_needed.json` | Slide 8: two sources disagree ($2,800 vs $2,240) |
| `all_clear.json` | No conflicts found; sources behind "View sources" |
| `outdated.json` | Old and current documents side by side, with version and date |
| `not_verified.json` | One source, nothing to compare it against |
| `check_failed.json` | A check timed out; the answer is treated as unchecked |
| `multi_check.json` | Two checks fire; the backend picks the most serious state; three sources ("Show 1 more source") |
| `loading.json` | Checks still running |
| `backend_error.json` | The server returns HTTP 500; the screen shows CHECK DID NOT RUN |

To add a scenario, drop a new `.json` file in `fixtures/`. `_title` sets the dropdown label and `_order` sets its position. Keys starting with `_` are for the simulated backend only and never reach the screen.

## Response shape

The frontend renders only from this object, which is the shape proposed in the build instructions:

```json
{
  "question_id": "q-wage-threshold-2025",
  "question": "What is the wage threshold in the 2025 instructions?",
  "answer": "The threshold is $2,240.",
  "status": "review_needed",
  "status_reason": "These sources state different values.",
  "limits": "We found disagreement. We have not established which value applies.",
  "next_action": "Open both sources, check an independent reference or ask the document owner.",
  "excerpts": [
    { "label": "A", "text": "Wages of less than $2,800", "highlight": "$2,800",
      "doc_title": "2025 Instructions", "doc_version": "2025", "page": 3, "source_url": "" }
  ],
  "checks_run": ["version_check", "content_comparison"],
  "checks_failed": []
}
```

- `status` is one of `loading`, `all_clear`, `review_needed`, `outdated`, `not_verified`, `check_failed`. An unknown value, an HTTP error or unreadable JSON is shown as `check_failed`. It never falls back to all clear.
- `highlight` must be an exact substring of `text`. If it isn't, the excerpt is shown without a highlight.
- Fields added for the demo, all optional: `question_id` (used in the log), `doc_date` (shown in the footer, used for the outdated state), `passage` (a longer passage for the full-passage dialog), and `reference: { "title", "url" }` (turns on **Check a reference**).

### When several checks fire

The backend decides the state. In the simulated backend, a fixture can list `_check_outcomes` (one status per check) instead of a single `status`. `resolve_status()` in `server.py` then picks one using this order: check failed, then review needed, then outdated, then could not verify. When the real harness is connected, it sends `status` directly and that function goes away.

## Interaction log

Every click writes one entry. Entries go to the browser console, are kept in browser storage, and can be saved with **Download log**. **Clear log** starts over. No names or personal details are collected.

```json
{ "timestamp": "2026-11-02T15:04:05.123Z", "question_id": "q-wage-threshold-2025",
  "state": "review_needed", "action": "open_source", "detail": { "excerpt": "A" }, "ms_since_load": 5120 }
```

Actions: `screen_shown`, `ask_question` (number of documents only; the question text isn't logged), `add_documents`, `remove_document`, `show_answer`, `open_source`, `close_source`, `view_sources`, `hide_sources`, `show_more_sources`, `check_reference`, `ask_owner`, `reviewed` (choice `used_A`, `used_B`, `used_neither` or `escalated`), and `feedback`. Keep these names stable, because the later review history will be built from them.

## Code layout

```
server.py                  Static server and simulated trust layer backend
fixtures/                  Saved responses, one per scenario
static/index.html          Page with two zones (answer + status; sources, limits and next action) of named areas
static/css/styles.css      Deck colours, layout, narrow-screen stacking
static/js/app.js           Thin layout: fetch, hand the response to each component, logging
static/js/states.js        How each status is shown (label, icon, answer and excerpt behaviour)
static/js/log.js           Demo interaction log
static/js/components/      One file per component; none knows about another (landing.js is the Signet start page; limits.js is the limits line)
tests/check_wording.py     Checks copy against the wording rules
```

Each component takes the response object (plus handlers) and returns an element, or `null` to hide its area. **Open source** goes through one hook (`components/sourceViewer.js`), which the workbench can later point at a full source inspector.

## Checks before the demo

```bash
python3 tests/check_wording.py
```

This fails if any screen text or saved response uses "trusted", "correct", "poisoned", "official", or model jargon, shows a score or percentage, has a banner of 12 or more words, or leaves out a limits or next-action line in a state other than all clear.

Then do a quick manual pass:

- At 1366 × 768, the review needed card fits without scrolling.
- With the window narrower than 720 px, the excerpt cards stack.
- Using only Tab, Enter and Space, you can complete the whole walkthrough, and focus rings are visible.
- With VoiceOver on (Cmd+F5), switching state reads out the banner.
