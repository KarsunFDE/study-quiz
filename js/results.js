import { getProfile } from './progress.js';
import { formatTime, scopeLabel } from './app.js';

const $ = (s) => document.querySelector(s);

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

const p = getProfile();
if (!p) location.href = 'index.html';
$('#who-foot').textContent = p?.name || '';

const r = JSON.parse(sessionStorage.getItem('kfde:lastResult') || 'null');
if (!r) location.href = 'index.html';

$('#result-scope').textContent = scopeLabel(r.scope);
const pct = r.total ? Math.round((r.correct / r.total) * 100) : 0;
$('#result-pct').textContent = `${pct}%`;
$('#result-correct').textContent = r.correct;
$('#result-total').textContent = r.total;
$('#result-time').textContent = `Time: ${formatTime(r.durationSec)}`;

// weak topics: count misses per topic
const missedTopics = {};
for (const pq of r.perQuestion) {
  if (pq.correct) continue;
  for (const t of (pq.topics || [])) {
    missedTopics[t] = (missedTopics[t] || 0) + 1;
  }
}
const weakArr = Object.entries(missedTopics).sort((a, b) => b[1] - a[1]);
$('#weak-topics').innerHTML = weakArr.length
  ? weakArr.map(([t, n]) => `<span class="topic-chip">${escapeHtml(t)} · ${n}</span>`).join('')
  : '<span class="text-slate-500 text-sm">Nothing flagged — clean run.</span>';

// targeted reading list: dedupe sources by URL across missed questions
const seen = new Map();
for (const pq of r.perQuestion) {
  if (pq.correct) continue;
  for (const s of (pq.sources || [])) {
    if (!seen.has(s.url)) seen.set(s.url, s);
  }
}
const list = [...seen.values()];
$('#reading-list').innerHTML = list.length
  ? list.map(s => `<li>→ <a class="text-emerald-700 hover:underline" target="_blank" rel="noopener" href="${s.url}">${escapeHtml(s.title)}</a></li>`).join('')
  : '<li class="text-slate-500">Everything correct — no follow-up reading.</li>';

// retry buttons
$('#retry-same').onclick = () => {
  sessionStorage.setItem('kfde:scope', JSON.stringify(r.scope));
  sessionStorage.removeItem('kfde:lastResult');
  location.href = 'quiz.html';
};
if (r.scope.kind === 'week-general' || r.scope.kind === 'week-distributed') {
  const btn = $('#retry-distributed');
  btn.classList.remove('hidden');
  btn.onclick = () => {
    sessionStorage.setItem('kfde:scope', JSON.stringify({ ...r.scope, kind: 'week-distributed' }));
    sessionStorage.removeItem('kfde:lastResult');
    location.href = 'quiz.html';
  };
}
