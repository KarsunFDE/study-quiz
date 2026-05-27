// quiz.html — drives a single quiz session

import { getProfile, addQuizResult, setPending, getPending, clearPending } from './progress.js';
import { loadManifest, loadDayBank, loadWeekQuestions, pickN } from './bank-loader.js';
import { distributedPick } from './distributed.js';
import { gradeAnswer, formatTime, scopeLabel, scopeDurationSec, scopeQuestionCount } from './app.js';

const $ = (s) => document.querySelector(s);

if (!getProfile()) { location.href = 'index.html'; }

const scope = JSON.parse(sessionStorage.getItem('kfde:scope') || 'null');
if (!scope) { location.href = 'index.html'; }

let state = null;       // { questions, index, perQuestion, startTs }
let tickHandle = null;

async function buildQuestions(scope) {
  const manifest = await loadManifest();
  const count = scopeQuestionCount(scope);
  if (scope.kind === 'day') {
    const bank = await loadDayBank(scope.week, scope.day);
    return pickN(bank.questions, count);
  }
  const all = await loadWeekQuestions(scope.week, manifest);
  if (scope.kind === 'week-distributed') return distributedPick(all, count);
  return pickN(all, count);
}

async function init() {
  $('#scope').textContent = scopeLabel(scope);

  // resume in-flight quiz on this scope, if any
  const pending = getPending();
  if (pending && JSON.stringify(pending.scope) === JSON.stringify(scope)) {
    state = pending.state;
  } else {
    const questions = await buildQuestions(scope);
    state = {
      questions,
      index: 0,
      perQuestion: [],
      startTs: Date.now()
    };
    setPending({ scope, state });
  }

  renderQuestion();
  startTimer();
}

function startTimer() {
  const dur = scopeDurationSec(scope);
  const tick = () => {
    const remain = dur - Math.floor((Date.now() - state.startTs) / 1000);
    const el = $('#timer');
    el.textContent = formatTime(remain);
    el.classList.toggle('warn', remain < 300 && remain >= 60);
    el.classList.toggle('danger', remain < 60);
    if (remain <= 0) { clearInterval(tickHandle); autoFinish(); }
  };
  tick();
  tickHandle = setInterval(tick, 1000);
}

function renderQuestion() {
  const q = state.questions[state.index];
  $('#qmeta').textContent = `${q.difficulty || 'recall'} · ${(q.topics || []).join(' · ')}`;
  $('#stem').textContent = q.stem;
  $('#progress-counter').textContent = `${state.index + 1} / ${state.questions.length}`;
  $('#progress-bar').style.width = `${(state.index / state.questions.length) * 100}%`;
  $('#explanation').classList.add('hidden');
  $('#submit-btn').disabled = true;
  $('#submit-btn').classList.remove('hidden');

  const form = $('#answer-form');
  form.innerHTML = '';

  if (q.type === 'multi-select') {
    form.dataset.kind = 'multi';
    q.choices.forEach((c, i) => form.appendChild(makeChoice(c, i, 'checkbox')));
  } else if (q.type === 'tf-justified') {
    // two-step: first T/F, then justification
    form.dataset.kind = 'tf';
    form.dataset.step = '1';
    const tf = document.createElement('div');
    tf.className = 'flex gap-2';
    ['true','false'].forEach(v => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'border border-slate-300 hover:bg-slate-50 rounded px-4 py-2 text-sm flex-1';
      b.textContent = v === 'true' ? 'True' : 'False';
      b.dataset.tf = v;
      b.onclick = () => {
        form.querySelectorAll('button[data-tf]').forEach(x => x.classList.remove('selected'));
        b.classList.add('selected');
        form.dataset.tfPick = v;
        renderJustification(q, v);
      };
      tf.appendChild(b);
    });
    form.appendChild(tf);
  } else {
    form.dataset.kind = 'mcq';
    q.choices.forEach((c, i) => form.appendChild(makeChoice(c, i, 'radio')));
  }
}

function renderJustification(q, tfPick) {
  const form = $('#answer-form');
  form.dataset.step = '2';
  const wrap = document.createElement('div');
  wrap.className = 'mt-4 pt-4 border-t border-slate-200';
  wrap.innerHTML = `<div class="text-sm text-slate-600 mb-2">Best reason this is <strong>${tfPick}</strong>:</div>`;
  // justifications for this T/F branch live in q.choices grouped by .branch ("true"|"false")
  const opts = q.choices.filter(c => c.branch === tfPick);
  opts.forEach((c, i) => wrap.appendChild(makeChoice(c, i, 'radio')));
  form.appendChild(wrap);
}

function makeChoice(c, i, kind) {
  const letter = String.fromCharCode(65 + i);
  const id = `c-${c.id}`;
  const wrap = document.createElement('label');
  wrap.className = 'choice';
  wrap.htmlFor = id;
  wrap.innerHTML = `
    <input type="${kind}" name="choice" id="${id}" value="${c.id}" />
    <span class="choice-label"><span class="choice-letter">${letter}.</span>${escapeHtml(c.text)}</span>
  `;
  wrap.querySelector('input').addEventListener('change', () => {
    document.querySelectorAll('.choice').forEach(el => {
      const inp = el.querySelector('input');
      if (kind === 'radio') el.classList.toggle('selected', inp.checked);
      else                  el.classList.toggle('selected', inp.checked);
    });
    $('#submit-btn').disabled = !anyChecked();
  });
  return wrap;
}

function anyChecked() {
  return !!document.querySelector('#answer-form input:checked');
}

function readAnswer(q) {
  if (q.type === 'multi-select') {
    return [...document.querySelectorAll('#answer-form input:checked')].map(i => i.value);
  }
  if (q.type === 'tf-justified') {
    const picked = document.querySelector('#answer-form input:checked');
    return picked ? picked.value : null;
  }
  const picked = document.querySelector('#answer-form input:checked');
  return picked ? picked.value : null;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function showExplanation(q, given, correct) {
  // disable inputs, mark choices
  document.querySelectorAll('#answer-form input').forEach(i => i.disabled = true);
  document.querySelectorAll('.choice').forEach(el => {
    const inp = el.querySelector('input');
    const c = q.choices.find(x => x.id === inp.value);
    if (!c) return;
    if (c.correct) el.classList.add('correct');
    else if (inp.checked) el.classList.add('wrong');
    else el.classList.add('muted');
  });

  $('#verdict').textContent = correct ? '✓ Correct' : '✗ Not quite';
  $('#verdict').className = 'text-sm font-semibold mb-2 ' + (correct ? 'verdict-correct' : 'verdict-wrong');
  $('#explain-text').textContent = q.explanation || '';

  const srcs = q.sources || [];
  $('#sources').innerHTML = srcs.length
    ? `<div class="text-xs uppercase tracking-wide text-slate-500 mb-1">Read this</div><ul class="space-y-1">${
        srcs.map(s => `<li>→ <a class="text-emerald-700 hover:underline" target="_blank" rel="noopener" href="${s.url}">${escapeHtml(s.title)}</a></li>`).join('')
      }</ul>`
    : '';

  $('#submit-btn').classList.add('hidden');
  $('#explanation').classList.remove('hidden');
}

function onSubmit() {
  const q = state.questions[state.index];
  const given = readAnswer(q);
  const correct = gradeAnswer(q, given);

  state.perQuestion.push({
    qid: q.id,
    correct,
    given,
    topics: q.topics || [],
    sources: q.sources || []
  });
  setPending({ scope, state });
  showExplanation(q, given, correct);
}

function onNext() {
  state.index += 1;
  if (state.index >= state.questions.length) { finish(); return; }
  setPending({ scope, state });
  renderQuestion();
}

function finish() {
  clearInterval(tickHandle);
  const total = state.questions.length;
  const correct = state.perQuestion.filter(p => p.correct).length;
  const durationSec = Math.round((Date.now() - state.startTs) / 1000);

  const result = {
    scope,
    total,
    correct,
    durationSec,
    perQuestion: state.perQuestion
  };
  addQuizResult(result);
  clearPending();
  sessionStorage.setItem('kfde:lastResult', JSON.stringify(result));
  location.href = 'results.html';
}

function autoFinish() {
  // grade any remaining questions as incorrect (no answer)
  while (state.index < state.questions.length) {
    const q = state.questions[state.index];
    if (!state.perQuestion[state.index]) {
      state.perQuestion.push({
        qid: q.id, correct: false, given: null,
        topics: q.topics || [], sources: q.sources || []
      });
    }
    state.index += 1;
  }
  finish();
}

document.addEventListener('DOMContentLoaded', () => {
  $('#submit-btn').addEventListener('click', onSubmit);
  $('#next-btn').addEventListener('click', onNext);
  init().catch(e => {
    $('#stem').textContent = 'Failed to load this quiz.';
    $('#qmeta').textContent = e.message;
  });
});
