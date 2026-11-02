import { describeSource, h, highlighted } from '../dom.js';

// The single "Open source" hook. Today: open the document at its page, or show
// the passage in a dialog when there is no link. The workbench can point this
// at a full source inspector later without touching the excerpt card.
const dialog = document.getElementById('source-dialog');

export function openSource(excerpt, { onClose } = {}) {
  if (excerpt.source_url) {
    const url = excerpt.page ? `${excerpt.source_url}#page=${excerpt.page}` : excerpt.source_url;
    window.open(url, '_blank', 'noopener');
    return;
  }

  dialog.replaceChildren(
    h('h2', { class: 'dialog__title', id: 'source-dialog-title' }, `Excerpt ${excerpt.label}: full passage`),
    h('p', { class: 'dialog__meta' }, describeSource(excerpt)),
    h('blockquote', { class: 'dialog__text' }, ...highlighted(excerpt.passage || excerpt.text, excerpt.highlight)),
    h('p', { class: 'dialog__note' }, excerpt.passage
      ? 'No document link came with this result, so this shows the passage around the excerpt.'
      : 'No document link came with this result, so this shows the retrieved excerpt only.'),
    h('form', { method: 'dialog' }, h('button', { class: 'btn btn--primary' }, 'Close')));
  dialog.addEventListener('close', () => onClose?.(), { once: true });
  dialog.showModal();
}
