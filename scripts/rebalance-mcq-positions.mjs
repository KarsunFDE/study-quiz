#!/usr/bin/env node
// One-shot remediation: re-shuffle MCQ choice order so correct-answer
// positions are spread evenly across A/B/C/D.
//
// Usage: node scripts/rebalance-mcq-positions.mjs banks/W01/Tuesday.json
//
// Mutates the bank in place. Each MCQ's choices are reordered so that across
// the bank, correct answers land in a deterministic round-robin pattern.
// Non-MCQ questions are not touched.

import fs from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('usage: rebalance-mcq-positions.mjs <bank.json>');
  process.exit(1);
}

const bank = JSON.parse(fs.readFileSync(file, 'utf-8'));
const SLOTS = ['a', 'b', 'c', 'd'];

// Round-robin target slot per MCQ, plus a small offset rotation per question
// so the pattern isn't immediately obvious to learners.
let mcqIdx = 0;
const rotation = [0, 2, 1, 3];   // permutation of slot indexes, varies the pattern

for (const q of bank.questions) {
  if (q.type !== 'mcq') continue;
  const targetIdx = rotation[mcqIdx % 4];
  mcqIdx += 1;

  const correctIdx = q.choices.findIndex(c => c.correct);
  if (correctIdx === -1) continue;
  if (correctIdx === targetIdx) {
    // already in the desired slot; still relabel ids in case
  } else {
    [q.choices[correctIdx], q.choices[targetIdx]] = [q.choices[targetIdx], q.choices[correctIdx]];
  }
  // re-id choices to match position so id always reflects A/B/C/D
  q.choices.forEach((c, i) => { c.id = SLOTS[i]; });
}

fs.writeFileSync(file, JSON.stringify(bank, null, 2) + '\n');
console.log(`rebalanced ${mcqIdx} MCQs in ${file}`);
