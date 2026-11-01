# How to run Program Rundown

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

## Initialize the demo

Run explicitly in dev:

```bash
node --env-file=.env dist/demo/seed.js
```

For source development, export the same environment configuration and run `npm run seed`.
The seed requires `APP_ENV=dev`, `DEV_COORDINATOR_ISSUER`, and `DEV_COORDINATOR_SUBJECT`.
It creates the standalone `Community Gathering` Draft Header, with no date, a 09:00 start, and a 12:00 end.
It adds ordered Sections and Items, including an unheaded closing Section, literal `*Introit`, multiline Detail, and independent optional times.
It also creates `Example Published Program`, already published, so its `/p/<id>` reader link works without signing in.
There are no Events or Participants yet. Nested groups and mini-programs arrive in U5.
The configured coordinator owns every demo Program and can open it immediately after sign-in, including when the seed runs before first sign-in.
Repeating the seed preserves edited Headers and rundown content, including deliberate removal of all content, plus unrelated Programs, sessions, identity mappings, and feedback.
If the operator replaces the configured coordinator subject, rerunning the seed grants that identity ownership of demo Programs only.
Startup applies additive product migrations; startup and deployment never reset or seed data.

## Create and reopen a Draft

Sign in as the configured coordinator and choose **New Program**. Enter a title and choose **Save Draft**.
Date, start time, and end time are independently optional. Times use local clock values; the app does not infer a duration.
Open a saved Program from **Your Programs** or its `/programs/<id>` URL. Its Header survives sign-out and app restart.
Standalone Draft access belongs to its creating coordinator; another identity cannot list, read, or edit it.
Event coordination will grant access to linked Programs when Events arrive in U8.

If another tab saves first, the editor keeps your entries and reports a conflict.
Choose **Reload saved Draft** to see the latest Header. Your unsaved entries remain visible.
Choose **Reapply my entries**, review the Header, then **Save Draft** to save against the latest version.

| Endpoint | Behavior |
| --- | --- |
| `GET /api/programs` | List the signed-in coordinator's standalone Programs. |
| `POST /api/programs` | Create a Draft with `title` and optional `date`, `startTime`, and `endTime`. |
| `GET /api/programs/:id` | Read an owned Program Header, its `status` (`Draft` or `Published`), its `version`, and ordered content `nodes`. |
| `PATCH /api/programs/:id` | Edit Header fields with the last read `version`; stale versions return 409 without writing. |
| `PUT /api/programs/:id/content` | Save `{version, nodes}` atomically; stale versions return 409 without changing content. |
| `POST /api/programs/:id/publish` | Publish an owned Program; returns its reader `url` (`/p/<id>`). Repeating it is harmless. |
| `GET /api/public/programs/:id` | Anonymous read of a Published Program's Header and `nodes`; Drafts and missing Programs return 404. |

Dates use `YYYY-MM-DD`; times use `HH:MM`. Use `null` or an empty string to clear an optional field.
Omitted edit fields retain their values. Blank titles, invalid calendar dates, and malformed times return 400 with field errors.
Unauthenticated requests return 401. Unconfigured identities return 403; inaccessible or missing Programs return 404 for a coordinator.

## Compose a rundown

Open a saved Draft, then choose **Add Section**. Leave its heading blank for an unheaded group.
Choose **Add Item** inside a Section. Enter an Item label, optional free-text Detail, and either time independently.
Use **Move up** or **Move down** with a pointer, or focus a move button and press Enter or Space.
Remove an Item with **Remove Item**. **Remove Section and its Items** removes the entire group from the local draft.
Choose **Save rundown** to persist additions, edits, removals, and order together.
The preview follows the current entries. Wrapped lines and line breaks remain within the same Item.

Header and content saves share a revision. Conflicts preserve rundown entries and offer **Reload saved rundown** and **Reapply my rundown entries**.
Reload replaces the current Header and rundown with saved values. Unsaved Header or rundown entries stay visible to reapply; review them before saving again.
Content nodes have stable `id`, `parentId`, `kind`, `label`, `detail`, `startTime`, and `endTime` fields.
Sections have `kind: "section"`, `parentId: null`, and empty Detail. Items require a label and their Section's ID as `parentId`.
Array order determines sibling order. Content times use `HH:MM` or `null`.
A rundown holds up to 300 nodes; labels hold up to 200 characters, Item Detail up to 10000, and all labels and Detail together up to 60000.

## Publish, share, and print

Save the Header and rundown, then choose **Publish Program**. Publishing stays disabled while either has unsaved changes.
The editor then shows the reader link, `/p/<id>`. Anyone with the link can read the Program without signing in; there is no public directory.
Later saves replace the content at the same link, without version history or another publish step.
Readers choose **Print** or use browser printing; the printed listing omits editor and feedback controls.

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
