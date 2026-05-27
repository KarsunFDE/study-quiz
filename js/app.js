// Shared utilities used by runner.js / results.js / home.js

export function formatTime(s) {
  if (s < 0) s = 0;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

/**
 * Grade a learner answer against a question's correct flag(s).
 *   mcq / tf-justified  → answer is the chosen choice.id (after T/F path is collapsed)
 *   multi-select        → answer is array of choice.ids, must exactly match correct set
 */
export function gradeAnswer(question, given) {
  if (question.type === 'multi-select') {
    const correct = new Set(question.choices.filter(c => c.correct).map(c => c.id));
    const g = new Set(given || []);
    if (correct.size !== g.size) return false;
    for (const x of correct) if (!g.has(x)) return false;
    return true;
  }
  // mcq or tf-justified — single choice id
  const c = question.choices.find(x => x.id === given);
  return !!(c && c.correct);
}

export function scopeLabel(scope) {
  if (scope.kind === 'day') return `${scope.week} · ${scope.dayLabel} (15Q · 30 min)`;
  if (scope.kind === 'week-general') return `${scope.week} · General (30Q · 60 min)`;
  if (scope.kind === 'week-distributed') return `${scope.week} · Distributed (30Q · 60 min)`;
  return scope.week || '';
}

export function scopeDurationSec(scope) {
  return scope.kind === 'day' ? 30 * 60 : 60 * 60;
}
export function scopeQuestionCount(scope) {
  return scope.kind === 'day' ? 15 : 30;
}
