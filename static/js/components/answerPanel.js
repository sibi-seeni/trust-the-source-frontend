import { h } from '../dom.js';
import { STATES } from '../states.js';

// Shows the AI answer, or holds it back until the analyst has looked at the sources.
export function renderAnswerPanel(data) {
  const mode = STATES[data.status].answer;
  if (mode === 'hidden') return null;

  const heading = h('h2', { class: 'answer__heading', id: 'answer-heading' }, 'Answer');
  const text = h('p', { class: 'answer__text', id: 'answer-text', tabindex: '-1' },
    data.answer || 'No answer was returned with this result.');
  const panel = h('section', { class: `answer answer--${mode}`, 'aria-labelledby': 'answer-heading' }, heading);

  if (mode === 'shown' || !data.answer) {
    panel.append(text);
    return panel;
  }

  text.hidden = true;
  panel.append(
    h('p', { class: 'answer__held', id: 'answer-held' }, 'The answer is held back until you have looked at the sources below.'),
    text);
  return panel;
}

// "Show answer anyway" sits below the excerpts, in a quiet style, so the sources come
// first (users click straight past warnings that offer the answer up front).
export function renderRevealControl(data, { onShowAnswer }) {
  if (STATES[data.status].answer !== 'held' || !data.answer) return null;
  const button = h('button', {
    type: 'button', class: 'btn btn--quiet', 'aria-expanded': 'false', 'aria-controls': 'answer-text',
    onclick: () => {
      const text = document.getElementById('answer-text');
      document.getElementById('answer-held')?.remove();
      text.hidden = false;
      text.closest('.answer').className = 'answer answer--revealed';
      button.parentElement.remove();
      text.focus();
      onShowAnswer();
    },
  }, 'Show answer anyway');
  return h('div', { class: 'reveal' }, button);
}
