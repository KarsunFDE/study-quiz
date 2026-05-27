// localStorage-backed progress store. No server, no PII beyond first name.

export const NAMES = ['Aaron', 'Alec', 'Charles', 'Kevin', 'Ronald'];

const PROFILE_KEY  = 'kfde:profile';      // { name }
const HISTORY_KEY  = 'kfde:history';      // [{ ts, scope, total, correct, durationSec, perQuestion: [...] }]
const PENDING_KEY  = 'kfde:pending';      // in-flight quiz so reload doesn't lose it

export function getProfile() {
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null'); }
  catch { return null; }
}
export function setProfile(name) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify({ name }));
}
export function clearProfile() {
  localStorage.removeItem(PROFILE_KEY);
}

function nsKey(base) {
  const p = getProfile();
  return p ? `${base}:${p.name}` : base;
}

export function getHistory() {
  try { return JSON.parse(localStorage.getItem(nsKey(HISTORY_KEY)) || '[]'); }
  catch { return []; }
}
export function addQuizResult(result) {
  const h = getHistory();
  h.push({ ts: Date.now(), ...result });
  localStorage.setItem(nsKey(HISTORY_KEY), JSON.stringify(h));
}

/**
 * Per-topic stats across all history. Returns { topic: { seen, correct, pct } }
 */
export function getTopicStats() {
  const h = getHistory();
  const out = {};
  for (const quiz of h) {
    for (const pq of (quiz.perQuestion || [])) {
      for (const t of (pq.topics || [])) {
        if (!out[t]) out[t] = { seen: 0, correct: 0 };
        out[t].seen += 1;
        if (pq.correct) out[t].correct += 1;
      }
    }
  }
  for (const t of Object.keys(out)) {
    out[t].pct = out[t].seen ? out[t].correct / out[t].seen : 0;
  }
  return out;
}

export function weakestTopic(minSeen = 3) {
  const stats = getTopicStats();
  let worst = null;
  for (const [t, s] of Object.entries(stats)) {
    if (s.seen < minSeen) continue;
    if (!worst || s.pct < worst.pct) worst = { topic: t, ...s };
  }
  return worst;
}

export function overallAccuracy() {
  const h = getHistory();
  let total = 0, correct = 0;
  for (const q of h) { total += q.total; correct += q.correct; }
  return { total, correct, pct: total ? correct / total : 0 };
}

export function reset() {
  // wipe history for current user only, keep profile
  localStorage.removeItem(nsKey(HISTORY_KEY));
  localStorage.removeItem(nsKey(PENDING_KEY));
}
export function resetEverything() {
  for (const k of Object.keys(localStorage)) {
    if (k.startsWith('kfde:')) localStorage.removeItem(k);
  }
}

export function setPending(payload) {
  localStorage.setItem(nsKey(PENDING_KEY), JSON.stringify(payload));
}
export function getPending() {
  try { return JSON.parse(localStorage.getItem(nsKey(PENDING_KEY)) || 'null'); }
  catch { return null; }
}
export function clearPending() {
  localStorage.removeItem(nsKey(PENDING_KEY));
}
