import { h } from '../dom.js';
import { STATES } from '../states.js';
import { renderExcerptCard } from './excerptCard.js';

const VISIBLE_CARDS = 2;

// Lays out the excerpt cards: two side by side, the rest behind "Show N more".
export function renderEvidence(data, { onOpenSource, onToggleSources }) {
  const mode = STATES[data.status].excerpts;
  if (mode === 'hidden' || data.excerpts.length === 0) return null;

  const cards = data.excerpts.map((excerpt, i) =>
    renderExcerptCard(excerpt, { accent: i % 2 === 0 ? 'a' : 'b', onOpenSource }));
  const grid = h('div', { class: 'excerpts', id: 'excerpt-grid' }, cards.slice(0, VISIBLE_CARDS));
  const extra = cards.slice(VISIBLE_CARDS);
  const section = h('section', { class: 'evidence', 'aria-label': 'Source excerpts' });

  if (mode === 'collapsed') {
    const viewLabel = `View sources (${cards.length})`;
    grid.append(...extra);
    grid.hidden = true;
    const toggle = h('button', {
      type: 'button', class: 'link-btn', 'aria-expanded': 'false', 'aria-controls': 'excerpt-grid',
      onclick: () => {
        const opening = grid.hidden;
        grid.hidden = !opening;
        toggle.setAttribute('aria-expanded', String(opening));
        toggle.textContent = opening ? 'Hide sources' : viewLabel;
        onToggleSources(opening ? 'view_sources' : 'hide_sources');
      },
    }, viewLabel);
    section.append(toggle, grid);
    return section;
  }

  section.append(grid);
  if (extra.length) {
    const more = h('button', {
      type: 'button', class: 'link-btn',
      onclick: () => {
        grid.append(...extra);
        more.remove();
        extra[0].tabIndex = -1;
        extra[0].focus();
        onToggleSources('show_more_sources');
      },
    }, `Show ${extra.length} more source${extra.length === 1 ? '' : 's'}`);
    section.append(more);
  }
  return section;
}
