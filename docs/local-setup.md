# How to run the U1 shell

Use Node.js 24 and npm. The same Express process serves the JSON API and the built React application on port 3000.

1. Run `npm ci` and `npm run build` from the repository root.
2. Copy `.env.example` to the ignored `.env` file and replace the placeholders locally.
3. Set `APP_ENV=dev` for a development deployment. Set `FEEDBACK_ENABLED=true` only when feedback is wanted.
4. Run `node --env-file=.env dist/index.js`.
5. Open the configured `APP_ORIGIN`. Check `/health` for `{"status":"ok"}`.

The root URL and `/signin` show the shell. `npm run dev` watches server source; run the frontend build after UI changes.
Missing OIDC settings leave health and anonymous feedback available, but sign-in returns an error until configured.

## Configure OIDC

The operator registers a public OIDC client with authorization code, PKCE S256, and token endpoint authentication method `none`.
Set `OIDC_ISSUER` and `OIDC_CLIENT_ID` to that registration. Register the exact redirect URI `${APP_ORIGIN}/auth/callback`.
The app signs out locally through `POST /auth/logout`; it does not terminate the upstream Zitadel session.
No client secret or token is sent to the browser. The maintained [openid-client library](https://github.com/panva/openid-client) validates the exchange and signed ID token.

Set `DEV_COORDINATOR_ISSUER` and `DEV_COORDINATOR_SUBJECT` to the synthetic tester's exact issuer and subject.
Only that identity receives the dev coordinator grant. Other signed-in identities cannot read product data or feedback.
The shell labels the mapped tester `Dev tester` and every other identity `Signed-in user`, rather than copying real identity details into demo records.

Use an HTTPS `APP_ORIGIN` in deployments. Cookies are Secure, HttpOnly, SameSite=Lax, signed, and host-only.
HTTP is accepted only for loopback development/testing. OIDC HTTP transport is likewise restricted to a local mock issuer.
Sessions and short-lived PKCE transactions stay in the product database; logout deletes the current session.
Keep `SESSION_SECRET` private and stable across container replacement. Replacing it invalidates existing cookies.

## Initialize the U1 demo

Run explicitly in dev:

```bash
node --env-file=.env dist/demo/seed.js
```

For source development, use `APP_ENV=dev PRODUCT_DB_PATH=./data/program-rundown.sqlite npm run seed`.
U1 intentionally seeds an empty product collection. There are no Programs, Events, or Participants yet.
The command applies ordered product migrations and preserves existing data, identity mappings, sessions, and feedback.
Startup applies additive product migrations; startup and deployment never reset or seed data.

## Run the container

Build with `docker build -t program-rundown:local .`.
Create separate persistent volumes and run one replica:

```bash
docker volume create program-rundown-product
docker volume create program-rundown-feedback
docker run --name program-rundown --env-file .env -p 127.0.0.1:3000:3000 \
  -v program-rundown-product:/data \
  -v program-rundown-feedback:/feedback-data program-rundown:local
```

The runtime runs as user `node` (UID 1000), exposes port 3000, and checks `/health`.
If bind mounts replace volumes, give UID 1000 write access to each directory.
Preserve `/data/program-rundown.sqlite` and `/feedback-data/feedback.sqlite`, including SQLite WAL sidecars, during replacement.
Use a SQLite-aware backup or stop the app before copying database files. The platform's PostgreSQL backups do not cover these files.
Feedback needs its own operator retention and backup arrangement before valuable testing begins.

## Enable and inspect feedback

Feedback activates only when both `APP_ENV=dev` and `FEEDBACK_ENABLED=true` are set.
The default disables feedback. `APP_ENV=production` always disables it, even with the flag enabled.
`NODE_ENV=production` only controls optimized runtime behavior; it does not select the deployment environment.
Disabled deployments do not open the feedback file, render feedback controls, or serve `/feedback` or its API routes.

Anyone using the internal dev shell can create a note, including from `/signin`.
Only the configured tester session can list notes at `/feedback`, read individual notes, or mark them done/reopen them.
The picker follows Steward's feedback pattern and captures structural selectors, safe leaf text, bounding boxes, and viewport dimensions.
It blocks the selected control's action. General notes need no element.
Context drops queries, fragments, URLs, callback paths, form values, and arbitrary page titles.
Notes remain readable when their target disappears. Notes render as text; do not enter credentials into note text.

| Endpoint | Behavior |
| --- | --- |
| `POST /api/feedback` | Create a 1–4000 character note; returns its ID. Anonymous creation is allowed in dev. |
| `GET /api/feedback?after=<id>` | Tester only; newer notes, newest first. |
| `GET /api/feedback/:id` | Tester only; one note and its saved context. |
| `PATCH /api/feedback/:id` | Tester only; `{ "done": true }` or `{ "done": false }`. |

Mutation requests require same-origin JSON. Readback requires a valid server-side session; the client cannot grant access.

## Deployment handoff

This repository does not provision hosts, runners, OIDC clients, synthetic users, or portal entries.
The operator follows [the build plan's deployment path](build-plan.md#path-to-the-first-dev-deployment).
The private portal credential entry remains `apps.program-rundown`; no credential values belong in this repository.

The workflow tests and builds PRs on GitHub-hosted runners without pushing images.
Trusted `main` pushes test and publish one `sha-<commit>` GHCR image; the workflow exposes its digest as a job output and in the summary.
The main Firstmate deploys each published digest to dev from another host.
This repository does not use a deploy job, deploy runner, repository deployment variables, or a `dev` environment.
Real HTTPS, Zitadel sign-in, and portal checks remain deployment verification.
