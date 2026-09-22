# Daily Arc

Personal to-do list + daily habit tracker. Deployed at [todo.arcx3.com](https://todo.arcx3.com).

## Stack

- Vite + React + TypeScript + Tailwind CSS v4
- Supabase (Postgres + Auth) — shared "ArcX3" project, tables prefixed `dailyarc_`
- Single-user auth: Google OAuth, gated by a `dailyarc_allowlist` table enforced via
  Postgres RLS (`dailyarc_is_allowed()`), same pattern as the rolodex app in this project
- Deployed as a static SPA to Cloudflare Pages

## Local development

```bash
npm install
cp .env.example .env.local   # fill in VITE_SUPABASE_ANON_KEY
npm run dev
```

## Data model

- `dailyarc_categories` — cards like "Daily core", "Family", "Target", etc.
- `dailyarc_tasks` — items within a category
- `dailyarc_completions` — one row per task completed on a given date
- `dailyarc_allowlist` — email(s) permitted to sign in

Each category has a `track_history` flag. Categories with it on show up on the History tab
as a strip of colored dots (green = fully done that day, yellow = partial, red = none).

## Deployment

Static build (`npm run build` → `dist/`) deployed to Cloudflare Pages, DNS pointed at
`todo.arcx3.com`. RLS is the real security boundary — there's no server component.
