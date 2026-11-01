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
That Program has the subtitle `A day of gratitude` and a nested rundown: a `featured` Section containing the `Morning Service` mini-program (with a `Dedication` Section) and a `Closing Program` mini-program with an unheaded labelled Section.
`Community Gathering` includes an Alex Placeholder definition reused in another Program, direct Parts, an intentionally unlisted Part, and an ordered `Pianist` Footer role.
It also creates two date-grouped Events with placeholder rundowns: `Sabbath` (Vesper, Sabbath School, Divine Worship, and AY across two weeks, some published) and `Example Conference` (two dated sessions plus an undated `Conference Welcome`).
It saves `Example Worship Template` from `Community Gathering` once for the configured coordinator.
Some Event Programs have a placeholder Part ready to move or copy, plus an Item that already holds two parallel Parts.
The seed uses placeholder names only and never opens feedback storage.
The configured coordinator owns every demo Program and Event and can open it immediately after sign-in, including when the seed runs before first sign-in.
Repeating the seed preserves edited Headers, rundown content, Parts, Footer roles, Participant definitions, and deliberate removals, plus unrelated Programs, sessions, identity mappings, and feedback.
If the operator replaces the configured coordinator subject, rerunning the seed grants that identity ownership of demo Programs, demo Events, and seed-owned Participant definitions.
Startup applies additive product migrations; startup and deployment never reset or seed data.

## Create and reopen a Draft

Sign in as the configured coordinator and choose **New Program**. Enter a title and choose **Save Draft**.
Date, start time, and end time are independently optional. Times use local clock values; the app does not infer a duration.
Open a saved Program from **Your Programs** or its `/programs/<id>` URL. Its Header survives sign-out and app restart.
Standalone Draft access belongs to its creating coordinator; another identity cannot list, read, or edit it.
The coordinator of an Event can also list, read, and edit every Program linked to it, including Drafts.
Only the coordinator who created a Participant definition can edit or delete it; others who manage a Program using it can still choose it for Parts.

If another tab saves first, the editor keeps your entries and reports a conflict.
Choose **Reload saved Draft** to see the latest Header. Your unsaved entries remain visible.
Choose **Reapply my entries**, review the Header, then **Save Draft** to save against the latest version.

| Endpoint | Behavior |
| --- | --- |
| `GET /api/programs` | List Programs the signed-in coordinator owns or manages through an Event they own. |
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

## Group Programs under an Event

Use the **Events** section on the signed-in home page, or open `/events`, enter a name, and choose **Create Event**. Start and end dates are optional.
Open the Event, select saved Programs under **Add or remove Programs**, order them with **Move up** or **Move down**, then choose **Save Program order and links**.
**Unlink** removes a Program from the list; saving unlinks it, and it keeps its own coordinator and publication status.
A Program belongs to at most one Event; linking it to a second Event returns 409 until it is unlinked from the first.
Tick **Group Programs by their dates** to group by each Program's own date, with undated Programs in an `Undated` group; otherwise the list stays in saved order.

The Event's reader link, `/e/<id>`, lists only its Published Programs to anyone without signing in; Drafts never appear.
Each listed Program opens at `/e/<id>/p/<programId>`, with the same presentation as `/p/<id>`.

| Endpoint | Behavior |
| --- | --- |
| `GET /api/events` | List the signed-in coordinator's Events, each with its ordered `programs`. |
| `POST /api/events` | Create an Event with `name` and optional `startDate`, `endDate`, and `groupByDate`. |
| `GET /api/events/:id` | Read an owned Event and its ordered `programs`, including Drafts. |
| `PATCH /api/events/:id` | Edit Event fields; omitted fields retain their values. The end date must not precede the start date. |
| `PUT /api/events/:id/programs` | Replace the linked Programs with an ordered `programIds` list; Programs omitted from the list are unlinked. |
| `GET /api/public/events/:id` | Anonymous read of an Event and its Published Programs only. |
| `GET /api/public/events/:id/programs/:programId` | Anonymous read of a Published Program linked to that Event; Drafts and other Programs return 404. |

## Save and use a template

Save the Header, rundown, and Parts and Footer, then enter a name under **Save as template** in the Program editor and choose **Save as template**.
Saving stays disabled while any of them has unsaved changes. The template belongs to your account, not the Program's Event, and saving leaves the Program unchanged.
Open **Your templates** from the Programs list, or `/templates`, and choose **Preview and create Draft** for a template.
Enter a title, an optional date, and an optional Event you coordinate, then choose **Create Draft** to open the new Draft.
The Draft copies the nested rundown, Footer roles, and Parts in order with their extra info.
People are not copied: direct names and Participant references are cleared, keeping only a role placeholder where the Part or Participant had a role.
Header dates and times, including mini-program dates and times, are not copied, and the Draft never inherits publication status.
Later edits to the source Program, the template, or a created Draft do not change the others.

Choose **Share template** to let other coordinators see a template, or **Stop sharing** to make it private again; only its owner can change this.
Sharing exposes the template snapshot only, never the source Program or its Event.
Under **Shared templates**, choose **Preview shared template** or **Import a copy**.
Importing creates an independent template in your account and opens it to create a Draft; you must import a shared template before creating a Draft from it.

| Endpoint | Behavior |
| --- | --- |
| `GET /api/templates` | List the signed-in coordinator's own `templates` with their `shared` state, and other coordinators' `sharedTemplates`. |
| `POST /api/templates` | Save a template with `name` and the `programId` of a Program you manage. |
| `GET /api/templates/:id` | Read an owned template's `nodes`, `parts`, and `footer` snapshot; other accounts' templates return 404. |
| `PATCH /api/templates/:id/sharing` | Set an owned template's `shared` boolean; other accounts' templates return 404. |
| `GET /api/templates/shared/:id` | Preview another coordinator's shared template snapshot; private or own templates return 404. |
| `POST /api/templates/shared/:id/import` | Copy another coordinator's shared template into your account as a new, independent template. |
| `POST /api/templates/:id/programs` | Create a Draft from an owned template with `title` and optional `date` and `eventId`. |

## Move or copy a Part

Save any Parts changes first, then choose **Move or copy Part** on a Part.
Pick a **Destination Program** - the current Program or another Program linked to the same Event - and an Item, block, or Footer role.
The panel lists Parts already at that destination; they always stay, and the moved or copied Part is added alongside them.
Choose **Move selected Part here**, **Copy without Participant**, or **Copy everything**.
Copy without Participant keeps Part extra info and any role, clearing names and Participant references; Copy everything keeps the assignment and any shared Participant reference.
Item labels, Detail, and order never move. Standalone Programs and Programs in other Events are not offered.

`POST /api/programs/:id/parts/:partId/transfer` takes `destinationProgramId`, `destinationTargetId`, `destinationTargetKind`, `operation` (`move` or `copy`), `copyMode` for copies (`without-participant` or `everything`), and both Programs' `sourceVersion` and `destinationVersion`.
It changes both Programs atomically, returns 403 across Events or standalone Programs, 409 when either Program changed, and 400 when the destination already has 600 Parts.

## List Participants

Open an Event and choose **View Event Participants**, or open a standalone Program and choose **View Participants**.
The list groups assignments under **Named Participants**, **Text assignments**, and **Awaiting a name**, each with links to its source Parts.
On an Event, **Filter by Program** narrows the list to one linked Program.
See the [Participant list design](concepts.md#participant-list) for grouping and ordering rules.

| Endpoint | Behavior |
| --- | --- |
| `GET /api/events/:id/participants` | List assignments across an owned Event's Programs; optional `programId` limits it to one linked Program. Other Events and unlinked Programs return 404. |
| `GET /api/programs/:id/participants` | List assignments for one Program you can manage; inaccessible Programs return 404. |

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
