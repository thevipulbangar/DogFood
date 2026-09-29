# Dogfood 2026 — Frontend

Self-hostable hackathon submission & judging platform. Next.js 16 · React 19 · TypeScript · Tailwind v4 · Motion · Lucide.
Runs fully offline: fonts are bundled (`geist`), there are no CDNs, and all data is seeded locally.

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
npm run check      # scoring / normalization self-check
```

Sign in with any demo account on `/signin` (participant, judge, organizer, admin). Each role gets its own navigation and dashboard.

## Map

| Route | What |
|---|---|
| `/` | Landing — hero, horizontal lifecycle scroll, platform reveal, spec tiers, self-hosting |
| `/gallery`, `/gallery/[id]` | Public gallery (submitted projects only) |
| `/embed?track=` | Embeddable gallery for iframes |
| `/dashboard` | Role-aware control center |
| `/projects`, `/projects/[id]` | Gallery + project dossier (judging panel, comments, audit history) |
| `/teams`, `/submission` | Team workspace, invite link, submission builder with autosave |
| `/judging`, `/judging/[id]` | Judge queue + focused scoring session (J/K, 1–4, S, Enter, Esc) · organizer judging ops |
| `/voting` | Community vote (randomized order, 3 votes, rate limit, hidden tally) + integrity monitor |
| `/results`, `/certificates` | Cinematic results preview (staff) / sealed state · verifiable certificates |
| `/analytics`, `/admin`, `/audit` | Charts · configuration, roles, rubric, assignments, import/export, API, system · event ledger |

`⌘K / Ctrl K` opens the command palette; `G` then a letter jumps between sections.

## Structure

- `app/globals.css` — design tokens (colors, type, radius, easing) in one `@theme` block
- `components/ui` — primitives: buttons, badges, panels, tabs, toasts, states, event grid, generative previews
- `components/{navigation,landing,dashboard,projects,judging,voting,teams,submission,results,admin,charts}`
- `lib/data.ts` — deterministic seed data · `lib/scoring.ts` — weighted scores & z-score normalization · `lib/rbac.ts` — UI routing rules

Route visibility in `lib/rbac.ts` controls what the UI shows only; the server is the authority on every permission.
