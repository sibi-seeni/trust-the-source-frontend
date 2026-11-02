// Interaction log for the sponsor demo. Entries go to the console and to
// browser storage, and can be downloaded as JSON. No names or personal data.
// Field names are stable: the workbench review history will read these entries.

const STORAGE_KEY = 'trust-layer-demo-log';

let entries = loadStored();
let screen = { questionId: null, state: null, shownAt: performance.now() };
const listeners = new Set();

function loadStored() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Storage blocked (private window etc.): the console copy still has every entry.
  }
  listeners.forEach((fn) => fn(entries.length));
}

// Call when a new result is put on screen; resets the "time since load" clock.
export function startScreen(questionId, state) {
  screen = { questionId, state, shownAt: performance.now() };
}

export function record(action, detail) {
  const entry = {
    timestamp: new Date().toISOString(),
    question_id: screen.questionId,
    state: screen.state,
    action,
    ...(detail !== undefined && { detail }),
    ms_since_load: Math.round(performance.now() - screen.shownAt),
  };
  entries.push(entry);
  console.info('[demo-log]', entry);
  persist();
  return entry;
}

export function count() {
  return entries.length;
}

export function onChange(fn) {
  listeners.add(fn);
}

export function download() {
  const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `trust-layer-demo-log-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function clear() {
  entries = [];
  persist();
}
