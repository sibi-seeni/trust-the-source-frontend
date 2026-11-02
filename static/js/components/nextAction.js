import { describeSource, h } from '../dom.js';
import { STATES } from '../states.js';

// Limits line, next-action guidance and the action buttons.
export function renderNextAction(data, { onCheckReference, onAskOwner }) {
  if (data.status === 'loading') return null;

  const row = h('div', { class: 'next-action' });
  if (data.limits) row.append(h('p', { class: 'limits' }, data.limits));
  if (data.next_action) row.append(h('p', { class: 'next' }, h('strong', {}, 'Next action: '), data.next_action));

  const buttons = h('div', { class: 'actions' });
  if (data.reference?.url) {
    buttons.append(h('button', {
      type: 'button', class: 'btn btn--primary', onclick: () => onCheckReference(data.reference),
    }, 'Check a reference'));
  }
  if (data.status !== 'all_clear' && data.excerpts.length > 0) {
    const note = h('span', { class: 'status-note', 'aria-live': 'polite' });
    buttons.append(h('button', {
      type: 'button', class: 'btn btn--secondary',
      onclick: async () => {
        const copied = await onAskOwner(ownerMessage(data));
        note.textContent = copied
          ? 'Message copied. Paste it into an email to the document owner.'
          : 'Could not copy automatically. Copy the excerpts by hand.';
      },
    }, 'Ask document owner'), note);
  }
  if (buttons.childElementCount) row.append(buttons);

  return row.childElementCount ? row : null;
}

function ownerMessage(data) {
  const view = STATES[data.status];
  const lines = [
    'Hello,',
    '',
    'While checking an answer, I found passages in your documents that I would like you to look at.',
    '',
    `Question: ${data.question}`,
    `Check result: ${view.label} ${data.status_reason || view.defaultReason}`,
    '',
  ];
  for (const excerpt of data.excerpts) {
    lines.push(`Excerpt ${excerpt.label} (${describeSource(excerpt)}):`, `"${excerpt.text}"`, '');
  }
  lines.push('Could you confirm which passage applies?', '', 'Thank you.');
  return lines.join('\n');
}
