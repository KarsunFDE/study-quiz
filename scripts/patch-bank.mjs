#!/usr/bin/env node
// Apply hand-curated text patches to the bank: trim long correct-answer texts,
// rename day from D2→Tuesday, fix question IDs from W01-D2-Q* to W01-Tue-Q*.
//
// One-shot — run once on a freshly generated bank.

import fs from 'node:fs';

const file = process.argv[2];
const bank = JSON.parse(fs.readFileSync(file, 'utf-8'));

const TRIMS = {
  'W01-D2-Q06': {
    a: 'Custom Skill (slash-command workflow)',
    b: 'MCP server (external-system bridge)',
    c: 'Subagent (isolated context window)',
    d: 'Hook (PreToolUse on Bash)'
  },
  'W01-D2-Q13': {
    correct: "Overengineering — mesh operational cost doesn't pay off below ~15 services"
  },
  'W01-D2-Q18': {
    correct: 'Re-validate (at minimum re-check iss + aud) — defence-in-depth against gateway compromise'
  },
  'W01-D2-Q19': {
    correct: 'Stitching N service log streams back to a single inbound request'
  },
  'W01-D2-Q22': {
    correct: 'Long-lived credentials leak via CI logs and outlast departed employees'
  },
  'W01-D2-Q25': {
    correct: 'Any branch (including feature branches and forks) can assume the role — defeats OIDC scoping'
  },
  'W01-D2-Q28': {
    correct: 'Federal clients carry inherited stacks, live SLAs, and legacy data — greenfield is exceptional'
  },
  'W01-D2-Q30': {
    correct: 'Jumping to fix visible debt without first inventorying the landscape — produces whack-a-mole'
  },
  'W01-D2-Q38': {
    correct: 'Slides, not evidence — defensible matrices source every cell and name gaps explicitly'
  },
  'W01-D2-Q40': {
    correct: 'Enterprises bought LLM products faster than internal teams could integrate them'
  },
  'W01-D2-Q42': {
    correct: 'The API gateway mints it (or accepts a strict-format upstream value) before forwarding'
  },
  'W01-D2-Q44': {
    correct: 'Tour walks the codebase as comprehension practice; incident-driven war-rooms start Thursday'
  }
};

// pad short distractors in Q32 (vague-aspirational items deliberately) — instead of trimming the correct,
// keep this as a content-driven length asymmetry but make it a multi-select so the rule doesn't apply.
// However for now we'll just leave it; multi-select rework left as TODO.

// Update meta.day + IDs
bank.meta.day = 'Tuesday';
bank.meta.dayLabel = 'Tue 26 May';

for (const q of bank.questions) {
  // rename id W01-D2-Q01 → W01-Tue-Q01
  const newId = q.id.replace('-D2-', '-Tue-');
  const trims = TRIMS[q.id];
  q.id = newId;

  if (!trims) continue;
  if (trims.correct) {
    const c = q.choices.find(x => x.correct);
    if (c) c.text = trims.correct;
  }
  // per-slot replacement (Q6 only)
  for (const slot of ['a','b','c','d']) {
    if (trims[slot]) {
      const c = q.choices.find(x => x.id === slot);
      if (c) c.text = trims[slot];
    }
  }
}

fs.writeFileSync(file, JSON.stringify(bank, null, 2) + '\n');
console.log('patched', file);
