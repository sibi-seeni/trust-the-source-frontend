import { describeSource, h } from '../dom.js';
import { STATES } from '../states.js';

// Next-action guidance and the action buttons. The limits line lives in limits.js.
export function renderNextAction(data, { onCompareEdition, onCopyFollowUp }) {
  if (data.status === 'loading') return null;

  const row = h('div', { class: 'next-action' });
  if (data.next_action) row.append(h('p', { class: 'next' }, h('strong', {}, 'Next action: '), data.next_action));

  const buttons = h('div', { class: 'actions' });
  // There is no reference copy in the frontline setting; the prior edition is what we compared against.
  const prior = data.excerpts.find((excerpt) => excerpt.role === 'prior_edition');
  if (prior) {
    buttons.append(h('button', {
      type: 'button', class: 'btn btn--primary', onclick: () => onCompareEdition(prior),
    }, `Compare with ${prior.doc_version || 'prior'} edition`));
  }
  if (data.status !== 'all_clear' && data.excerpts.length > 0) {
    const note = h('span', { class: 'status-note', 'aria-live': 'polite' });
    buttons.append(h('button', {
      type: 'button', class: 'btn btn--secondary',
      onclick: async () => {
        const copied = await onCopyFollowUp(followUpMessage(data));
        note.textContent = copied
          ? 'Copied. Paste it wherever you track follow-ups.'
          : 'Could not copy automatically. Copy the excerpts by hand.';
      },
    }, 'Copy for follow-up'), note);
  }
  if (buttons.childElementCount) row.append(buttons);

  return row.childElementCount ? row : null;
}

function followUpMessage(data) {
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
