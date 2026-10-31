# Program Rundown build plan

Build and deploy a small application first, then add complete coordinator and reader workflows through thin vertical slices.
The first dev deployment includes sign-in, persistent feedback, and a test user whose demo data grows with each slice.

This plan implements [the concepts](concepts.md), including the captain's settled coordinator decisions.
Each numbered slice ships through no-mistakes as its own PR, with data, server, UI, and CI evidence together.
This documentation PR uses direct review; it adds no application code or platform configuration.

## Product contract

Coordinators compose Programs; readers follow shareable, printable published listings.
The application must preserve these requirements from the concepts:

| ID | Requirement | Delivery |
| --- | --- | --- |
| R1 | Standalone Programs have a required title, optional date, and independently optional start and end times. | U2 |
| R2 | Ordered Sections and Items support free-text Detail, unheaded Sections, nesting, mini-program Headers, optional times, and optional block labels. | U3, U5 |
| R3 | Coordinators can read Drafts and publish Programs. Later edits replace the published content, without version history. | U2, U4 |
| R4 | Coordinators manage flexible Parts, Part extra info, reusable Participants, Roles, and Footer standing roles. | U6, U7 |
| R5 | An optional Event links and orders complete Programs, optionally grouped by each Program's own date. | U8 |
| R6 | Parts move within their Program or between Programs linked to the same Event, never across Events. | U9 |
| R7 | Blank, omitted, and role-only Parts without named holders count as unassigned. Extra info alone does not assign anyone. | U10 |
| R8 | The Participant list covers the whole Event and can be filtered to one Program. | U11 |
| R9 | Dev has one synthetic test user, accessible demo data, portal registration, and feedback absent from production. | U1 onward |

R6–R8 are settled decisions, replacing the three earlier open questions.
A standalone Program permits internal Part moves; sharing no Event does not authorize moves between two standalone Programs.
Participant group text remains valid without enumerating individuals.

Recurrence, dated Event occurrences, and copy-forward remain deferred entirely.
Event logistics, attendance, venue booking, ticketing, and rehearsals remain outside the product.
Realtime collaboration, publication history, and custom PDF generation are outside this first build; browser printing supplies the initial printable listing.

## Architecture and stack proposal

Use the Steward prototype's one-container pattern, with real identity and isolated feedback storage.
The following choices are proposals for implementation, grounded in the inspected references rather than existing Program Rundown code.
The repository currently contains only its README and concepts document.

| Choice | Proposal and rationale |
| --- | --- |
| Application | Node.js 24, TypeScript, Express JSON API, and a React/Vite frontend served by the same process. Steward demonstrates this deployment shape. |
| Product database | SQLite in a persistent volume, with explicit, ordered migrations and foreign keys. This matches Steward and keeps the initial dev application small. |
| Feedback database | A second SQLite file in a separate persistent volume, opened only by the optional feedback module. Product migrations and demo seeds never open it. |
| Identity | Zitadel OpenID Connect authorization-code flow with PKCE, using server-side sessions and secure, HttpOnly cookies. Use a maintained OIDC client library. |
| Authorization | Server checks on every read and mutation. The dev test subject receives a narrowly configured coordinator grant; broader policy awaits Q1. |
| Validation | Server-owned domain validation and database constraints; share display rules with the frontend where practical. The browser never determines permissions. |
| Rendering | One Program renderer for coordinator preview, published reading, and print CSS. Escape entered text and keep block labels separate from executable CSS. |
| Packaging | Multi-stage Docker build, non-root runtime, one port (`3000`), `/health`, and persistent product and feedback mounts. Pin dependencies and image versions during U1. |
| Tests | Node server/domain integration tests, React Testing Library/Vitest component tests, and Playwright browser journeys. Use temporary databases and dynamic ports. |

Use public frontend dependencies initially.
Steward's `@adventistasia` packages require explicit package access; this personal repository must not assume its workflow token can download them.
Adopting those packages later requires a verified access grant and a BuildKit secret during installation, as Steward demonstrates.

SQLite makes this a single-instance application: keep one app replica and serialize database writes in transactions.
The platform's shared PostgreSQL service remains an alternative if concurrency or operations require it later.
Its PostgreSQL dumps do not back up these SQLite files.
Dev product data can be recreated from the seed; feedback needs a separate operator backup and retention arrangement before valuable testing begins.
Production storage and restore readiness require a later operational design.

The runtime boundary is small: the browser reaches Traefik, which forwards to the app container on the apps VM.
The browser also visits Zitadel through Traefik for sign-in; the app completes OIDC and retains the resulting session server-side.
Only the app process accesses its SQLite volumes.
The feedback module receives its own connection and mounts through one optional shell integration point.

### Data and server boundaries

Add schema only as each slice needs it, rather than implementing the entire model in U1.

| Area | Proposed records and invariants |
| --- | --- |
| Identity | External issuer/subject mapping, session records, and coordinator grants. Authentication identities are separate from Participants. |
| Program | Stable ID, Header fields, `draft`/`published` status, optional Event link, and a revision counter for conflict detection. |
| Content | Ordered nodes with Program ID, parent ID, and kind: Section, mini-program, or Item. Check allowed parents and prevent cycles. |
| Ordering | Transactional sibling ordering; moving content preserves descendant ownership. Root content contains Sections or mini-programs; Items belong to Sections. |
| Parts | An optional assignment attached to an eligible node or Footer entry, plus independent extra-info fields. Omitted assignments remain representable without placeholder people. |
| Part values | Explicit blank, free text, role, structured role/name, and Participant reference forms. Store stable reference IDs and the selected name/role display mode. |
| Participants | Reusable definitions with role, optional name, honorific, position, organization, and subtitle. Preserve Program context; cross-Program reuse policy awaits Q5. |
| Footer | Ordered standing-role entries with the same Part rules, including group text for multiple holders. Footer entries are outside the activity sequence. |
| Event | Name, optional dates, linked Program ordering, and optional date-grouping preference. Date groups derive from Program dates, never occurrence records. |
| Feedback | Independent note ID, timestamp, route, sanitized page context, optional element context, reporter label, and done state. No foreign keys into demo tables. |

Keep routes thin and put assignment display, unassigned classification, tree validation, and move authorization in domain modules.
Save an edit atomically and check the expected revision to prevent silent lost updates.
The revision counter detects conflicts; it does not store publication versions.
After a successful edit to a Published Program, its existing reader URL shows the replacement content immediately.
Draft read restrictions apply to detail routes, listings, Event pages, print routes, and participant aggregation alike.

Suggested implementation areas are `src/auth/`, `src/domain/`, `src/api/`, `src/db/migrations/`, `src/demo/`, and `web/src/`.
Keep feedback self-contained in `src/feedback/` and `web/src/feedback/`.
Tests belong in `test/`, frontend component directories, and `e2e/`; these are proposed paths, not files added by this PR.

## Dev deployment and identity

### Checked platform conventions and personal-repository differences

The platform supports immutable GHCR deployment through `deploy-app`; it does not build source on the apps host.
Steward's inspected Dockerfile and workflow demonstrate one application container, self-hosted CI, a registry image, and a `deploy_dev` job.
The platform's newer generic template instead runs PR checks on GitHub-hosted runners.
Use that safer PR boundary for this public repository while retaining self-hosted CI for trusted deployment-branch pushes.

| Concern | Program Rundown adaptation |
| --- | --- |
| Source | `ryannmicua/program-rundown`, a public personal repository; do not substitute an `adventistasia` owner. |
| Image | Publish `ghcr.io/ryannmicua/program-rundown:sha-<commit>` and deploy `ghcr.io/ryannmicua/program-rundown@sha256:<digest>`. |
| Helper allowlist | Commit `stacks/apps/program-rundown/image-repo` containing `ghcr.io/ryannmicua/program-rundown` in dev-platform. The default accepts only the organization namespace. |
| CI runners | Organization `ci` runners do not automatically serve this personal repository. Arrange a repository-scoped `ci` runner on an approved Docker-capable CI host. |
| Deploy runner | Register a repository-scoped runner for `https://github.com/ryannmicua/program-rundown` on `its-runner-dev-01`, labelled `deploy-dev`. |
| Runner selection | Use `[self-hosted, linux, ci]` for trusted build/check jobs and `[self-hosted, linux, deploy-dev]` for deployment. Omit `group: deploy-runners`. |
| Shared group | The organization group selects organization repositories and explicitly excludes public repositories. `add-repo program-rundown` does not solve this ownership boundary. |
| Repository variables | Set `DEV_DEPLOY_BRANCH=main` and `DEV_DEPLOY_HOST` to the exact approved apps-host SSH target. Create the `dev` environment in this repository. |
| Registry permissions | The build job needs `packages: write`; deployment needs `packages: read`. Confirm the package grants this repository's workflow token access. |
| Private runtime settings | Keep OIDC settings, session secrets, coordinator subject mapping, feature flags, and mount paths in the app's host-local environment. Commit examples with placeholders only. |

SSD IT Ops or the platform operator owns runner registration, SSH keys, host provisioning, DNS, and identity configuration.
The deploy runner needs the forced-command `deploy-app` key and verified host keys through its SSH configuration.
Keep this repository's runner away from the shared convergence key and other repositories' credentials.
Untrusted PR code must never run on a runner with deployment credentials: run PR tests and image-build proof on GitHub-hosted runners.
Only trusted pushes to the configured deploy branch may use the repository's self-hosted build and deploy runners.

### Path to the first dev deployment

1. In dev-platform, prepare a reviewed stack, environment example, both TLS route templates, `image-repo`, and portal registry entry.
   Allocate an unused host port from `18100–18999`; match the route backend to the private `APP_HOST_PORT`.
   Add persistent mounts for `/data/program-rundown.sqlite` and `/feedback-data/feedback.sqlite`; the generic no-database template needs these additions.
2. Merge that platform change before installation, then arrange private provisioning through the platform operator.
   Set `APP_IMAGE`, `APP_CONTAINER_PORT=3000`, `APP_HOST_PORT`, and `APP_HEALTH_URL` for the existing stack.
   Follow the current GitOps guide; do not run `scripts/new-app` in the aligned host checkout because it also changes tracked files.
3. Arrange repository-scoped runners, package access, repository variables, OIDC registration, and the synthetic test user described below.
   The proposed app hostname is `program-rundown.dev.in.ssd.org`; verify allocation before publishing links or registering redirect URIs.
4. Add `.github/workflows/deploy.yml` during U1.
   PR jobs test and build the container without pushing; trusted `main` pushes test, build once, publish, and pass the resulting digest to `deploy_dev`.
   Send the short-lived registry token on SSH stdin to `deploy-app`; never put it in command arguments or host files.
5. Converge apps before edge from the reviewed platform revision.
   `deploy-app` updates the existing stack, checks its health URL, and restores the previous digest if health fails.
   Keep schema migrations additive and compatible with the previous image; image rollback does not reverse database changes.
6. Verify HTTPS routing, sign-in, feedback creation/readback, and database persistence across an app restart.
   Confirm the portal's app link and health entry, then extend the demo as later slices land.

Serialize deployments for this app and avoid cancelling an active migration or deployment.
Record the deployed commit and digest in the workflow summary.
Future slices include deployment smoke evidence after merging; CI independently proves their behavior before merge.

### Portal and synthetic test user

The portal is **`https://portal.dev.in.ssd.org/`**; `https://dev.in.ssd.org/` redirects to it.
It is the static internal development portal on the apps VM, not the Zitadel console or a public account-registration service.
The non-secret registry identifies Zitadel as the development sign-in service and links its Login UI at `https://auth01.dev.in.ssd.org/ui/v2/login/`.
Program Rundown's proposed integration uses that Zitadel issuer through OIDC; the docs do not establish an existing Program Rundown client or account.

During U1 deployment, the authorized operator will:

1. Register a Program Rundown OIDC application with exact callback and logout URLs for the verified app hostname.
2. Create **one synthetic dev-only test user**, then map its issuer and subject to the app's dev coordinator grant.
   Use a placeholder display name such as `Riley Placeholder`; do not use a real person's identity or an initial platform-owner account.
3. Add `program-rundown` to dev-platform's `portal/registry.json`, with this repository URL and verified app and health links.
4. Store the new test user's username and password only in **`/opt/dev-platform/portal/credentials.json` on the apps/portal host**.
   The entry is keyed by **`apps.program-rundown`**, matching the registry ID.
   Follow mode `0600`, or group `devplatform` and mode `0640` for convergence, as the portal reference specifies.
5. Render/deploy the portal through its approved workflow.
   The renderer merges that private entry into host-local `portal/runtime/index.html`, where the internal portal displays synthetic dev-only credentials.
6. Sign in as that test user during deployment verification and confirm access to seeded demo records.

The credentials location comes from dev-platform's `docs/how-to/register-dev-app.md`, `docs/reference/dev-portal.md`, and `docs/reference/configuration.md`.
No credential values, private files, portal-rendered HTML, or real identities were read or copied for this plan.
This task creates no accounts and changes no portal or infrastructure state.
The test user is a future deployment deliverable; this plan does not search for or assume an existing test user.

### Demo data

Use deterministic fixtures with stable seed keys, placeholder names, and fixed dates.
Run the seed explicitly in dev after migrations, scoped to demo records; never reset data automatically on startup or deploy.
Repeated seeds must not duplicate records or overwrite subsequent coordinator edits.
Offer an explicit dev-only reset later if useful; it must exclude feedback, identity mappings, sessions, and unrelated records.

| Fixture | Coverage as its slice becomes available |
| --- | --- |
| Standalone `Community Gathering` | No Event; Draft; an unheaded closing Section; nested `Morning Service` and `Dedication` mini-programs. |
| Event `Sabbath` | Vesper on November 6, 2026; Sabbath School, Divine Worship, and AY on November 7. Several complete Programs share one date. |
| Another week of `Sabbath` | Separate Vesper and Divine Worship Programs on November 13–14. These are explicit Programs, without recurrence or copy-forward. |
| Event `Example Conference` | Two dated session Programs and an undated Program. Provides a second Event for forbidden cross-Event move checks. |
| Sections and Items | `Call to Worship`, `The Spoken Word`, `*Introit`, `Prayer`, and `Closing Remarks`; include start-only, end-only, both, and neither. |
| Participants | `Riley Placeholder` as coordinator credit, `Alex Placeholder` as Speaker, `Jamie Example` for reading/prayer, and `Morgan Pianist` for music. |
| Assignment variants | Blank; extra-info-only; `Congregation`; `Pat Example and Lee Example`; standalone `Speaker`; structured role with/without a name; references by name/role. |
| Participant details | `Dr.`, `Education Director`, `Example Conference`, and a subtitle on the Speaker; Part topic `A Life of Service` stays separate. |
| Publication | At least one Published and one Draft Program in an Event, demonstrating independent status and draft visibility rules. |

Grant the synthetic test user access to every demo Program and Event.
Do not seed unsupported future structures early: U1 has an empty product collection and working feedback; U2 adds Program headers; later slices add their fixtures.
Full demo events, programs, parts, and participants become available by U8.
U9–U11 extend those fixtures for move, unassigned, and participant-list verification.

## Ordered vertical slices

Ship in the order below. Each slice includes its migration, API behavior, UI, seed extension, and tests; none is a database-only or UI-only milestone.
U1 deliberately dedicates the walking skeleton to dev feedback, so feedback is its own early slice and is live on the first dev deploy.
Program authoring begins in U2, independently of the feedback module.
Dependencies on new product questions are explicit; the settled R6–R8 choices do not block planning.
This is the default delivery order. U10 and U11 can proceed from their listed dependencies while U9 awaits a product answer.

### 1. U1 — Deployed walking skeleton with isolated dev feedback

**Goal and outcome:** The tester signs into the dev app shell and leaves a note on any app page, optionally selecting an element.

**In:** Container, product database connection/migration boundary, OIDC session, dev coordinator grant, health, CI/deployment, synthetic user, portal registration, and feedback.
Keep feedback routes and UI in optional modules, with their own SQLite file and persistent mount.
**Out:** Program editing, Event grouping, and production feedback.

**Acceptance and tests:**

- The first deployment passes health and sign-in checks; a note persists across reload and container replacement.
- A note stores page context and optional element selector/text/viewport; selection does not trigger the selected control's normal action.
- `/feedback` lists notes. `GET /api/feedback?after=<id>` returns newer notes; `GET /api/feedback/:id` retrieves one note.
- `POST /api/feedback` creates a note; `PATCH /api/feedback/:id` marks done or reopens it. Notes remain readable when a selected element disappears.
- `APP_ENV=dev` plus explicit `FEEDBACK_ENABLED=true` enables the module; the default disables it, and production always refuses activation.
- `APP_ENV` identifies the deployment environment. An optimized dev container may still use `NODE_ENV=production`; that build setting does not enable feedback.
- Disabled deployments render no widget or feedback page and return 404 for feedback APIs. Product seeds/migrations leave the feedback file unchanged.
- Reject blank/oversized notes; sanitize page context to exclude tokens, passwords, and OIDC callback queries. Render notes as escaped text.
- Allow note creation on any app page, including sign-in, within the internal dev deployment. Record the tester label only when a session exists.
- Restrict readback and done/reopen actions to the configured dev tester session; this tightens Steward's anonymous readback.

**Files and proof:** `src/feedback/`, `web/src/feedback/`, `test/feedback.test.ts`, `test/auth.test.ts`, `e2e/dev-shell.spec.ts`, `Dockerfile`, `.github/workflows/deploy.yml`.
Follow Steward's feedback UI/API pattern, while adding the separate file and environment gates required here.
**Dependencies:** Platform/operator prerequisites above; no unresolved product question blocks this single-test-user dev shell.

### 2. U2 — Save and reopen a standalone Draft

**Goal and outcome:** The coordinator creates a Program Header and can read the saved Draft after signing in again.

**In:** Program persistence, create/list/detail/edit APIs, title/date/start/end form, validation, and the first seed Program.
**Out:** Sections, publishing, Event linking, and general coordinator administration.

**Acceptance and tests:**

- Save a required title with no date or times; reopen the same Program after a process restart.
- Save start-only, end-only, both, and neither independently. No implicit duration or required paired time appears.
- The dev test user can read its Draft; an unauthenticated request cannot read or mutate it.
- Blank titles and malformed dates/times return useful errors without partial writes; stale edits show a recoverable conflict.

**Files and proof:** `src/api/programs.ts`, `src/db/migrations/`, `web/src/programs/`, `test/programs.test.ts`, `e2e/draft.spec.ts`.
**Dependencies:** U1. Q1 must be settled before extending access beyond the configured dev tester.

### 3. U3 — Compose a simple ordered rundown

**Goal and outcome:** The coordinator builds a readable Program from Sections and Items and changes their order.

**In:** Headed/unheaded Sections, Item labels and free-text Detail, optional independent times, add/edit/remove, and sibling ordering.
**Out:** Nested groups, mini-programs, Parts, and publication.

**Acceptance and tests:**

- Add two Sections and several Items; reorder with pointer and keyboard controls, reload, and see the same order.
- An unheaded Section remains a group; `*Introit` preserves its literal leading character.
- An end-only Item and a start-only Section save successfully; line wrapping does not create additional Items.
- Reject invalid parent kinds and stale order updates; a failed mutation leaves the saved tree unchanged.

**Files and proof:** `src/domain/content.ts`, `src/api/content.ts`, `web/src/editor/`, `test/content.test.ts`, `e2e/compose.spec.ts`.
**Dependencies:** U2; none of the open product questions.

### 4. U4 — Publish, share, and print the current Program

**Goal and outcome:** A coordinator publishes a Draft and a reader follows or prints its current content.

**In:** Publish action, reader URL, server-enforced visibility, shared renderer, mobile reading, and print CSS.
**Out:** Version history, staged edits to published content, custom PDF generation, and Event-wide publication.

**Acceptance and tests:**

- A coordinator previews a Draft; a reader cannot retrieve it through direct URLs or APIs.
- Publish and open the reader URL under the access policy selected in Q2.
- Edit a Published Program; the same URL shows the replacement without another version or publication step.
- Print the listing without editor controls or feedback. A narrow viewport keeps labels and content readable.

**Files and proof:** `src/api/publication.ts`, `web/src/reader/`, `test/publication.test.ts`, `e2e/publish-print.spec.ts`.
**Dependencies:** U3; Q2 for reader access, and Q1 if multiple coordinators are introduced.

### 5. U5 — Compose nested Sections and mini-programs

**Goal and outcome:** The coordinator represents a Program within a Program without confusing it with a separate Event-linked Program.

**In:** Nested Sections/mini-programs, mini-program Headers and dates, optional independent times, block labels, subtree ordering, preview and print integration.
**Out:** Separate Program moves, Event links, and a custom stylesheet/settings editor.

**Acceptance and tests:**

- Compose `Community Gathering → Morning Service → Dedication`; persist and render the same hierarchy in preview, reader, and print.
- Put a mini-program inside a Section and a Section inside a mini-program; reject cycles and cross-Program parent references.
- Preserve an unknown block label and an unheaded labelled Section; `featured` imposes no special content shape.
- Group times remain optional and independent of child times. Labels never become raw HTML or executable style content.

**Files and proof:** `src/domain/content.ts`, `web/src/editor/`, `web/src/reader/`, `test/nesting.test.ts`, `e2e/nesting.spec.ts`.
**Dependencies:** U4; none of the open product questions.

### 6. U6 — Manage direct Parts and Footer standing roles

**Goal and outcome:** The coordinator assigns, changes, and clears who leads Items, Sections, mini-programs, and Footer roles.

**In:** Blank, text, role, and structured role/name Parts; independent extra info (title, topic, name, description); ordered Footer entries; editor, reader, and print rendering.
**Out:** Participant references, moving assignments, and participant aggregation.

**Acceptance and tests:**

- Add, update, and clear every supported direct Part form on each eligible target; activity labels and Detail remain unchanged.
- A structured name displays when supplied; an absent/blank name falls back to its role. Standalone roles remain valid.
- Preserve `Congregation` and a multi-person text value without splitting names; extra info can accompany a blank value.
- Footer credits do not become timed activities. A rejected assignment edit leaves previous content intact.

**Files and proof:** `src/domain/parts.ts`, `src/api/parts.ts`, `web/src/parts/`, `test/parts.test.ts`, `e2e/assignments.spec.ts`.
**Dependencies:** U5; none of the open product questions for direct values.

### 7. U7 — Reuse Participant definitions by name or role

**Goal and outcome:** The coordinator defines a Participant once and reuses the definition in repeated Parts and Footer credits.

**In:** Participant CRUD, reference selection/display mode, role-only definitions, honorific/subtitle/position/organization, and reference validation.
**Out:** Event aggregation and automatic identity matching between Programs.

**Acceptance and tests:**

- Define `Alex Placeholder` as Speaker; reference the definition by name and role on Items, blocks, and Footer entries.
- A role reference displays the name when present, otherwise the role label; changing the definition updates its references.
- Participant position/organization/subtitle remain separate from Part extra info and Item Detail.
- Prevent dangling references and accidental name-based identity merging; explicitly select the intended definition when labels collide.

**Files and proof:** `src/domain/participants.ts`, `src/api/participants.ts`, `web/src/participants/`, `test/participants.test.ts`, `e2e/participant-reuse.spec.ts`.
**Dependencies:** U6; Q5 before introducing shared definitions across Programs.

### 8. U8 — Group complete Programs under an optional Event

**Goal and outcome:** The coordinator links and orders Programs in an Event; readers find released Programs together, optionally grouped by date.

**In:** Event name/optional dates, nullable Program link, link/unlink/reorder UI and API, optional date grouping, Event listing, and full demo fixtures.
**Out:** Recurrence, occurrences, copy-forward, logistics, and publishing an Event as a unit.

**Acceptance and tests:**

- Link Friday Vesper and Saturday Sabbath School, Divine Worship, and AY to `Sabbath`; retain each complete Program's Header and status.
- Show several Programs on one date, preserve their order, and offer a clear undated group without inventing a date.
- Toggle date grouping, edit a Program's date, and verify derived grouping after reload. Flat ordering remains available.
- Unlink a Program and keep it independently readable under its existing publication rules; reject a simultaneous second Event link.
- Reader Event pages omit Draft titles/content, while the authorized coordinator can open Drafts. Publishing one Program leaves the others unchanged.

**Files and proof:** `src/api/events.ts`, `web/src/events/`, `src/demo/`, `test/events.test.ts`, `e2e/event-grouping.spec.ts`.
**Dependencies:** U7 and U4's reader policy; Q1 before sharing Event coordination beyond the dev tester.

### 9. U9 — Move Parts within a Program or its Event

**Goal and outcome:** The coordinator relocates an assignment quickly while keeping the activity itself in place.

**In:** Choose a Part, choose a destination Item/block/Footer entry, preview context, confirm, and atomically relocate its assignment and extra info.
Permit internal moves and moves between Programs linked to the same Event; verify permissions on both sides.
**Out:** Cross-Event moves, moves between standalone Programs, and copying or moving the activity itself.

**Acceptance and tests:**

- Move within nested content and between two Programs linked to `Sabbath`; source assignment clears and target receives the same value/extra info.
- Keep Item labels, Detail, ordering, and Participant descriptive fields unchanged.
- Reject `Sabbath → Example Conference`, standalone-to-other-Program, unauthorized, and stale destination requests without changing either side.
- Apply the selected occupied-target policy from Q3 and Participant reference policy from Q5, including cancellation and failed-transaction cases.
- Keyboard selection offers the same destinations as pointer interaction; Draft restrictions remain enforced when choosing destinations.

**Files and proof:** `src/domain/move-part.ts`, `src/api/parts.ts`, `web/src/parts/`, `test/move-part.test.ts`, `e2e/move-parts.spec.ts`.
**Dependencies:** U8; Q3 and Q5. Move boundaries are already settled by R6.

### 10. U10 — Review Parts awaiting a named assignment

**Goal and outcome:** The coordinator finds unassigned Parts and opens the corresponding editor directly.

**In:** Server-derived status, review list/filter, links to Items/blocks/Footer entries, and automatic refresh after assignment edits or moves.
**Out:** Requiring every activity to have a Part, reminders, and automatic assignment.

**Acceptance and tests:**

- Include blank and omitted values, including extra-info-only Parts, plus standalone roles and structured roles without names.
- Include role references whose Participant lacks a name; assigning a name removes them from the unassigned result.
- Keep free text such as `Congregation` valid. Do not infer the meaning of `TBA` or split group text into unnamed people.
- Preserve an unassigned Part's full content when opening and saving it; exclude inaccessible Drafts from any cross-Program query.

**Files and proof:** `src/domain/unassigned.ts`, `web/src/assignments/`, `test/unassigned.test.ts`, `e2e/unassigned.spec.ts`.
**Dependencies:** U7 and U8; extend move-related browser coverage when U9 lands. R7 settles role-only classification.

### 11. U11 — List Participants across an Event, filterable by Program

**Goal and outcome:** The coordinator sees who takes Parts throughout an Event and narrows the list to one Program.

**In:** Event aggregation, Program filter, assignment locations, group-text representation, and traceable links to source Parts.
**Out:** Attendance tracking, contact directories, notifications, and inferring individual names from group strings.

**Acceptance and tests:**

- List Participants from nested content and Footer roles across `Sabbath`; selecting Divine Worship limits results to that Program.
- Apply Q4's identity/group handling without losing repeated assignment locations or merging distinct people solely because their names match.
- Assign, clear, or move a Part and verify the list updates; omit unused Participant definitions from people actually taking Parts.
- Enforce Draft permissions before aggregating. Empty Events and Programs produce useful empty states.
- Preserve standalone Program usability according to Q4's standalone-list answer.

**Files and proof:** `src/domain/participant-list.ts`, `src/api/participants.ts`, `web/src/participants/`, `test/participant-list.test.ts`, `e2e/event-participants.spec.ts`.
**Dependencies:** U7 and U8; Q4 and any cross-Program reuse decision from Q5. Event scope and Program filtering are settled by R8.

## Open product questions

The captain has settled the original move-boundary, role-only classification, and participant-list-scope questions in R6–R8.
The following questions are newly surfaced and remain unresolved; no default here settles them.
They block only the named extension or slice, so U1 can proceed.

| ID | Question | Affected work |
| --- | --- | --- |
| Q1 | Who may coordinate each Program and Event? Does Event coordination grant access to every linked Draft, or are Program permissions separate? | Multi-coordinator access in U2/U4/U8–U11. U1 uses only the explicit dev test-subject grant. |
| Q2 | May any internal visitor with a published URL read it, or must readers authenticate? Should published Programs appear in discoverable listings? | U4 reader routes and U8 reader Event pages. |
| Q3 | When a Part's destination already has an assignment or extra info, should moving replace, swap, merge, or refuse? | U9 occupied destinations; no silent overwrite policy. |
| Q4 | How should the list combine repeated Participants across Programs, free-text names, group text, and unnamed roles? What list should a standalone Program offer? | U11 presentation and identity rules. Whole-Event scope with a Program filter stays settled. |
| Q5 | Are Participant definitions shared between Programs? When a referenced Part crosses Programs, should both reuse one definition or should the destination receive a copy? | U7 cross-Program reuse, U9 reference moves, and U11 identity aggregation. |

Platform details are implementation prerequisites rather than product choices: hostname/port availability, OIDC client registration, and runner provisioning require operator verification.
Do not replace these unknowns with credential values or assume the corresponding resources already exist.

## CI validation and slice completion

U1 establishes reproducible npm scripts and lockfiles; later slices extend the same checks.
Use typechecking, lint, server/domain tests, frontend component tests, a production frontend build, and image-build proof on every application PR.
Browser CI runs against the built frontend and real API with isolated temporary SQLite files.
An isolated local OIDC test issuer proves redirects, callback checks, session creation, expiry, and denial without depending on private dev credentials.
The deployed dev smoke separately proves integration with real Zitadel and the synthetic test user; keep credentials out of logs and artifacts.

Each slice must satisfy these gates before completion:

1. Its listed acceptance cases pass across the database, API, and UI; permission and failed-write cases assert unchanged persisted state.
2. Migrations work from empty and previous-slice databases; replay is safe, and the previous app image remains compatible where rollback is promised.
3. Seeds are repeatable, use placeholders, grant the test user access, and preserve feedback and subsequent edits.
4. CI proves the production frontend and container build. U1 also tests feedback-disabled behavior, including production refusing activation.
5. A focused browser journey covers the new outcome at desktop and narrow mobile widths, with keyboard access for changed controls.
6. The slice completes no-mistakes in its own PR. After merge, the deployment workflow publishes and deploys its exact digest and records health/smoke evidence.

Use unique temporary directories and ephemeral ports so CI jobs can share a runner safely.
Stop only test processes started by the current run.
Capture unexpected environment requirements in the repository's future testing runbook as implementation discovers them.
This planning PR does not claim any application tests, identity provisioning, or deployments have run.

## Research sources

Checked on October 31, 2026 through `gh-axi` and the named local Steward reference.
The product baseline is commit `be7f2734b7e58da04d35eac08df0d77db4cd731a`; the inspected dev-platform baseline is `37924668716ca6bb5080639df708278e43738f79`.
The concepts changes in this PR apply the captain's subsequent decisions; this plan preserves the remaining product scope.

- [Product concepts baseline](https://github.com/ryannmicua/program-rundown/blob/be7f2734b7e58da04d35eac08df0d77db4cd731a/docs/concepts.md).
- [Platform operator guide](https://github.com/adventistasia/dev-platform/blob/37924668716ca6bb5080639df708278e43738f79/docs/deployment/operator-guide.md) and [workflow template](https://github.com/adventistasia/dev-platform/blob/37924668716ca6bb5080639df708278e43738f79/docs/deployment/app-workflow-template.yml).
- [Add an app](https://github.com/adventistasia/dev-platform/blob/37924668716ca6bb5080639df708278e43738f79/docs/how-to/add-app.md) and [automated deployment, including personal image overrides](https://github.com/adventistasia/dev-platform/blob/37924668716ca6bb5080639df708278e43738f79/docs/how-to/automated-app-deployments.md).
- [Register a dev app and test credentials](https://github.com/adventistasia/dev-platform/blob/37924668716ca6bb5080639df708278e43738f79/docs/how-to/register-dev-app.md), [portal reference](https://github.com/adventistasia/dev-platform/blob/37924668716ca6bb5080639df708278e43738f79/docs/reference/dev-portal.md), and [configuration locations](https://github.com/adventistasia/dev-platform/blob/37924668716ca6bb5080639df708278e43738f79/docs/reference/configuration.md).
- [CI runner registration](https://github.com/adventistasia/dev-platform/blob/37924668716ca6bb5080639df708278e43738f79/docs/how-to/register-ci-runners.md) and [deploy runner ownership, host, and labels](https://github.com/adventistasia/dev-platform/blob/37924668716ca6bb5080639df708278e43738f79/docs/reference/deploy-runner.md).
- [Platform architecture](https://github.com/adventistasia/dev-platform/blob/37924668716ca6bb5080639df708278e43738f79/docs/explanation/platform-architecture.md), [Zitadel stack](https://github.com/adventistasia/dev-platform/blob/37924668716ca6bb5080639df708278e43738f79/stacks/zitadel/compose.yaml), and [non-secret portal registry](https://github.com/adventistasia/dev-platform/blob/37924668716ca6bb5080639df708278e43738f79/portal/registry.json).
- Steward reference files: [Dockerfile](https://github.com/adventistasia/steward-expense-prototype/blob/main/Dockerfile), [deployment workflow](https://github.com/adventistasia/steward-expense-prototype/blob/main/.github/workflows/deploy.yml), and [design and architecture](https://github.com/adventistasia/steward-expense-prototype/blob/main/docs/design-and-architecture.md).
- [Steward feedback delivery](https://github.com/adventistasia/steward-expense-prototype/pull/20), inspected alongside local `src/feedback.js`, `src/app.js`, and `web/src/feedback/`.
  The inspected implementation passes the product connection into feedback and isolates its table from resets; this plan requires a separate database file.
