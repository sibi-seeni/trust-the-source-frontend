// Thin page layout: fetch one trust layer response, hand it to each component,
// and put each result in its named area. Components never talk to each other.
import { copyText } from './dom.js';
import * as log from './log.js';
import { STATES } from './states.js';
import { renderAnswerPanel } from './components/answerPanel.js';
import { renderEvidence } from './components/evidence.js';
import { renderNextAction } from './components/nextAction.js';
import { renderQuestionBar } from './components/questionBar.js';
import { renderReviewControls } from './components/reviewControls.js';
import { openSource } from './components/sourceViewer.js';
import { renderStatusBanner } from './components/statusBanner.js';

const areas = Object.fromEntries(
  [...document.querySelectorAll('[data-area]')].map((el) => [el.dataset.area, el]));
const scenarioSelect = document.getElementById('scenario');
const logCount = document.getElementById('log-count');

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
};

function render(data) {
  const parts = {
    header: renderQuestionBar(data),
    status: renderStatusBanner(data),
    answer: renderAnswerPanel(data, handlers),
    evidence: renderEvidence(data, handlers),
    actions: renderNextAction(data, handlers),
    review: renderReviewControls(data, handlers),
  };
  for (const [name, node] of Object.entries(parts)) {
    areas[name].replaceChildren(...(node ? [node] : []));
    areas[name].hidden = !node;
  }
}

function normalise(data) {
  if (!data || typeof data !== 'object') throw new Error('response was not a JSON object');
  const excerpts = Array.isArray(data.excerpts) ? data.excerpts : [];
  if (Object.hasOwn(STATES, data.status)) return { ...data, excerpts };
  console.warn(`[trust-layer] unknown status ${JSON.stringify(data.status)}; showing CHECK DID NOT RUN`);
  return { ...data, ...UNCHECKED, excerpts };
}

async function fetchCheck(scenario) {
  try {
    const response = await fetch(`/api/check?scenario=${encodeURIComponent(scenario)}`);
    if (!response.ok) throw new Error(`checks service answered HTTP ${response.status}`);
    return normalise(await response.json());
  } catch (error) {
    console.warn('[trust-layer] showing CHECK DID NOT RUN:', error);
    return { question_id: null, question: '', answer: '', excerpts: [], ...UNCHECKED };
  }
}

let latestRequest = 0;

async function loadScenario(scenario) {
  const request = ++latestRequest;
  render({ status: 'loading', excerpts: [] });
  const data = await fetchCheck(scenario);
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
  scenarioSelect.replaceChildren(...scenarios.map(({ id, title }) => new Option(title, id)));

  const params = new URLSearchParams(location.search);
  const requested = params.get('state');
  scenarioSelect.value = scenarios.some((s) => s.id === requested) ? requested : 'review_needed';

  scenarioSelect.addEventListener('change', () => {
    params.set('state', scenarioSelect.value);
    history.replaceState(null, '', `?${params}`);
    loadScenario(scenarioSelect.value);
  });
  document.getElementById('rerun').addEventListener('click', () => loadScenario(scenarioSelect.value));
  document.getElementById('download-log').addEventListener('click', log.download);
  document.getElementById('clear-log').addEventListener('click', () => {
    if (confirm('Clear the demo log in this browser?')) log.clear();
  });

  logCount.textContent = log.count();
  log.onChange((n) => { logCount.textContent = n; });
}

await setUpDemoBar();
loadScenario(scenarioSelect.value);
