#!/usr/bin/env node
// Walk a local clone of KarsunFDE/content and emit per-week source manifests.
//
// Usage:
//   node scripts/extract-sources.mjs --content-root /path/to/KarsunFDE/content
//                                    [--out sources/]
//                                    [--remote-url https://github.com/KarsunFDE/content/blob/main]
//                                    [--week W01]
//
// Produces sources/<week>.json with per-day file lists + heading anchors,
// consumed by the quiz-bank-gen skill to ground questions in content.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const args = parseArgs(process.argv.slice(2));
const CONTENT_ROOT = args['content-root'] || process.env.CONTENT_ROOT;
const OUT_DIR     = path.resolve(REPO_ROOT, args['out'] || 'sources');
const REMOTE      = args['remote-url'] || 'https://github.com/KarsunFDE/content/blob/main';
const WEEK_FILTER = args['week'] || null;

if (!CONTENT_ROOT) {
  console.error('--content-root required (path to local clone of KarsunFDE/content)');
  process.exit(1);
}
if (!fs.existsSync(CONTENT_ROOT)) {
  console.error(`content root does not exist: ${CONTENT_ROOT}`);
  process.exit(1);
}

// day mapping by directory prefix (matches KarsunFDE/content layout)
const DAY_DIRS = [
  { id: 'Monday',    short: 'Mon', dirPrefix: '1-Monday',    warRoomFile: 'D1' },
  { id: 'Tuesday',   short: 'Tue', dirPrefix: '2-Tuesday',   warRoomFile: 'D2' },
  { id: 'Wednesday', short: 'Wed', dirPrefix: '3-Wednesday', warRoomFile: 'D3' },
  { id: 'Thursday',  short: 'Thu', dirPrefix: '4-Thursday',  warRoomFile: 'D4' },
  { id: 'Friday',    short: 'Fri', dirPrefix: '5-Friday',    warRoomFile: 'D5' }
];

/** GitHub-flavored markdown anchor slug. Mirrors gh-slugger. */
function slugify(text) {
  return text.toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')   // drop punctuation
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function parseHeadings(md) {
  const lines = md.split('\n');
  const out = [];
  const slugCount = new Map();
  let inFence = false;
  for (const ln of lines) {
    if (ln.startsWith('```')) { inFence = !inFence; continue; }
    if (inFence) continue;
    const m = /^(#{1,6})\s+(.+?)\s*$/.exec(ln);
    if (!m) continue;
    const level = m[1].length;
    const text = m[2].replace(/`/g, '').trim();
    let base = slugify(text);
    let n = slugCount.get(base) || 0;
    const anchor = n === 0 ? base : `${base}-${n}`;
    slugCount.set(base, n + 1);
    out.push({ level, text, anchor });
  }
  return out;
}

function firstTitle(md, fallback) {
  const m = /^#\s+(.+?)\s*$/m.exec(md);
  return m ? m[1].trim() : fallback;
}

function listMd(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .sort()
    .map(f => path.join(dir, f));
}

function processFile(absPath, repoRelPath) {
  const md = fs.readFileSync(absPath, 'utf-8');
  const title = firstTitle(md, path.basename(absPath, '.md'));
  const headings = parseHeadings(md);
  const url = `${REMOTE}/${repoRelPath}`;
  return { path: repoRelPath, url, title, headings };
}

function processWeek(week) {
  const weekRoot = path.join(CONTENT_ROOT, week);
  if (!fs.existsSync(weekRoot)) return null;

  const preSessionRoot = path.join(weekRoot, 'pre-session');
  const warRoomRoot    = path.join(weekRoot, 'war-room');

  const days = {};
  for (const d of DAY_DIRS) {
    const dayDir = fs.existsSync(preSessionRoot)
      ? fs.readdirSync(preSessionRoot).find(n => n.toLowerCase().startsWith(d.dirPrefix.toLowerCase()))
      : null;

    const files = [];
    if (dayDir) {
      for (const abs of listMd(path.join(preSessionRoot, dayDir))) {
        const rel = path.relative(CONTENT_ROOT, abs).split(path.sep).join('/');
        files.push(processFile(abs, rel));
      }
    }

    // war-room file for this day, if it exists (KarsunFDE/content names them D1..D5)
    const warFile = path.join(warRoomRoot, `${d.warRoomFile}.md`);
    if (fs.existsSync(warFile)) {
      const rel = path.relative(CONTENT_ROOT, warFile).split(path.sep).join('/');
      files.push(processFile(warFile, rel));
    }

    if (files.length === 0) continue;
    days[d.id] = { short: d.short, files };
  }

  return { week, days };
}

function discoverWeeks() {
  return fs.readdirSync(CONTENT_ROOT)
    .filter(n => /^W\d{2}$/.test(n))
    .sort();
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const weeks = WEEK_FILTER ? [WEEK_FILTER] : discoverWeeks();
let wrote = 0;
for (const w of weeks) {
  const obj = processWeek(w);
  if (!obj) { console.warn(`skip ${w} — not in content root`); continue; }
  const outPath = path.join(OUT_DIR, `${w}.json`);
  fs.writeFileSync(outPath, JSON.stringify(obj, null, 2));
  console.log(`wrote ${path.relative(REPO_ROOT, outPath)} (${Object.keys(obj.days).length} days)`);
  wrote += 1;
}
console.log(`\n${wrote} week manifest(s) written to ${path.relative(REPO_ROOT, OUT_DIR)}/`);

function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const v = (argv[i+1] && !argv[i+1].startsWith('--')) ? argv[++i] : true;
      o[k] = v;
    }
  }
  return o;
}
