// How each backend status is presented. The backend chooses the status;
// this table only says how the screen shows it. Keep these keys stable.

const icon = (paths, extraClass = '') =>
  `<svg class="icon ${extraClass}" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" ` +
  `stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;

const ICONS = {
  spinner: icon('<path d="M12 3a9 9 0 1 0 9 9"/>', 'icon--spin'),
  check: icon('<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.7 2.7L16 9.8"/>'),
  alert: icon('<path d="M12 3.5 2.8 19.5h18.4z"/><path d="M12 10v4.5"/><path d="M12 17.3v.01"/>'),
  clock: icon('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  question: icon('<circle cx="12" cy="12" r="9"/><path d="M9.6 9.5a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .9-1 1.6v.6"/><path d="M12 17v.01"/>'),
  stop: icon('<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>'),
};

// answer:   hidden | held (greyed until opened) | shown
// excerpts: hidden | collapsed (behind "View sources") | shown
export const STATES = {
  loading: {
    label: 'CHECKING SOURCES…', defaultReason: '',
    tone: 'pending', icon: ICONS.spinner, answer: 'hidden', excerpts: 'hidden',
  },
  all_clear: {
    label: 'CHECKED:', defaultReason: 'no conflicts found in the sources used',
    tone: 'clear', icon: ICONS.check, answer: 'shown', excerpts: 'collapsed',
  },
  review_needed: {
    label: 'REVIEW NEEDED:', defaultReason: 'These sources state different values.',
    tone: 'warn', icon: ICONS.alert, answer: 'held', excerpts: 'shown',
  },
  outdated: {
    label: 'NEWER VERSION AVAILABLE:', defaultReason: 'this answer uses an older document.',
    tone: 'notice', icon: ICONS.clock, answer: 'held', excerpts: 'shown',
  },
  not_verified: {
    label: 'NOT VERIFIED:', defaultReason: 'we had nothing to check this source against.',
    tone: 'notice', icon: ICONS.question, answer: 'shown', excerpts: 'shown',
  },
  check_failed: {
    label: 'CHECK DID NOT RUN:', defaultReason: 'treat this answer as unchecked.',
    tone: 'warn', icon: ICONS.stop, answer: 'held', excerpts: 'shown',
  },
};
