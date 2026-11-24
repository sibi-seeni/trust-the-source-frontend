// Thin page layout: fetch one trust layer response, hand it to each component,
// and put each result in its named area. Components never talk to each other.
//
// Where responses come from:
//   default          demo/index.json lists the cases; demo/<case>.json holds each response,
//                    generated ahead of time by the backend's make_demo_json.py from a real run.
//   ?live=<url>      POST <url>/check {"question_id", "case"} to the backend's live endpoint,
//                    e.g. ?live=http://localhost:8001. No reply within 20 s shows CHECK DID NOT RUN.
import { copyText } from './dom.js';
import * as log from './log.js';
import { STATES } from './states.js';
import { validateResponse } from './validate.js';
import { renderAnswerPanel, renderRevealControl } from './components/answerPanel.js';
import { renderEvidence } from './components/evidence.js';
import { renderLanding } from './components/landing.js';
import { renderLimits } from './components/limits.js';
import { renderNextAction } from './components/nextAction.js';
import { renderQuestionBar } from './components/questionBar.js';
import { renderReviewControls } from './components/reviewControls.js';
import { openSource } from './components/sourceViewer.js';
import { renderStatusBanner } from './components/statusBanner.js';

const areas = Object.fromEntries(
  [...document.querySelectorAll('[data-area]')].map((el) => [el.dataset.area, el]));
const zones = document.querySelectorAll('.zone');
const landingView = document.querySelector('[data-view="landing"]');
const checkView = document.querySelector('[data-view="check"]');
const scenarioSelect = document.getElementById('scenario');
const sourceNote = document.getElementById('source-note');
const logCount = document.getElementById('log-count');

const LIVE_URL = new URLSearchParams(location.search).get('live');
const LIVE_TIMEOUT_MS = 20000;

// Demo-only entry in the dropdown; it is not a backend response.
const LANDING = { id: 'landing', title: 'Landing page (Signet)' };

// Shown whenever the backend errors or sends something unreadable. Never all clear.
const UNCHECKED = {
  status: 'check_failed',
  status_reason: STATES.check_failed.defaultReason,
  limits: 'The checks did not respond, so nothing about this answer was checked.',
  next_action: 'Open the sources yourself, or run the check again before relying on the answer.',
};

let cases = [];

const handlers = {
  onShowAnswer: () => log.record('show_answer'),
  onOpenSource: (excerpt) => {
    log.record('open_source', { excerpt: excerpt.label });
    openSource(excerpt, { onClose: () => log.record('close_source', { excerpt: excerpt.label }) });
  },
  onToggleSources: (action) => log.record(action),
  onCompareEdition: (excerpt) => {
    log.record('compare_prior_edition', { excerpt: excerpt.label });
    openSource(excerpt, { onClose: () => log.record('close_source', { excerpt: excerpt.label }) });
  },
  onCopyFollowUp: async (message) => {
    const copied = await copyText(message);
    log.record('copy_for_follow_up', { copied });
    return copied;
  },
  onReviewed: (choice) => log.record('reviewed', { choice }),
  onFeedback: (helpful, comment) => log.record('feedback', comment ? { helpful, comment } : { helpful }),
  // The question text itself is not logged, in case it contains personal details.
  onAsk: (question, documents) => {
    const match = findCase(question);
    log.record('ask_question', { documents, matched: Boolean(match) });
    if (match) showScenario(match.id);
    return Boolean(match);
  },
  onDocumentsChanged: (action, detail) => log.record(action, detail),
};

// Only the demo questions are covered (the stability list and 2024 reference cover nothing
// else), so a typed question opens the first case whose question it matches.
function findCase(typed) {
  const words = (s) => new Set(s.toLowerCase().match(/[a-z0-9$,]+/g) ?? []);
  const asked = words(typed);
  let best = null;
  let bestScore = 0;
  for (const c of cases) {
    const target = words(c.question ?? '');
    const shared = [...asked].filter((w) => target.has(w)).length;
    const score = shared / Math.max(asked.size, 1);
    if (score > bestScore) { best = c; bestScore = score; }
  }
  return bestScore >= 0.5 ? best : null;
}

function showLanding() {
  latestRequest += 1; // drop any check still in flight
  checkView.hidden = true;
  landingView.hidden = false;
  landingView.replaceChildren(renderLanding(handlers, cases));
  log.startScreen(null, 'landing');
  log.record('screen_shown', { scenario: LANDING.id });
  document.getElementById('ask-input').focus();
}

// Switch the dropdown and URL, then show that case (or the landing page).
function showScenario(id) {
  scenarioSelect.value = id;
  const params = new URLSearchParams(location.search);
  params.set('state', id);
  history.replaceState(null, '', `?${params}`);
  if (id === LANDING.id) showLanding();
  else loadCase(cases.find((c) => c.id === id));
}

function render(data) {
  const parts = {
    header: renderQuestionBar(data),
    answer: renderAnswerPanel(data),
    status: renderStatusBanner(data),
    evidence: renderEvidence(data, handlers),
    reveal: renderRevealControl(data, handlers),
    limits: renderLimits(data),
    actions: renderNextAction(data, handlers),
    review: renderReviewControls(data, handlers),
  };
  for (const [name, node] of Object.entries(parts)) {
    areas[name].replaceChildren(...(node ? [node] : []));
    areas[name].hidden = !node;
  }
  // A zone with nothing in it disappears, so empty states don't leave gaps or stray labels.
  for (const zone of zones) {
    zone.hidden = [...zone.querySelectorAll('[data-area]')].every((area) => area.hidden);
  }
}

function unchecked(entry, reason, limits) {
  return {
    question_id: entry?.question_id ?? null, question: entry?.question ?? '', answer: '', excerpts: [],
    ...UNCHECKED, ...(reason && { status_reason: reason }), ...(limits && { limits }),
  };
}

async function fetchCheck(entry) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LIVE_TIMEOUT_MS);
  try {
    const response = LIVE_URL
      ? await fetch(`${LIVE_URL.replace(/\/$/, '')}/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question_id: entry.question_id, case: entry.case }),
        signal: controller.signal,
      })
      : await fetch(`demo/${entry.file}`, { signal: controller.signal, cache: 'no-store' });
    if (!response.ok) throw new Error(`checks service answered HTTP ${response.status}`);
    const data = await response.json();
    const problems = validateResponse(data);
    if (problems.length) {
      console.warn('[trust-layer] malformed response, showing CHECK DID NOT RUN:', problems);
      return unchecked(entry, undefined, 'The check sent a result the screen could not read, so treat this answer as unchecked.');
    }
    return data;
  } catch (error) {
    console.warn('[trust-layer] showing CHECK DID NOT RUN:', error);
    if (error.name === 'AbortError') {
      return unchecked(entry, undefined, 'The check did not answer within 20 seconds, so nothing about this answer was checked.');
    }
    return unchecked(entry);
  } finally {
    clearTimeout(timer);
  }
}

let latestRequest = 0;

async function loadCase(entry) {
  const request = ++latestRequest;
  landingView.hidden = true;
  checkView.hidden = false;
  render({ status: 'loading', question: entry?.question ?? '', excerpts: [] });
  const data = entry ? await fetchCheck(entry) : unchecked(null);
  if (request !== latestRequest) return; // a newer switch already replaced this one
  log.startScreen(data.question_id ?? null, data.status);
  render(data);
  log.record('screen_shown', { scenario: entry?.id ?? 'unknown', live: Boolean(LIVE_URL) });
}

async function loadIndex() {
  try {
    const response = await fetch('demo/index.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const index = await response.json();
    if (!Array.isArray(index.cases)) throw new Error('index.json has no cases list');
    // Each case's question, for matching typed questions on the landing page.
    await Promise.all(index.cases.map(async (c) => {
      try {
        c.question = (await (await fetch(`demo/${c.file}`, { cache: 'no-store' })).json()).question;
      } catch { /* matching just skips this case */ }
    }));
    return index;
  } catch (error) {
    console.warn('[trust-layer] could not read demo/index.json:', error);
    return { cases: [] };
  }
}

async function setUpDemoBar() {
  const index = await loadIndex();
  cases = index.cases;
  const options = [LANDING, ...cases];
  scenarioSelect.replaceChildren(...options.map(({ id, title }) => new Option(title, id)));

  sourceNote.textContent = LIVE_URL
    ? `Live: checks run now at ${LIVE_URL}`
    : (index.generated_at ? `Saved run, ${index.generated_at.slice(0, 10)}${index.model ? ` · ${index.model}` : ''}` : 'No demo files found');

  const requested = new URLSearchParams(location.search).get('state');
  scenarioSelect.value = options.some((s) => s.id === requested) ? requested : LANDING.id;

  scenarioSelect.addEventListener('change', () => showScenario(scenarioSelect.value));
  document.getElementById('rerun').addEventListener('click', () => showScenario(scenarioSelect.value));
  document.getElementById('download-log').addEventListener('click', log.download);
  document.getElementById('clear-log').addEventListener('click', () => {
    if (confirm('Clear the demo log in this browser?')) log.clear();
  });

  logCount.textContent = log.count();
  log.onChange((n) => { logCount.textContent = n; });
}

await setUpDemoBar();
showScenario(scenarioSelect.value);
