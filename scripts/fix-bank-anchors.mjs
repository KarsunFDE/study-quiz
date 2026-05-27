#!/usr/bin/env node
// One-shot: cross-reference bank source anchors against sources/<week>.json
// and repair any that were generated with the old hyphen-collapsing slugger.
// GH does not collapse consecutive hyphens; "a — b" → "a--b".
//
// Usage: node scripts/fix-bank-anchors.mjs banks/W01/Tuesday.json sources/W01.json

import fs from 'node:fs';

const [bankPath, sourcesPath] = process.argv.slice(2);
if (!bankPath || !sourcesPath) {
  console.error('usage: fix-bank-anchors.mjs <bank.json> <sources.json>');
  process.exit(1);
}

const bank = JSON.parse(fs.readFileSync(bankPath, 'utf-8'));
const sources = JSON.parse(fs.readFileSync(sourcesPath, 'utf-8'));

// Build lookup: filePath → Set(validAnchors)
const validByPath = new Map();
for (const day of Object.values(sources.days)) {
  for (const f of day.files) {
    validByPath.set(f.path, new Set(f.headings.map(h => h.anchor)));
  }
}

// Parse `W01/...md` out of a github blob URL
function urlToPath(url) {
  const m = url.match(/\/blob\/main\/(.+?\.md)(?:#|$)/);
  return m ? m[1] : null;
}
function collapse(s) { return s.replace(/-+/g, '-'); }

let fixed = 0, ok = 0, missing = 0;
const report = [];
for (const q of bank.questions) {
  for (const s of (q.sources || [])) {
    const path = urlToPath(s.url);
    if (!path) { missing += 1; continue; }
    const valid = validByPath.get(path);
    if (!valid) { missing += 1; continue; }
    if (valid.has(s.anchor)) { ok += 1; continue; }
    // try to find a valid anchor that collapses to the old one
    const match = [...valid].find(a => collapse(a) === s.anchor);
    if (match) {
      report.push(`${q.id}: ${s.anchor}  →  ${match}`);
      s.anchor = match;
      s.url = s.url.replace(/#[^#]*$/, '#' + match);
      fixed += 1;
    } else {
      missing += 1;
      report.push(`${q.id}: ${s.anchor}  (no match in ${path})`);
    }
  }
}

fs.writeFileSync(bankPath, JSON.stringify(bank, null, 2) + '\n');
console.log(report.join('\n'));
console.log(`\nfixed=${fixed} already-correct=${ok} unresolved=${missing}`);
