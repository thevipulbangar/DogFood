# Deploying a live demo (Netlify + a backend host)

**Read this first:** the hackathon spec is judged against `docker compose
up` running locally — the acceptance suite and the organizers run your
repo on their own machine, not against a hosted URL. Nothing here is
required for submission. This guide exists only if you also want a
clickable live-demo link to share (e.g. in your README or the demo video).

**Why not "just deploy the whole thing to Netlify":** Netlify hosts
static sites and short-lived serverless functions. This platform is a
normal, long-running Express server with a persistent Postgres
connection pool (`backend/`) plus a Next.js frontend (`frontend/`).
Netlify can run the frontend. It cannot run `backend/` or a database —
there's no way to `docker compose up` a stateful Postgres instance on
it. So a "Netlify deployment" of this project is actually **two
deployments**: the frontend on Netlify, and the backend + database
somewhere that runs a real server process.

## Part 1 — Host the backend + database

Pick one (all have free tiers as of writing; verify current pricing
yourself before committing):

- **Railway** (railway.app) — easiest. One project, add a Postgres
  plugin, add a service from your GitHub repo pointed at `backend/`.
- **Render** (render.com) — a "Web Service" for `backend/` plus a
  separate "PostgreSQL" instance.
- **Fly.io** — more control, a bit more setup (`fly.toml`, `fly
  postgres create`).

Steps (Railway as the example — the others are the same shape):

1. Create a Postgres database on the host. Copy its connection string.
2. Run the schema against it once:
   ```bash
   psql "<that connection string>" -f backend/db/schema.sql
   ```
   (or let `backend/db/migrate.js` do it — it runs automatically on
   every backend start, same as in Docker Compose, and is safe to run
   against an already-migrated database.)
3. Create a new service from this GitHub repo, root directory
   `backend/`, build command `npm install`, start command:
   ```
   node db/migrate.js && node db/seed.js && node src/index.js
   ```
4. Set these environment variables on the backend service:
   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | the Postgres connection string from step 1 |
   | `JWT_SECRET` | a long random string — **not** `dev-secret-change-me` from docker-compose.yml |
   | `PORT` | whatever the host expects (Railway/Render set this for you — read it, don't hardcode `8000`) |
   | `APP_URL` | your Netlify frontend URL, once you have it (step 2 below) — used in password-reset emails/links |
5. Deploy. Note the public URL the host gives your backend (e.g.
   `https://dogfood-backend.up.railway.app`) — you need it in Part 2.
6. Sanity check: `curl https://<your-backend-url>/health` should
   return `{"status":"ok"}`, and `curl https://<your-backend-url>/api/gallery`
   should return `[]` or the seeded project.

## Part 2 — Deploy the frontend to Netlify

1. Push this repo to GitHub if you haven't (`git push -u origin main`
   — I can't do this step, I have no push credentials).
2. In Netlify: **Add new site → Import an existing project → GitHub**,
   pick this repo.
3. Netlify will ask for a base directory — set it to `frontend`. It
   should auto-detect Next.js and the `frontend/netlify.toml` already
   in the repo (base build command, Next.js plugin declared).
4. Under **Site settings → Environment variables**, add:
   | Variable | Value |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | the backend URL from Part 1, e.g. `https://dogfood-backend.up.railway.app` (no trailing slash) |
5. Deploy. Netlify gives you a URL like `https://dogfood-2026.netlify.app`.
6. Go back to your backend host (Part 1) and set `APP_URL` to this
   Netlify URL, then redeploy the backend — password-reset links are
   built from `APP_URL`.

## Part 3 — Verify

- Open the Netlify URL, sign in with a seeded account
  (`participant@dogfood.dev` / `password123`).
- Open browser devtools → Network tab, confirm requests go to your
  backend URL, not `localhost:8000`.
- Try the public gallery at `/gallery` — should show the seeded
  project.
- If login fails with a CORS error in the console: the backend's
  `app.use(cors())` in `backend/src/index.js` already allows all
  origins, so this usually means `NEXT_PUBLIC_API_URL` is wrong or the
  backend isn't actually reachable — check the backend host's logs.

## What this setup does NOT give you

- **It's not what gets judged.** The acceptance criteria are about
  `docker compose up` working locally, offline, with no cloud
  dependencies — a hosted demo is a nice-to-have on top, not a
  substitute.
- **It reintroduces the cloud dependencies the platform is designed to
  avoid.** A judge who reads `ARCHITECTURE.md`'s "no hosted database,
  no cloud accounts" framing and then finds the live demo depends on
  Railway/Netlify accounts may reasonably ask about the contradiction —
  be ready to explain this is a demo convenience, not the actual
  submission.
- **Free tiers sleep/spin down.** Both Netlify functions and most free
  backend hosts cold-start after inactivity — the first request after
  a while can take several seconds. Don't be surprised, and consider
  hitting the backend `/health` endpoint shortly before recording your
  demo video.
