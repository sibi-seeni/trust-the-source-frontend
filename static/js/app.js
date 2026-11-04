// Thin page layout: fetch one trust layer response, hand it to each component,
// and put each result in its named area. Components never talk to each other.
import { copyText } from './dom.js';
import * as log from './log.js';
import { STATES } from './states.js';
import { renderAnswerPanel } from './components/answerPanel.js';
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
const landingView =document.querySelector('[data-view="landing"]');
const checkView = document.querySelector('[data-view="check"]');
const scenarioSelect = document.getElementById('scenario');
const logCount = document.getElementById('log-count');

// Demo-only entry in the dropdown; it is not a saved backend response.
const LANDING = { id: 'landing', title: 'Landing page (Signet)' };
// Questions typed on the landing page go to this scenario until the harness is connected.
const TYPED_QUESTION_SCENARIO = 'review_needed';

// Shown whenever the backend errors or sends something unreadable. Never all clear.
const UNCHECKED = {
  status: 'check_failed',
  status_reason: STATES.check_failed.defaultReason,
  limits: 'The checks did not respond, so nothing about this answer was checked.',
  next_action: 'Open the sources yourself, or run the check again before relying on the answer.',
};

const handlers = {
  onShowAnswer: () => log.record('show_answer'),
  onOpenSource: (excerpt) => {
    log.record('open_source', { excerpt: excerpt.label });
    openSource(excerpt, { onClose: () => log.record('close_source', { excerpt: excerpt.label }) });
  },
  onToggleSources: (action) => log.record(action),
  onCheckReference: (reference) => {
    log.record('check_reference');
    window.open(reference.url, '_blank', 'noopener');
  },
  onAskOwner: async (message) => {
    const copied = await copyText(message);
    log.record('ask_owner', { copied });
    return copied;
  },
  onReviewed: (choice) => log.record('reviewed', { choice }),
  onFeedback: (helpful, comment) => log.record('feedback', comment ? { helpful, comment } : { helpful }),
  // The question text itself is not logged, in case it contains personal details.
  onAsk: (question, documents) => {
    log.record('ask_question', { documents });
    showScenario(TYPED_QUESTION_SCENARIO, question);
  },
  onDocumentsChanged: (action, detail) => log.record(action, detail),
};

function showLanding() {
  latestRequest += 1; // drop any check still in flight
  checkView.hidden = true;
  landingView.hidden = false;
  landingView.replaceChildren(renderLanding(handlers));
  log.startScreen(null, 'landing');
  log.record('screen_shown', { scenario: LANDING.id });
  document.getElementById('ask-input').focus();
}

// Switch the dropdown and URL, then show that scenario (or the landing page).
function showScenario(scenario, question) {
  scenarioSelect.value = scenario;
  const params = new URLSearchParams(location.search);
  params.set('state', scenario);
  history.replaceState(null, '', `?${params}`);
  if (scenario === LANDING.id) showLanding();
  else loadScenario(scenario, question);
}

function render(data) {
  const parts = {
    header: renderQuestionBar(data),
    answer: renderAnswerPanel(data, handlers),
    status: renderStatusBanner(data),
    evidence: renderEvidence(data, handlers),
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

function normalise(data) {
  if (!data || typeof data !== 'object') throw new Error('response was not a JSON object');
  const excerpts = Array.isArray(data.excerpts) ? data.excerpts : [];
  if (Object.hasOwn(STATES, data.status)) return { ...data, excerpts };
  console.warn(`[trust-layer] unknown status ${JSON.stringify(data.status)}; showing CHECK DID NOT RUN`);
  return { ...data, ...UNCHECKED, excerpts };
}

async function fetchCheck(scenario, question) {
  try {
    const params = new URLSearchParams({ scenario, ...(question && { question }) });
    const response = await fetch(`/api/check?${params}`);
    if (!response.ok) throw new Error(`checks service answered HTTP ${response.status}`);
    return normalise(await response.json());
  } catch (error) {
    console.warn('[trust-layer] showing CHECK DID NOT RUN:', error);
    return { question_id: null, question: '', answer: '', excerpts: [], ...UNCHECKED };
  }
}

let latestRequest = 0;

async function loadScenario(scenario, question) {
  const request = ++latestRequest;
  landingView.hidden = true;
  checkView.hidden = false;
  render({ status: 'loading', question, excerpts: [] });
  const data = await fetchCheck(scenario, question);
  if (request !== latestRequest) return; // a newer switch already replaced this one
  log.startScreen(data.question_id ?? null, data.status);
  render(data);
  log.record('screen_shown', { scenario });
}

async function setUpDemoBar() {
  let scenarios;
  try {
    scenarios = await (await fetch('/api/scenarios')).json();
  } catch {
    scenarios = [{ id: 'review_needed', title: 'Review needed' }];
  }
  scenarios = [LANDING, ...scenarios];
  scenarioSelect.replaceChildren(...scenarios.map(({ id, title }) => new Option(title, id)));

  const requested = new URLSearchParams(location.search).get('state');
  scenarioSelect.value = scenarios.some((s) => s.id === requested) ? requested : LANDING.id;

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
