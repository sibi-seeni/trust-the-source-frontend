import { h } from '../dom.js';

const ACCEPTED_TYPES = '.pdf,.doc,.docx,.txt,.md,.html';

// Files picked in this browser session. Demo only: they never leave the browser.
const files = [];

// Signet landing page: the question box and a place to add documents.
export function renderLanding({ onAsk, onDocumentsChanged }) {
  const error = h('p', { class: 'field-error ask__error', id: 'ask-error', 'aria-live': 'polite' });
  const input = h('textarea', {
    id: 'ask-input', name: 'question', rows: '2', class: 'ask__input', 'aria-describedby': 'ask-error',
    placeholder: 'What is the wage threshold in the 2025 instructions?',
    oninput: () => { error.textContent = ''; },
    onkeydown: (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        form.requestSubmit();
      }
    },
  });
  const form = h('form', {
    class: 'ask',
    onsubmit: (event) => {
      event.preventDefault();
      const question = input.value.trim();
      if (!question) {
        error.textContent = 'Type a question first.';
        input.focus();
        return;
      }
      onAsk(question, files.length);
    },
  },
    h('label', { for: 'ask-input', class: 'sr-only' }, 'Your question'),
    input,
    h('button', { type: 'submit', class: 'btn btn--primary' }, 'Ask'));

  return h('div', { class: 'landing__inner' },
    h('h1', { class: 'brand' }, 'Signet'),
    h('p', { class: 'brand__tagline' }, 'Ask about your documents. Every answer is checked against its sources.'),
    form,
    error,
    renderUpload(onDocumentsChanged));
}

function renderUpload(onDocumentsChanged) {
  const list = h('ul', { class: 'upload__list', 'aria-label': 'Added documents' });
  const picker = h('input', {
    type: 'file', multiple: true, accept: ACCEPTED_TYPES, class: 'sr-only', tabindex: '-1', 'aria-hidden': 'true',
    onchange: () => { add(picker.files); picker.value = ''; },
  });

  function add(fileList) {
    let added = 0;
    for (const file of fileList) {
      if (files.some((f) => f.name === file.name && f.size === file.size)) continue;
      files.push(file);
      added += 1;
    }
    if (added) {
      showList();
      onDocumentsChanged('add_documents', { added, total: files.length });
    }
  }

  function showList() {
    list.replaceChildren(...files.map((file, i) => h('li', { class: 'upload__item' },
      h('span', { class: 'upload__name' }, file.name),
      h('span', { class: 'upload__size' }, formatSize(file.size)),
      h('button', {
        type: 'button', class: 'link-btn',
        onclick: () => {
          files.splice(i, 1);
          showList();
          zone.querySelector('.upload__browse').focus();
          onDocumentsChanged('remove_document', { total: files.length });
        },
      }, 'Remove', h('span', { class: 'sr-only' }, ` ${file.name}`)))));
    list.hidden = files.length === 0;
  }

  const zone = h('section', {
    class: 'upload', 'aria-labelledby': 'upload-title',
    ondragover: (event) => { event.preventDefault(); zone.classList.add('upload--over'); },
    ondragleave: () => zone.classList.remove('upload--over'),
    ondrop: (event) => {
      event.preventDefault();
      zone.classList.remove('upload--over');
      add(event.dataTransfer.files);
    },
  },
    picker,
    h('h2', { class: 'upload__title', id: 'upload-title' }, 'Add your documents'),
    h('p', { class: 'upload__hint' }, 'Drag files here, or ',
      h('button', { type: 'button', class: 'link-btn upload__browse', onclick: () => picker.click() }, 'browse your files'),
      '. PDF, Word or text files.'),
    h('p', { class: 'upload__note' }, 'In this demo, files stay in your browser and are not sent anywhere.'),
    list);

  showList();
  return zone;
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
