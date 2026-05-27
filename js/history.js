// history.html — aggregated study view across all of a learner's quizzes.

import { getProfile, clearProfile, getHistory, getTopicStats, overallAccuracy } from './progress.js';

const $ = (s) => document.querySelector(s);

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function scopeLabel(scope) {
  if (!scope) return 'Quiz';
  if (scope.kind === 'day') return `${scope.week} · ${scope.dayLabel}`;
  if (scope.kind === 'week-general') return `${scope.week} · General`;
  if (scope.kind === 'week-distributed') return `${scope.week} · Distributed`;
  return scope.week || 'Quiz';
}
function fmtDate(ts) {
  const d = new Date(ts);
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}
function fmtDuration(s) {
  const m = Math.floor(s / 60); const r = s % 60;
  return `${m}m ${String(r).padStart(2,'0')}s`;
}

const p = getProfile();
if (!p) { location.href = 'index.html'; }
$('#who').innerHTML = `Signed in as <strong>${escapeHtml(p.name)}</strong> · <button id="switch-user" class="text-slate-500 hover:underline">switch</button>`;
$('#switch-user').onclick = () => { clearProfile(); location.href = 'index.html'; };

const PAGE_SIZE = 5;
const pageState = { reading: 0, topics: 0 };
let readingItems = [];
let topicRows = [];

const history = getHistory();
if (history.length === 0) {
  $('#empty').classList.remove('hidden');
} else {
  $('#overview').classList.remove('hidden');
  $('#study-grid').classList.remove('hidden');
  $('#quizzes-section').classList.remove('hidden');
  renderOverview();
  buildReadingItems();
  buildTopicRows();
  renderReadingPage();
  renderTopicsPage();
  renderQuizHistory();
  wirePagers();
}

function wirePagers() {
  document.querySelectorAll('button[data-pager]').forEach(b => {
    b.onclick = () => {
      const which = b.dataset.pager;
      const dir = Number(b.dataset.dir);
      pageState[which] = Math.max(0, pageState[which] + dir);
      if (which === 'reading') renderReadingPage();
      else renderTopicsPage();
    };
  });
}

function pagerControls(which, total) {
  const pager = $(`#${which}-pager`);
  const label = document.querySelector(`[data-pager-label="${which}"]`);
  if (total <= PAGE_SIZE) { pager.classList.add('hidden'); return; }
  pager.classList.remove('hidden');
  pager.classList.add('flex');
  const totalPages = Math.ceil(total / PAGE_SIZE);
  if (pageState[which] >= totalPages) pageState[which] = totalPages - 1;
  const cur = pageState[which];
  const first = cur * PAGE_SIZE + 1;
  const last = Math.min(total, (cur + 1) * PAGE_SIZE);
  label.textContent = `${first}–${last} of ${total} · page ${cur + 1} / ${totalPages}`;
  pager.querySelector('[data-dir="-1"]').disabled = cur === 0;
  pager.querySelector('[data-dir="1"]').disabled  = cur >= totalPages - 1;
}

function renderOverview() {
  $('#ov-count').textContent = history.length;
  const totalQs = history.reduce((s, q) => s + q.total, 0);
  $('#ov-questions').textContent = totalQs;
  const acc = overallAccuracy();
  $('#ov-acc').textContent = acc.total ? `${Math.round(acc.pct * 100)}%` : '—';
}

function buildReadingItems() {
  // for each source URL: count misses, track latest miss date, collect titles
  const stats = new Map();
  for (const quiz of history) {
    for (const pq of (quiz.perQuestion || [])) {
      if (pq.correct) continue;
      for (const s of (pq.sources || [])) {
        const k = s.url;
        const cur = stats.get(k) || { url: s.url, title: s.title, misses: 0, lastTs: 0 };
        cur.misses += 1;
        cur.lastTs = Math.max(cur.lastTs, quiz.ts);
        if (s.title && !cur.title) cur.title = s.title;
        stats.set(k, cur);
      }
    }
  }
  // weakest first = most misses; tiebreak by most-recent miss
  readingItems = [...stats.values()].sort((a, b) => b.misses - a.misses || b.lastTs - a.lastTs);
}

function renderReadingPage() {
  $('#reading-count').textContent = `${readingItems.length} link${readingItems.length === 1 ? '' : 's'}`;
  if (readingItems.length === 0) {
    $('#reading-list').innerHTML = '<li class="text-slate-500">No misses yet — your reading list is empty.</li>';
    pagerControls('reading', 0);
    return;
  }
  const start = pageState.reading * PAGE_SIZE;
  const slice = readingItems.slice(start, start + PAGE_SIZE);
  $('#reading-list').innerHTML = slice.map(it => `
    <li class="flex items-start gap-3">
      <span class="inline-block mt-0.5 text-xs font-mono bg-rose-50 text-rose-700 border border-rose-100 rounded px-1.5 py-0.5 min-w-[2rem] text-center">×${it.misses}</span>
      <div class="flex-1 min-w-0">
        <a href="${it.url}" target="_blank" rel="noopener" class="text-emerald-700 hover:underline break-words">${escapeHtml(it.title)}</a>
        <div class="text-xs text-slate-400">last missed ${fmtDate(it.lastTs)}</div>
      </div>
    </li>
  `).join('');
  pagerControls('reading', readingItems.length);
}

function buildTopicRows() {
  const stats = getTopicStats();
  topicRows = Object.entries(stats)
    .filter(([, s]) => s.seen >= 2)
    .sort((a, b) => a[1].pct - b[1].pct);   // weakest first (lowest accuracy)
}

function renderTopicsPage() {
  $('#topics-count').textContent = `${topicRows.length} topic${topicRows.length === 1 ? '' : 's'}`;
  if (topicRows.length === 0) {
    $('#topics-body').innerHTML = '<tr><td colspan="3" class="py-3 text-slate-500">Not enough data yet — take more quizzes.</td></tr>';
    pagerControls('topics', 0);
    return;
  }
  const start = pageState.topics * PAGE_SIZE;
  const slice = topicRows.slice(start, start + PAGE_SIZE);
  $('#topics-body').innerHTML = slice.map(([t, s]) => {
    const pct = Math.round(s.pct * 100);
    const tone = pct < 50 ? 'text-rose-700' : pct < 75 ? 'text-amber-700' : 'text-emerald-700';
    return `<tr class="border-b border-slate-100 last:border-0">
      <td class="py-2 pr-2">${escapeHtml(t)}</td>
      <td class="text-right text-slate-500">${s.seen}</td>
      <td class="text-right pr-2 font-medium ${tone}">${pct}%</td>
    </tr>`;
  }).join('');
  pagerControls('topics', topicRows.length);
}

function renderQuizHistory() {
  // newest first
  const ordered = history.slice().sort((a, b) => b.ts - a.ts);
  $('#quiz-history').innerHTML = ordered.map(q => {
    const pct = q.total ? Math.round((q.correct / q.total) * 100) : 0;
    const tone = pct >= 75 ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : pct >= 50 ? 'bg-amber-50 border-amber-200 text-amber-700'
                : 'bg-rose-50 border-rose-200 text-rose-700';
    return `<li>
      <button data-ts="${q.ts}" class="w-full text-left flex items-center gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition">
        <span class="inline-block min-w-[3.25rem] text-center font-mono text-sm font-semibold rounded px-2 py-1 border ${tone}">${pct}%</span>
        <span class="flex-1">
          <span class="block font-medium">${escapeHtml(scopeLabel(q.scope))}</span>
          <span class="block text-xs text-slate-500">${fmtDate(q.ts)} · ${q.correct}/${q.total} correct · ${fmtDuration(q.durationSec)}</span>
        </span>
        <span class="text-slate-400">→</span>
      </button>
    </li>`;
  }).join('');
  $('#quiz-history').querySelectorAll('button[data-ts]').forEach(b => {
    b.onclick = () => {
      const ts = Number(b.dataset.ts);
      const found = history.find(q => q.ts === ts);
      if (!found) return;
      sessionStorage.setItem('kfde:lastResult', JSON.stringify(found));
      location.href = 'results.html?from=history';
    };
  });
}
