import { h } from '../dom.js';

// What the check did not establish. Sits with the excerpts it describes.
export function renderLimits(data) {
  if (data.status === 'loading' || !data.limits) return null;
  return h('p', { class: 'limits' }, data.limits);
}
