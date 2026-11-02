import { h } from '../dom.js';
import { STATES } from '../states.js';

// One line: icon + label + reason. Never reads the excerpts.
export function renderStatusBanner(data) {
  const view = STATES[data.status];
  const reason = data.status === 'loading' ? '' : (data.status_reason || view.defaultReason);

  const icon = h('span', { class: 'banner__icon' });
  icon.innerHTML = view.icon; // static SVG from states.js, not response data

  return h('div', { class: `banner banner--${view.tone}` },
    icon,
    h('p', { class: 'banner__text' }, view.label, reason && ` ${reason}`));
}
