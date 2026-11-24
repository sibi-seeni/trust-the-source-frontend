# Trust layer warning screen (sponsor demo)

The screen an analyst sees when the trust layer checks an AI answer: the question, the check status, the answer (held back when needed), the source excerpts behind it, what the check did not establish, and a clear next step.

The frontend only displays what the trust layer returns. It never decides whether an answer is safe. For the demo, a small Python server stands in for the experiment harness and serves saved responses.

## Run the demo (about 2 minutes)

You need Python 3.9 or newer. There's nothing to install and no network or API key is needed during the meeting.

```bash
cd trust-the-source-frontend/static
python3 -m http.server 8000
```

Open <http://localhost:8000>. (`python3 server.py` from the repo root works too.) Don't open `index.html` directly: browsers block loading the JSON from `file://`.

The **Demo case** dropdown is built from `static/demo/index.json`. Each case is a real trust-layer run on DeepSeek V4.1 Flash, generated ahead of time by `make_demo_json.py` in `signet-track-1-cleanup/experiments/b-prototype` (see `WARNING_SCREEN.md` there). The run date and model show next to the dropdown. Link straight to one with `?state=q24_inplace_1`.

**Live mode (stretch).** Start `python live_server.py 8001` in the backend and open <http://localhost:8000/?live=http://localhost:8001>. Each case is then checked when you pick it (about 1 to 3 s). No reply within 20 s shows CHECK DID NOT RUN.

**Backup.** `docs/backup-screenshots/` has a screenshot of every state, in case the laptop or network fails.

## Demo script

Walkthrough (under 10 minutes):

1. **Review needed** (`q24_inplace_1`). The 2025 passage was edited in place ($5,000 → $4,000). Point out the banner ("differs from the 2024 edition"), the held-back answer, excerpt A (current, $4,000) next to excerpt B (2024 edition, $5,000), and that neither card is coloured as the right one. Click **Compare with 2024 edition**, then **Show answer anyway** (deliberately quiet, below the sources).
2. **Newer version available** (`q01_both_editions`). Nothing was edited; the 2024 ($2,700) and 2025 ($2,800) editions were both retrieved. A revision between editions is shown as outdated, never as tampering.
3. **Not verified** (`q01_inplace_1`). The W-2 threshold changes every year, so an edit ($2,800 → $2,240) and a real revision look the same, and we say we couldn't check it. Say this limit out loud. The banner is calm on purpose: about 45% of answers land here.

If the sponsors ask: **Checked** (`q24_clean`) and **Check did not run** (`q24_no_reference`, the 2024 reference file is missing).

Afterwards, **Mark as reviewed** (used A / used B / used neither / escalated) and **Download log** save what was clicked.

## Data from the backend

The screen renders only this object. Its schema is `schema/screen_response.schema.json` (a copy of the backend's `screen_response.schema.json`; keep them the same). `static/js/validate.js` checks every response against it before rendering: a malformed response, an HTTP error or a timeout shows CHECK DID NOT RUN, never a blank screen and never all clear.

```json
{
  "question_id": "q24",
  "case": "inplace_1",
  "question": "According to the 2025 instructions, what amount fills the blank? ...",
  "answer": "According to the 2025 Form 1040 instructions, the penalty ... is $4,000.",
  "status": "review_needed",
  "status_reason": "This value differs from the 2024 edition.",
  "limits": "We found a difference. We have not established which value applies.",
  "next_action": "Open both sources and confirm the value before using it.",
  "excerpts": [
    { "label": "A", "role": "current", "text": "...a penal- ty of $4,000 for filing...", "passage": "(full chunk)",
      "highlight": "$4,000", "doc_title": "Instructions for Form 1040", "doc_version": "2025",
      "locator": "Form 1040 Instructions 2025#840", "source_url": "" },
    { "label": "B", "role": "prior_edition", "text": "...a penal- ty of $5,000 for filing...", "passage": "(full chunk)",
      "highlight": "$5,000", "doc_title": "Instructions for Form 1040", "doc_version": "2024",
      "locator": "Form 1040 Instructions 2024#817", "source_url": "" }
  ],
  "checks_run": ["version_check", "prior_edition_comparison"],
  "checks_failed": [],
  "model": "deepseek/deepseek-v4.1-flash",
  "generated_at": "2026-11-24T16:05:00Z"
}
```

- `status` is one of `all_clear`, `review_needed`, `outdated`, `not_verified`, `check_failed` (`loading` is the screen's own state while waiting).
- `role` is `current`, `older_edition` (a retrieved older passage, outdated state) or `prior_edition` (the 2024 passage we compared against). It's shown in the card footer only, never used to colour a card. **Compare with 2024 edition** opens the `prior_edition` excerpt and is hidden when there is none.
- `highlight` is the value exactly as written in `text`; if it isn't found, the card shows no highlight.
- `limits` and `next_action` come from fixed sentences per status in the backend adapter, not from the model.

### Saved samples (`fixtures/`)

The hand-written responses from the Nov 2 build are still in `fixtures/`, served by `server.py` at `/api/check?scenario=...`, and checked by `tests/check_wording.py`. The screen no longer reads them. `resolve_status()` in `server.py` is still an unwritten TODO; the real backend picks the status itself (`adapter.py`), so the screen doesn't need it.

## Interaction log

Every click writes one entry. Entries go to the browser console, are kept in browser storage, and can be saved with **Download log**. **Clear log** starts over. No names or personal details are collected.

```json
{ "timestamp": "2026-11-02T15:04:05.123Z", "question_id": "q-wage-threshold-2025",
  "state": "review_needed", "action": "open_source", "detail": { "excerpt": "A" }, "ms_since_load": 5120 }
```

Actions: `screen_shown`, `ask_question` (number of documents only; the question text isn't logged), `add_documents`, `remove_document`, `show_answer`, `open_source`, `close_source`, `view_sources`, `hide_sources`, `show_more_sources`, `compare_prior_edition` (was `check_reference`), `copy_for_follow_up` (was `ask_owner`), `reviewed` (choice `used_A`, `used_B`, `used_neither` or `escalated`), and `feedback`. Keep these names stable, because the later review history will be built from them.

## Code layout

```
server.py                  Static server (plus the old simulated backend for fixtures/)
static/demo/               Generated by the backend: index.json + one JSON per case
schema/                    JSON schema of a response (copy of the backend's)
fixtures/                  Hand-written Nov 2 sample responses (no longer shown)
docs/backup-screenshots/   One screenshot per state, for when the laptop or network fails
static/index.html          Page with two zones (answer + status; sources, limits and next action) of named areas
static/css/styles.css      Deck colours, layout, narrow-screen stacking
static/js/app.js           Thin layout: case picker, fetch (static or live), validate, render, logging
static/js/validate.js      Checks a response against the schema before rendering
static/js/states.js        How each status is shown (label, icon, answer and excerpt behaviour)
static/js/log.js           Demo interaction log
static/js/components/      One file per component; none knows about another (landing.js is the Signet start page; limits.js is the limits line)
tests/check_wording.py     Checks copy against the wording rules
tests/check_demo_json.py   Validates static/demo/ against the schema, highlights and wording
```

Each component takes the response object (plus handlers) and returns an element, or `null` to hide its area. **Open source** goes through one hook (`components/sourceViewer.js`), which the workbench can later point at a full source inspector.

## Checks before the demo

```bash
python3 tests/check_wording.py
python3 tests/check_demo_json.py      # needs: pip install jsonschema
```

This fails if any screen text or saved response uses "trusted", "correct", "poisoned", "official", or model jargon, shows a score or percentage, has a banner of 12 or more words, or leaves out a limits or next-action line in a state other than all clear.

Then do a quick manual pass:

- At 1366 × 768, the review needed card fits without scrolling.
- With the window narrower than 720 px, the excerpt cards stack.
- Using only Tab, Enter and Space, you can complete the whole walkthrough, and focus rings are visible.
- With VoiceOver on (Cmd+F5), switching state reads out the banner.
