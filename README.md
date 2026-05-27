# Karsun-FDE Study Quiz

Static GH-Pages quiz site for the Karsun-FDE 6-week intensive (Cohort #1: 26 May – 2 Jul 2026). Pulls question banks generated from [`KarsunFDE/content`](https://github.com/KarsunFDE/content); learners pick a day (15Q · 30 min) or a week (30Q · 60 min) and get an explanation + targeted reading list after each session.

> Live site: **https://karsunfde.github.io/study-quiz/**

## What's here

```
study-quiz/
├── index.html / quiz.html / results.html   # static UI (vanilla HTML + Tailwind CDN)
├── css/, js/                               # client logic — localStorage-only, no auth, no backend
├── banks/
│   ├── manifest.json                       # which week/day banks exist + question counts
│   └── W01/, W02/, …/                      # per-day question banks (Tuesday.json, Wednesday.json, …)
├── sources/                                # per-week source manifests (file paths + heading anchors)
├── scripts/
│   ├── extract-sources.mjs                 # walk KarsunFDE/content → sources/<week>.json
│   ├── validate-bank.mjs                   # schema + anti-pattern checks on a bank
│   ├── rebalance-mcq-positions.mjs         # one-shot remediation: spread correct-answer positions
│   └── trim-correct-tails.mjs              # one-shot remediation: trim long correct-answer texts
└── .github/workflows/
    ├── pages.yml                           # deploy on push to main
    └── validate-banks.yml                  # run validator on every PR touching banks/
```

## Quiz modes

- **Daily** — 15 questions, 30 min, drawn from one day's bank.
- **Weekly general** — 30 questions, 60 min, even spread across the week's days.
- **Weekly distributed** — 30 questions, 60 min, weighted toward topics the learner has missed in prior quizzes (uses localStorage history).

Each question has an explanation that names *why* the correct answer is correct and *why* the runner-up distractor is the tempting wrong one, plus a deep link into `KarsunFDE/content` at the relevant section anchor.

## Progress storage

`localStorage` only — keyed by name picker on first visit (Aaron, Alec, Charles, Kevin, Ronald, or custom). No auth, no backend, no PII. Cohort size of 5–6 doesn't justify cross-device sync; learners stick to one browser per device.

## Regenerating banks

Bank generation runs on a developer machine — the static site only loads the committed JSON.

```bash
# 1. clone content repo (one-time)
gh repo clone KarsunFDE/content ../KarsunFDE-content

# 2. extract per-week source manifest (file paths + heading anchors)
node scripts/extract-sources.mjs \
  --content-root ../KarsunFDE-content \
  --week W01

# 3. invoke the quiz-bank-gen skill (lives in fde-10-week/skills/quiz-bank-gen/)
#    to generate banks/W01/Tuesday.json etc. Prompt template at
#    fde-10-week/skills/quiz-bank-gen/references/prompt-template.md

# 4. validate before commit
node scripts/validate-bank.mjs banks/W01/Tuesday.json
```

The validator enforces:
- **Position bias** — correct answer in any one slot (A/B/C/D) ≤ 30% across the bank
- **Length tell** — correct choice > 1.3× the next-longest distractor in ≤ 25% of MCQs
- **MCQ shape** — exactly 4 choices, exactly 1 correct
- **Multi-select** — ≥1 correct, ≥1 incorrect
- **TF-justified** — exactly 1 correct overall (on the truthful branch only)
- **Source citations** — every question cites ≥1 URL with anchor
- **Explanations** — ≥20 chars

CI runs the validator on every PR via `.github/workflows/validate-banks.yml`. Bad banks don't merge.

## Adding a new learner name

Edit `js/progress.js`:

```js
export const NAMES = ['Aaron', 'Alec', 'Charles', 'Kevin', 'Ronald', 'NewName'];
```

Commit, push, refresh. localStorage namespacing keys by name, so adding doesn't affect existing learners' history.

## Deployment

GitHub Pages → main branch, root. Push to `main` triggers `.github/workflows/pages.yml` which uploads the entire repo as the site. No build step (vanilla HTML + Tailwind CDN).
