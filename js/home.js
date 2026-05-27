// Dashboard / landing page logic

import { NAMES, getProfile, setProfile, clearProfile, getHistory,
         overallAccuracy, weakestTopic, resetEverything } from './progress.js';
import { loadManifest } from './bank-loader.js';

const $ = (s) => document.querySelector(s);

function startQuiz(scope) {
  sessionStorage.setItem('kfde:scope', JSON.stringify(scope));
  sessionStorage.removeItem('kfde:lastResult');
  location.href = 'quiz.html';
}

function renderNamePicker() {
  $('#name-picker').classList.remove('hidden');
  $('#dashboard').classList.add('hidden');

  const wrap = $('#name-buttons');
  wrap.innerHTML = '';
  for (const n of NAMES) {
    const b = document.createElement('button');
    b.className = 'border border-slate-300 hover:bg-slate-100 rounded px-4 py-2 text-sm font-medium';
    b.textContent = n;
    b.onclick = () => { setProfile(n); render(); };
    wrap.appendChild(b);
  }
  $('#other-name-form').onsubmit = (e) => {
    e.preventDefault();
    const v = $('#other-name').value.trim();
    if (v) { setProfile(v); render(); }
  };
}

function renderHeaderName(name) {
  $('#who').innerHTML = `Signed in as <strong>${name}</strong> · <button id="switch-user" class="text-slate-500 hover:underline">switch</button>`;
  $('#switch-user').onclick = () => { clearProfile(); render(); };
  $('#who-foot').textContent = name;
}

function renderStats() {
  const h = getHistory();
  $('#stat-count').textContent = h.length;
  const acc = overallAccuracy();
  $('#stat-accuracy').textContent = acc.total ? `${Math.round(acc.pct * 100)}%` : '—';
  const w = weakestTopic();
  $('#stat-weak').textContent = w ? `${w.topic} (${Math.round(w.pct * 100)}%)` : '—';
}

async function renderWeeks() {
  let manifest;
  try { manifest = await loadManifest(); }
  catch {
    $('#weeks').innerHTML = '<div class="bg-amber-50 border border-amber-200 text-amber-900 rounded p-4 text-sm">No banks available yet. Run <code>scripts/extract-sources.mjs</code> + the <code>quiz-bank-gen</code> skill to populate <code>banks/</code>.</div>';
    return;
  }

  const wrap = $('#weeks');
  wrap.innerHTML = '';
  for (const [week, info] of Object.entries(manifest.weeks)) {
    const card = document.createElement('div');
    card.className = 'bg-white border border-slate-200 rounded-lg p-4';
    card.innerHTML = `
      <div class="flex items-baseline justify-between mb-3">
        <div>
          <h3 class="font-semibold">${week} — ${info.title || ''}</h3>
          <p class="text-xs text-slate-500">${info.dateRange || ''}</p>
        </div>
        <div class="flex gap-2">
          <button data-week="${week}" data-mode="general"
            class="text-xs bg-slate-900 text-white rounded px-2.5 py-1 disabled:opacity-30"
            ${info.weekReady ? '' : 'disabled'}>Week (30Q)</button>
          <button data-week="${week}" data-mode="distributed"
            class="text-xs bg-emerald-600 text-white rounded px-2.5 py-1 disabled:opacity-30"
            ${info.weekReady ? '' : 'disabled'}>Distributed (30Q)</button>
        </div>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
        ${(info.days || []).map(d => `
          <button data-week="${week}" data-day="${d.id}" data-label="${d.label}"
            class="text-sm border border-slate-300 hover:bg-slate-50 rounded py-2 px-3 text-left disabled:opacity-30 disabled:cursor-not-allowed"
            ${d.ready ? '' : 'disabled'}>
            <span class="block font-medium">${d.label}</span>
            <span class="block text-xs text-slate-500">${d.ready ? `${d.questionCount} Q` : 'not generated yet'}</span>
          </button>`).join('')}
      </div>
    `;
    card.querySelectorAll('button[data-day]').forEach(b => {
      b.onclick = () => startQuiz({
        kind: 'day',
        week: b.dataset.week,
        day: b.dataset.day,
        dayLabel: b.dataset.label
      });
    });
    card.querySelectorAll('button[data-mode]').forEach(b => {
      b.onclick = () => startQuiz({
        kind: b.dataset.mode === 'general' ? 'week-general' : 'week-distributed',
        week: b.dataset.week
      });
    });
    wrap.appendChild(card);
  }
}

function render() {
  const p = getProfile();
  if (!p) { renderNamePicker(); return; }

  $('#name-picker').classList.add('hidden');
  $('#dashboard').classList.remove('hidden');
  renderHeaderName(p.name);
  renderStats();
  renderWeeks();
}

document.addEventListener('DOMContentLoaded', () => {
  render();
  $('#reset-btn').onclick = () => {
    if (confirm('Clear all your progress (history, scores)? Profile name stays.')) {
      // wipe history for current user
      const p = getProfile();
      if (p) {
        Object.keys(localStorage)
          .filter(k => k.startsWith('kfde:') && k.endsWith(`:${p.name}`))
          .forEach(k => localStorage.removeItem(k));
      }
      render();
    }
  };
});
