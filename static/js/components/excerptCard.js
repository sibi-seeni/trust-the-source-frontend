import { describeSource, h, highlighted } from '../dom.js';

// One quoted passage and where it came from. Doesn't know about other cards;
// `accent` ('a' | 'b') is positional colour chosen by the layout.
export function renderExcerptCard(excerpt, { accent, onOpenSource }) {
  const titleId = `excerpt-${excerpt.label}-title`;

  return h('article', { class: `excerpt excerpt--${accent}`, 'aria-labelledby': titleId },
    h('h3', { class: 'excerpt__title', id: titleId }, `RETRIEVED EXCERPT ${excerpt.label}`),
    h('blockquote', { class: 'excerpt__text' }, '“', ...highlighted(excerpt.text, excerpt.highlight), '”'),
    h('footer', { class: 'excerpt__footer' },
      h('span', {}, describeSource(excerpt)),
      h('button', { type: 'button', class: 'link-btn', onclick: () => onOpenSource(excerpt) },
        'Open source', h('span', { class: 'sr-only' }, ` ${excerpt.label}`))));
}
