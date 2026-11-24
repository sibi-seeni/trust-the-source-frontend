// Checks a backend response before it is rendered. Mirrors schema/screen_response.schema.json
// (kept by hand, so the demo needs no library or network). Returns a list of problems;
// an empty list means the response can be shown. Anything else shows CHECK DID NOT RUN.

const STATUSES = ['check_failed', 'review_needed', 'outdated', 'not_verified', 'all_clear'];
const ROLES = ['current', 'older_edition', 'prior_edition'];
const TOP_STRINGS = ['question_id', 'question', 'answer', 'status_reason', 'limits', 'next_action', 'model', 'generated_at'];
const NON_EMPTY = ['question_id', 'question', 'status_reason', 'limits', 'next_action'];
const EXCERPT_STRINGS = ['label', 'role', 'text', 'highlight', 'doc_title', 'doc_version', 'locator', 'source_url'];

export function validateResponse(data) {
  const problems = [];
  if (!data || typeof data !== 'object' || Array.isArray(data)) return ['response is not a JSON object'];

  for (const key of TOP_STRINGS) {
    if (typeof data[key] !== 'string') problems.push(`${key} is missing or not text`);
  }
  for (const key of NON_EMPTY) {
    if (typeof data[key] === 'string' && !data[key].trim()) problems.push(`${key} is empty`);
  }
  if (!STATUSES.includes(data.status)) problems.push(`unknown status ${JSON.stringify(data.status)}`);
  if (typeof data.generated_at === 'string' && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(data.generated_at)) {
    problems.push('generated_at is not a UTC timestamp');
  }

  for (const key of ['checks_run', 'checks_failed']) {
    if (!Array.isArray(data[key]) || data[key].some((c) => typeof c !== 'string')) {
      problems.push(`${key} is not a list of check names`);
    }
  }
  if (data.status === 'check_failed' && Array.isArray(data.checks_failed) && data.checks_failed.length === 0) {
    problems.push('check_failed without a failed check');
  }
  if (data.status === 'all_clear' && Array.isArray(data.checks_failed) && data.checks_failed.length > 0) {
    problems.push('all_clear with a failed check');
  }

  if (!Array.isArray(data.excerpts)) {
    problems.push('excerpts is not a list');
  } else {
    data.excerpts.forEach((excerpt, i) => {
      if (!excerpt || typeof excerpt !== 'object') {
        problems.push(`excerpt ${i + 1} is not an object`);
        return;
      }
      for (const key of EXCERPT_STRINGS) {
        if (typeof excerpt[key] !== 'string') problems.push(`excerpt ${i + 1}: ${key} is missing or not text`);
      }
      if (excerpt.passage !== undefined && typeof excerpt.passage !== 'string') problems.push(`excerpt ${i + 1}: passage is not text`);
      if (typeof excerpt.label === 'string' && !/^[A-Z]$/.test(excerpt.label)) problems.push(`excerpt ${i + 1}: bad label`);
      if (typeof excerpt.text === 'string' && !excerpt.text.trim()) problems.push(`excerpt ${i + 1}: text is empty`);
      if (typeof excerpt.role === 'string' && !ROLES.includes(excerpt.role)) problems.push(`excerpt ${i + 1}: unknown role`);
    });
  }
  return problems;
}
