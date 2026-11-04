import { h } from '../dom.js';
import { STATES } from '../states.js';

// Shows the AI answer, or holds it back until the analyst chooses to open it.
export function renderAnswerPanel(data, { onShowAnswer }) {
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
  const note = h('p', { class: 'answer__held' }, 'The answer is held back until you have looked at the sources below.');
  const reveal = h('button', {
    type: 'button', class: 'btn btn--secondary', 'aria-expanded': 'false', 'aria-controls': 'answer-text',
    onclick: () => {
      note.parentElement.remove();
      text.hidden = false;
      panel.className = 'answer answer--revealed';
      text.focus();
      onShowAnswer();
    },
  }, 'Show answer anyway');

  panel.append(h('div', { class: 'answer__held-row' }, note, reveal), text);
  return panel;
}
