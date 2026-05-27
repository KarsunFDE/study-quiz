#!/usr/bin/env node
// Validate a generated question bank against schema + anti-pattern rules.
//
// Usage: node scripts/validate-bank.mjs banks/W01/D2.json [banks/W01/D3.json ...]
//
// Exits non-zero on any failure. Prints a summary table.

import fs from 'node:fs';
import path from 'node:path';

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('usage: validate-bank.mjs <bank.json> [...]');
  process.exit(1);
}

const MAX_POSITION_BIAS = 0.30;   // ≤30% of MCQ correct answers may sit in any one position (A/B/C/D)
const MAX_LENGTH_BIAS   = 0.25;   // ≤25% of MCQs may have correct-choice noticeably longer than next-longest distractor
const LENGTH_TELL_RATIO = 1.3;    // correct.length > 1.3 × next-longest-distractor.length = real length tell
const ANSWER_POS_MIN_SAMPLES = 8; // skip position-bias check below this many MCQs

let hadFailure = false;

for (const f of files) {
  const bank = JSON.parse(fs.readFileSync(f, 'utf-8'));
  const report = validate(bank, f);
  printReport(f, report);
  if (report.errors.length > 0) hadFailure = true;
}

process.exit(hadFailure ? 1 : 0);

function validate(bank, fpath) {
  const errors = [];
  const warnings = [];

  if (!bank.meta) errors.push('missing meta');
  if (!Array.isArray(bank.questions)) {
    errors.push('questions[] missing');
    return { errors, warnings, stats: {} };
  }

  const ids = new Set();
  const mcqs = [];

  for (const [i, q] of bank.questions.entries()) {
    const tag = `Q${i+1} (${q.id || '?'})`;
    if (!q.id) errors.push(`${tag}: missing id`);
    else if (ids.has(q.id)) errors.push(`${tag}: duplicate id`);
    else ids.add(q.id);

    if (!q.stem || q.stem.length < 10) errors.push(`${tag}: stem too short`);
    if (!q.explanation || q.explanation.length < 20) errors.push(`${tag}: explanation too short`);
    if (!Array.isArray(q.sources) || q.sources.length === 0) errors.push(`${tag}: must cite ≥1 source`);
    else for (const s of q.sources) {
      if (!s.url || !/^https?:\/\//.test(s.url)) errors.push(`${tag}: source.url malformed`);
      if (!s.title) warnings.push(`${tag}: source missing title`);
    }
    if (!Array.isArray(q.topics) || q.topics.length === 0) warnings.push(`${tag}: no topics tagged`);
    if (!q.difficulty) warnings.push(`${tag}: no difficulty`);

    if (!Array.isArray(q.choices)) {
      errors.push(`${tag}: choices missing`);
      continue;
    }
    const ids2 = new Set();
    for (const c of q.choices) {
      if (!c.id) errors.push(`${tag}: choice missing id`);
      else if (ids2.has(c.id)) errors.push(`${tag}: duplicate choice id ${c.id}`);
      else ids2.add(c.id);
      if (!c.text) errors.push(`${tag}: choice missing text`);
      if (typeof c.correct !== 'boolean') errors.push(`${tag}: choice.correct must be boolean`);
    }

    if (q.type === 'mcq') {
      if (q.choices.length !== 4) errors.push(`${tag}: MCQ must have exactly 4 choices, found ${q.choices.length}`);
      const correctCount = q.choices.filter(c => c.correct).length;
      if (correctCount !== 1) errors.push(`${tag}: MCQ must have exactly 1 correct, found ${correctCount}`);
      // structural: at least 2 distinctly-shorter or distinctly-different distractors
      mcqs.push(q);
    } else if (q.type === 'multi-select') {
      const correctCount = q.choices.filter(c => c.correct).length;
      if (correctCount < 1) errors.push(`${tag}: multi-select needs ≥1 correct`);
      if (correctCount === q.choices.length) errors.push(`${tag}: multi-select needs ≥1 incorrect`);
    } else if (q.type === 'tf-justified') {
      // Statement is either factually True or False. Only the correct branch
      // has a credit-able justification; choosing the wrong T/F means the
      // question is already lost regardless of justification pick.
      const t = q.choices.filter(c => c.branch === 'true');
      const fL = q.choices.filter(c => c.branch === 'false');
      if (t.length < 2 || fL.length < 2) errors.push(`${tag}: tf-justified needs ≥2 choices per branch`);
      const tCorrect = t.filter(c => c.correct).length;
      const fCorrect = fL.filter(c => c.correct).length;
      const total = tCorrect + fCorrect;
      if (total !== 1) errors.push(`${tag}: tf-justified must have exactly 1 correct overall (on the truthful branch), found ${total}`);
    } else {
      errors.push(`${tag}: unknown type "${q.type}"`);
    }
  }

  // anti-pattern: position bias on MCQs
  const positions = { 0:0, 1:0, 2:0, 3:0 };
  let lengthBiased = 0;
  for (const q of mcqs) {
    const correctIdx = q.choices.findIndex(c => c.correct);
    if (correctIdx >= 0) positions[correctIdx] += 1;
    // length tell: is correct choice noticeably longer than the next-longest distractor?
    const correctLen = (q.choices[correctIdx].text || '').length;
    const distractorLens = q.choices
      .map((c, i) => i === correctIdx ? null : (c.text || '').length)
      .filter(x => x !== null)
      .sort((a, b) => b - a);
    const nextLongest = distractorLens[0] || 0;
    if (nextLongest > 0 && correctLen / nextLongest > LENGTH_TELL_RATIO) {
      lengthBiased += 1;
    }
  }
  const total = mcqs.length;
  const stats = { mcqCount: total, positions, lengthBiased };
  if (total >= ANSWER_POS_MIN_SAMPLES) {
    for (const p of [0,1,2,3]) {
      const frac = positions[p] / total;
      if (frac > MAX_POSITION_BIAS) {
        errors.push(`MCQ position bias: option ${'ABCD'[p]} is correct in ${Math.round(frac*100)}% of MCQs (max ${MAX_POSITION_BIAS*100}%)`);
      }
    }
    const lFrac = lengthBiased / total;
    if (lFrac > MAX_LENGTH_BIAS) {
      errors.push(`MCQ length tell: correct choice is >${LENGTH_TELL_RATIO}× next-longest distractor in ${Math.round(lFrac*100)}% of MCQs (max ${MAX_LENGTH_BIAS*100}%)`);
    }
  }

  return { errors, warnings, stats };
}

function printReport(file, r) {
  const ok = r.errors.length === 0 ? '✓' : '✗';
  console.log(`\n${ok} ${file}`);
  if (r.stats.mcqCount !== undefined) {
    const p = r.stats.positions;
    const t = r.stats.mcqCount || 1;
    console.log(`  MCQs: ${r.stats.mcqCount} · positions ` +
      `A=${pct(p[0],t)} B=${pct(p[1],t)} C=${pct(p[2],t)} D=${pct(p[3],t)} · ` +
      `length-tell ${pct(r.stats.lengthBiased, t)}`);
  }
  for (const e of r.errors) console.log(`  ERROR  ${e}`);
  for (const w of r.warnings) console.log(`  warn   ${w}`);
}
function pct(n, t) { return t ? `${Math.round((n/t)*100)}%` : '0%'; }
