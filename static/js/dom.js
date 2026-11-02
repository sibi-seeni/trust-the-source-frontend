// Small DOM helpers shared by the components.

// h('p', { class: 'x', onclick: fn }, 'text', childNode) -> element.
// Children are appended as text nodes or elements, never parsed as HTML.
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
    else el.setAttribute(key, value === true ? '' : value);
  }
  el.append(...children.flat().filter((child) => child != null && child !== false));
  return el;
}

// Splits text around the first exact match of `highlight`.
// If there is no exact match, returns the text unhighlighted rather than guessing.
export function highlighted(text = '', highlight) {
  const at = highlight ? text.indexOf(highlight) : -1;
  if (at < 0) return [text];
  return [text.slice(0, at), h('mark', { class: 'hl' }, highlight), text.slice(at + highlight.length)];
}

// "2025 Instructions · version 2025 · Dec 2024 · page 3"
export function describeSource(excerpt) {
  return [
    excerpt.doc_title,
    excerpt.doc_version && `version ${excerpt.doc_version}`,
    excerpt.doc_date,
    excerpt.page != null && excerpt.page !== '' && `page ${excerpt.page}`,
  ].filter(Boolean).join(' · ');
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard API can be blocked (e.g. not a secure context); fall back to a hidden textarea.
    const area = h('textarea', { class: 'sr-only', readonly: true, 'aria-hidden': 'true' }, text);
    document.body.append(area);
    area.select();
    let copied = false;
    try { copied = document.execCommand('copy'); } catch { /* reported to the caller as not copied */ }
    area.remove();
    return copied;
  }
}
