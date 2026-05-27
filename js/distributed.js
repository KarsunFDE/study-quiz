// Weighted selection — sample more questions from topics the learner has been weak on.

import { getTopicStats } from './progress.js';
import { shuffle, shuffleQuestionChoices } from './bank-loader.js';

/**
 * weight = baseline + (1 - pct_correct) * boost
 *   topics with low correctness rate are upweighted
 *   topics never seen get a neutral weight
 */
export function distributedPick(allQuestions, n, opts = {}) {
  const baseline = opts.baseline ?? 1.0;
  const boost    = opts.boost ?? 3.0;
  const stats = getTopicStats();

  const scored = allQuestions.map(q => {
    const topics = q.topics || [];
    if (topics.length === 0) return { q, w: baseline };
    let acc = 0, k = 0;
    for (const t of topics) {
      if (stats[t] && stats[t].seen >= 2) {
        acc += (1 - stats[t].pct);
        k += 1;
      }
    }
    const weakness = k ? acc / k : 0.5;   // unknown topics get medium boost
    return { q, w: baseline + weakness * boost };
  });

  // weighted reservoir-style: do n weighted samples without replacement
  const picked = [];
  const pool = scored.slice();
  for (let i = 0; i < n && pool.length; i++) {
    const total = pool.reduce((s, x) => s + x.w, 0);
    let r = Math.random() * total;
    let idx = 0;
    for (; idx < pool.length; idx++) {
      r -= pool[idx].w;
      if (r <= 0) break;
    }
    if (idx >= pool.length) idx = pool.length - 1;
    picked.push(pool[idx].q);
    pool.splice(idx, 1);
  }
  return picked.map(shuffleQuestionChoices);
}
