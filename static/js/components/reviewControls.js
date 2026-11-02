import { h } from '../dom.js';

// "Mark as reviewed" and, once reviewed, "Was this warning helpful?".
export function renderReviewControls(data, { onReviewed, onFeedback }) {
  if (data.status === 'loading') return null;

  const choices = [
    ...data.excerpts.map((excerpt) => [`used_${excerpt.label}`, `Used excerpt ${excerpt.label}`]),
    ['used_neither', 'Used neither'],
    ['escalated', 'Escalated'],
  ];
  const section = h('div', { class: 'review' });
  const error = h('span', { class: 'field-error', 'aria-live': 'polite' });

  const form = h('form', {
    class: 'review__form',
    onsubmit: (event) => {
      event.preventDefault();
      const choice = new FormData(form).get('review-choice');
      if (!choice) {
        error.textContent = 'Pick one option first.';
        return;
      }
      onReviewed(choice);
      const [, text] = choices.find(([value]) => value === choice);
      const done = h('p', { class: 'review__done', tabindex: '-1' }, h('strong', {}, 'Marked as reviewed: '), `${text}.`);
      form.replaceWith(done, renderFeedback(data, onFeedback));
      done.focus();
    },
  },
    h('fieldset', { class: 'choices' },
      h('legend', {}, 'Mark as reviewed:'),
      choices.map(([value, text]) => radio('review-choice', value, text, () => { error.textContent = ''; }))),
    h('button', { type: 'submit', class: 'btn btn--secondary' }, 'Mark as reviewed'),
    error);

  section.append(form);
  return section;
}

function renderFeedback(data, onFeedback) {
  const question = data.status === 'all_clear' ? 'Was this check helpful?' : 'Was this warning helpful?';
  const error = h('span', { class: 'field-error', 'aria-live': 'polite' });
  const clearError = () => { error.textContent = ''; };

  const form = h('form', {
    class: 'feedback',
    onsubmit: (event) => {
      event.preventDefault();
      const values = new FormData(form);
      const helpful = values.get('helpful');
      if (!helpful) {
        error.textContent = 'Pick yes or no first.';
        return;
      }
      onFeedback(helpful === 'yes', String(values.get('comment') ?? '').trim());
      const done = h('p', { class: 'review__done', tabindex: '-1' }, 'Thanks, your feedback is saved.');
      form.replaceWith(done);
      done.focus();
    },
  },
    h('fieldset', { class: 'choices' },
      h('legend', {}, question),
      radio('helpful', 'yes', 'Yes', clearError),
      radio('helpful', 'no', 'No', clearError)),
    h('label', {},
      h('span', { class: 'sr-only' }, 'Comment (optional)'),
      h('input', { type: 'text', name: 'comment', maxlength: '140', class: 'text-input', placeholder: 'Optional one-line comment, no names' })),
    h('button', { type: 'submit', class: 'btn btn--secondary' }, 'Send feedback'),
    error);
  return form;
}

function radio(name, value, text, onchange) {
  return h('label', { class: 'choice' }, h('input', { type: 'radio', name, value, onchange }), text);
}
