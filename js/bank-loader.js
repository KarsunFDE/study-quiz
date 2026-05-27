// Fetch + assemble question banks from /banks/W{NN}/...

const BASE = 'banks';

export async function loadManifest() {
  const r = await fetch(`${BASE}/manifest.json`, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`manifest load failed: ${r.status}`);
  return r.json();
}

export async function loadDayBank(week, dayId) {
  const url = `${BASE}/${week}/${dayId}.json`;
  const r = await fetch(url, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`bank not found: ${url}`);
  return r.json();
}

/**
 * Load all day banks for a week and concatenate questions
 */
export async function loadWeekQuestions(week, manifest) {
  const days = manifest.weeks[week]?.days || [];
  const banks = await Promise.all(days.map(d => loadDayBank(week, d.id)));
  const all = [];
  banks.forEach((b, i) => {
    for (const q of b.questions) {
      all.push({ ...q, _day: days[i].id, _dayLabel: days[i].label });
    }
  });
  return all;
}

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Shuffle the *choices* inside each question (so position cues can't help).
 * Keeps the `correct` flag attached to the original choice object.
 */
export function shuffleQuestionChoices(q) {
  if (q.type === 'multi-select' || q.type === 'mcq') {
    return { ...q, choices: shuffle(q.choices) };
  }
  return q;
}

export function pickN(questions, n) {
  return shuffle(questions).slice(0, n).map(shuffleQuestionChoices);
}
