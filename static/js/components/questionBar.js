import { h } from '../dom.js';

export function renderQuestionBar(data) {
  if (!data.question) return null;
  return h('h1', { class: 'question' }, 'Question: ', data.question);
}
