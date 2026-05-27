#!/usr/bin/env node
// One-shot remediation: trim trailing explanation clauses off correct MCQ
// answers when they're noticeably longer than distractors. Explanation belongs
// in the .explanation field, not the choice text.
//
// Heuristic: if correct choice is > 1.25× the median distractor length, split
// on em-dash / colon / " — " and keep the first clause if it remains > 60% of
// the distractor median. Otherwise leave alone (skipping = caller hand-edits).
//
// Usage: node scripts/trim-correct-tails.mjs banks/W01/Tuesday.json
// Use --dry-run to preview without writing.

import fs from 'node:fs';

const file = process.argv.find(a => !a.startsWith('--') && a !== process.argv[0] && a !== process.argv[1]);
const dryRun = process.argv.includes('--dry-run');
if (!file) { console.error('usage: trim-correct-tails.mjs <bank.json> [--dry-run]'); process.exit(1); }

const bank = JSON.parse(fs.readFileSync(file, 'utf-8'));

// Split on " — " (em-dash with spaces), ": ", " - " (en-dash spaced), ", and "
const SPLIT_RX = /(?:\s+—\s+|:\s+|\s+-\s+|;\s+)/;

let trimmed = 0;
let skipped = 0;

for (const q of bank.questions) {
  if (q.type !== 'mcq') continue;
  const correct = q.choices.find(c => c.correct);
  const distractors = q.choices.filter(c => !c.correct);
  if (!correct || distractors.length === 0) continue;

  const dLens = distractors.map(c => c.text.length).sort((a,b)=>a-b);
  const median = dLens[Math.floor(dLens.length/2)];
  const cLen = correct.text.length;

  if (cLen <= median * 1.25) continue;  // already balanced

  // Try splitting
  const parts = correct.text.split(SPLIT_RX);
  if (parts.length < 2) { skipped += 1; continue; }
  const head = parts[0].trim();
  if (head.length < median * 0.6) { skipped += 1; continue; }
  if (head.length > median * 1.25) {
    // even the head is still too long; try splitting head again
    const headParts = head.split(SPLIT_RX);
    if (headParts.length > 1 && headParts[0].length >= median * 0.6 && headParts[0].length <= median * 1.25) {
      console.log(`Q${q.id}: head-of-head trim`);
      console.log(`  was: ${correct.text}`);
      console.log(`  new: ${headParts[0]}`);
      if (!dryRun) correct.text = headParts[0].trim();
      trimmed += 1;
    } else {
      skipped += 1;
    }
    continue;
  }
  console.log(`Q${q.id}: trim`);
  console.log(`  was: ${correct.text}`);
  console.log(`  new: ${head}`);
  if (!dryRun) correct.text = head;
  trimmed += 1;
}

if (!dryRun) fs.writeFileSync(file, JSON.stringify(bank, null, 2) + '\n');
console.log(`\ntrimmed=${trimmed} skipped=${skipped}${dryRun ? ' (dry-run)' : ''}`);
