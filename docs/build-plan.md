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
| R3 | Event coordinators manage every linked Program, including Drafts; standalone Programs have their own coordinator. Anyone reads a Published Program by link without signing in. Later edits replace published content, without version history. | U2, U4, U8 |
| R4 | Coordinators manage flexible and parallel Parts, Part extra info, Participant definitions shared between Programs, Roles, and Footer standing roles. | U6, U7, U9 |
| R5 | An optional Event links and orders complete Programs, optionally grouped by each Program's own date. | U8 |
| R6 | Parts move within their Program or between Programs linked to the same Event, never across Events. Occupied destinations retain all Parts in parallel. Copies offer `Copy without Participant` and `Copy everything`. | U9 |
| R7 | Blank, omitted, and role-only Parts without named holders count as unassigned. Extra info alone does not assign anyone. | U10 |
| R8 | The Participant list covers the whole Event, filterable by Program; standalone Programs offer their own list. Group shared references by definition, preserve direct text per Part, and show unnamed roles separately. | U11 |
| R9 | Dev has one synthetic test user, accessible demo data, portal registration, and feedback absent from production. | U1 onward |
| R10 | Coordinators save Programs as account-owned templates usable across their Events. Shared templates must be imported as independent owned copies. New Drafts copy ordered Parts and extra info, without Participant assignments or Header dates/times. | U12, U13 |

R6–R8 are settled decisions, replacing the three earlier open questions.
The follow-up Q1–Q5 are also settled; the decision record below names each answer.
A standalone Program permits internal Part moves; sharing no Event does not authorize moves between two standalone Programs.
Participant group text remains valid without enumerating individuals.
Published Programs are reachable by shared links, including links from their Event page.
There is no discoverable public directory; link sharing meets the stated reader need without adding public browsing scope.

Recurrence, dated Event occurrences, and copy-forward remain deferred entirely.
Event logistics, attendance, venue booking, ticketing, and rehearsals remain outside the product.
Realtime collaboration, publication history, and custom PDF generation are outside this first build; browser printing supplies the initial printable listing.

## Architecture and stack proposal

Use the Steward prototype's one-container pattern, with real identity and isolated feedback storage.
The following choices describe the planned architecture, grounded in the inspected references.
U1 now provides the signed-in shell and isolated dev feedback; Program authoring starts in U2.

| Choice | Proposal and rationale |
| --- | --- |
| Application | Node.js 24, TypeScript, Express JSON API, and a React/Vite frontend served by the same process. Steward demonstrates this deployment shape. |
| Product database | SQLite in a persistent volume, with explicit, ordered migrations and foreign keys. This matches Steward and keeps the initial dev application small. |
| Feedback database | A second SQLite file in a separate persistent volume, opened only by the optional feedback module. Product migrations and demo seeds never open it. |
| Identity | Zitadel OpenID Connect authorization-code flow with PKCE, using server-side sessions and secure, HttpOnly cookies. Use a maintained OIDC client library. |
| Authorization | Server checks on every read and mutation. Event coordination grants access to every linked Program, including Drafts; standalone Programs use their own coordinator. Published reading needs no session. |
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
| Parts | Zero or more independently addressable assignments at an eligible node or Footer entry, each with independent extra info. Moving or copying to an occupied spot appends a parallel Part. |
| Part values | Explicit blank, free text, role, structured role/name, and Participant reference forms. Store stable reference IDs and the selected name/role display mode. |
| Participants | Definitions shared between Programs, with role, optional name, honorific, position, organization, and subtitle. Use stable identities and explicit reuse; matching text never merges people. Check access before selection, reuse, or edits. |
| Footer | Ordered standing-role entries with the same Part rules, including group text for multiple holders. Footer entries are outside the activity sequence. |
| Event | Name, optional dates, linked Program ordering, and optional date-grouping preference. Date groups derive from Program dates, never occurrence records. |
| Template | Account-owned snapshot saved from a Program, reusable across Events. Sharing permits other coordinators to view and import independent owned copies, without source Program access. Instantiation creates a separate Draft; ordered Parts and extra info carry over, Participant assignments and Header dates/times do not. |
| Feedback | Independent note ID, timestamp, route, sanitized page context, optional element context, reporter label, and done state. No foreign keys into demo tables. |

Keep routes thin and put assignment display, unassigned classification, tree validation, and move authorization in domain modules.
Save an edit atomically and check the expected revision to prevent silent lost updates.
The revision counter detects conflicts; it does not store publication versions.
After a successful edit to a Published Program, its existing reader URL shows the replacement content immediately.
Draft read restrictions apply to detail routes, listings, Event pages, print routes, and participant aggregation alike.
Anonymous reader routes expose only Published Programs; coordinator Participant selection and aggregation still require authorization.
Shared Participant edits affect every reference, including published content; show affected Programs before saving without revealing inaccessible content.

Suggested implementation areas are `src/auth/`, `src/domain/`, `src/api/`, `src/db/migrations/`, `src/demo/`, and `web/src/`.
Keep feedback self-contained in `src/feedback/` and `web/src/feedback/`.
Tests belong in `test/`, frontend component directories, and `e2e/`; these are proposed paths, not files added by this PR.

## Dev deployment and identity

### Checked platform conventions and personal-repository differences

The platform supports immutable GHCR deployment through `deploy-app`; it does not build source on the apps host.
Main pushes build and publish an immutable image from GitHub-hosted runners.
The main Firstmate deploys each published digest to dev from another host.
This repository does not deploy to dev or use a repository-scoped deploy runner, repository deployment variables, or a `dev` environment.

| Concern | Program Rundown adaptation |
| --- | --- |
| Source | `ryannmicua/program-rundown`, a public personal repository; do not substitute an `adventistasia` owner. |
| Image | Publish `ghcr.io/ryannmicua/program-rundown:sha-<commit>` and deploy `ghcr.io/ryannmicua/program-rundown@sha256:<digest>`. |
| Helper allowlist | Commit `stacks/apps/program-rundown/image-repo` containing `ghcr.io/ryannmicua/program-rundown` in dev-platform. The default accepts only the organization namespace. |
| CI runners | PR checks, image-build proof, and trusted main builds use GitHub-hosted runners. |
| Deployment | The main Firstmate deploys each published image digest to dev from another host. |
| Repository deployment configuration | No repository deploy runner, `DEV_DEPLOY_HOST` or `DEV_DEPLOY_BRANCH` variable, or `dev` environment is used. |
| Registry permissions | The build job needs `packages: write`. Confirm the package grants this repository's workflow token access. |
| Private runtime settings | Keep OIDC settings, session secrets, coordinator subject mapping, feature flags, and mount paths in the app's host-local environment. Commit examples with placeholders only. |

SSD IT Ops or the platform operator owns host provisioning, DNS, and identity configuration.
The main Firstmate owns deployment credentials and invokes `deploy-app` from another host.

### Path to the first dev deployment

1. In dev-platform, prepare a reviewed stack, environment example, both TLS route templates, `image-repo`, and portal registry entry.
   Allocate an unused host port from `18100–18999`; match the route backend to the private `APP_HOST_PORT`.
   Add persistent mounts for `/data/program-rundown.sqlite` and `/feedback-data/feedback.sqlite`; the generic no-database template needs these additions.
2. Merge that platform change before installation, then arrange private provisioning through the platform operator.
   Set `APP_IMAGE`, `APP_CONTAINER_PORT=3000`, `APP_HOST_PORT`, and `APP_HEALTH_URL` for the existing stack.
   Follow the current GitOps guide; do not run `scripts/new-app` in the aligned host checkout because it also changes tracked files.
3. Arrange package access, OIDC registration, and the synthetic test user described below.
   The proposed app hostname is `program-rundown.dev.in.ssd.org`; verify allocation before publishing links or registering redirect URIs.
4. Add `.github/workflows/deploy.yml` during U1.
   PR jobs test and build the container without pushing; trusted `main` pushes test, build once, and publish the image tagged `sha-<commit>`.
   The workflow writes the published digest to its summary and build output for the main Firstmate to deploy from another host.
5. Converge apps before edge from the reviewed platform revision.
   `deploy-app` updates the existing stack, checks its health URL, and restores the previous digest if health fails.
   Keep schema migrations additive and compatible with the previous image; image rollback does not reverse database changes.
6. Verify HTTPS routing, sign-in, feedback creation/readback, and database persistence across an app restart.
   Confirm the portal's app link and health entry, then extend the demo as later slices land.

The main Firstmate serializes deployments for this app and avoids cancelling an active migration or deployment.
The workflow summary records the published commit, image tag, and digest.
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
| Participants | `Riley Placeholder` as coordinator credit, `Alex Placeholder` as Speaker, `Jamie Example` for reading/prayer, and `Morgan Pianist` for music. Reuse one definition across Programs; include distinct definitions with matching names. |
| Assignment variants | Blank; extra-info-only; `Congregation`; `Pat Example and Lee Example`; standalone `Speaker`; structured role with/without a name; references by name/role. |
| Participant details | `Dr.`, `Education Director`, `Example Conference`, and a subtitle on the Speaker; Item Detail `A Life of Service` stays separate from per-person notes on parallel Parts. |
| Publication | At least one Published and one Draft Program in an Event, demonstrating independent status and draft visibility rules. |

The dev test user acts as coordinator without another role or manual grant step.
The seed reads the configured coordinator issuer and subject from the existing environment configuration.
It makes that identity coordinator of every demo Program and, from U8, every demo Event.
Do not hardcode or commit a real issuer/subject mapping, login, or credential in fixtures.
Footer coordinator credits are display text and do not grant access.
Do not seed unsupported future structures early: U1 has an empty product collection and working feedback; U2 adds Program headers; later slices add their fixtures.
Full demo events, programs, parts, and participants become available by U8.
U9–U11 extend those fixtures for parallel Parts, both copy options, unassigned review, and participant-list verification.
U12 adds an owned template saved from a demo Program and reused across Events.
U13 adds sharing and import coverage with placeholder coordinator accounts in isolated tests; the deployed demo retains its single test user.

## Ordered vertical slices

Ship in the order below. Each slice includes its migration, API behavior, UI, seed extension, and tests; none is a database-only or UI-only milestone.
U1 deliberately dedicates the walking skeleton to dev feedback, so feedback is its own early slice and is live on the first dev deploy.
Program authoring begins in U2, independently of the feedback module.
Q1–Q5 and T1–T2 are settled; template implementation is unblocked.
How intentionally unlisted participants affect the U10 review remains open below; no marker or classification change is decided.
This is the default delivery order. U10 and U11 can proceed from their listed dependencies independently of U9.

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
- A standalone Program uses its own coordinator. The configured dev coordinator can create, read, and edit its seeded Draft without another role.
- Unauthenticated requests and a different signed-in identity cannot read or mutate that Draft, including through listing and detail APIs.
- Blank titles and malformed dates/times return useful errors without partial writes; stale edits show a recoverable conflict.

**Files and proof:** `src/api/programs.ts`, `src/db/migrations/`, `web/src/programs/`, `test/programs.test.ts`, `e2e/draft.spec.ts`.
**Dependencies:** U1. Apply the settled standalone coordinator rule; Event-wide access arrives in U8.

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
**Out:** Version history, staged edits to published content, custom PDF generation, Event-wide publication, and discoverable public listings.

**Acceptance and tests:**

- A coordinator previews a Draft; a reader cannot retrieve it through direct URLs or APIs.
- Publish and open the reader URL and printable view without a session; reader APIs also allow anonymous Published reads.
- Anonymous readers cannot edit or publish; a different signed-in identity gains no coordinator rights from the published link.
- Keep Draft titles/content out of anonymous listings, APIs, and print routes. Do not add a discoverable public directory.
- Edit a Published Program; the same URL shows the replacement without another version or publication step.
- Print the listing without editor controls or feedback. A narrow viewport keeps labels and content readable.

**Files and proof:** `src/api/publication.ts`, `web/src/reader/`, `test/publication.test.ts`, `e2e/publish-print.spec.ts`.
**Dependencies:** U3. Q1–Q2 are settled; U8 extends access to Event coordinators.

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

**In:** Blank, text, role, and structured role/name Parts; ordered Footer entries; editor, reader, and print rendering.
For each program entry, show a required title (existing Item label), optional participant (existing Part), and optional detail line (existing Item Detail).
For example: `Opening Song`, a song leader, and `Amazing Grace, Hymn #321`. This mapping adds no new fields.
Retain Part extra info only for per-person notes on parallel Parts; the editor must not offer it as a second entry detail line.
Represent each spot as capable of holding independently editable parallel Parts; U9 introduces occupied-destination moves and copies.
**Out:** Participant references, moving or copying assignments, and participant aggregation.

**Acceptance and tests:**

- Add, update, and clear every supported direct Part form on each eligible target; activity labels and Detail remain unchanged.
- Save and reopen `Opening Song` with and without its optional participant and detail line; its required title uses the existing Item label validation.
  Render `Amazing Grace, Hymn #321` once as Item Detail, not again as Part extra info.
  Parallel Parts retain independent per-person notes without duplicating the entry detail line.
- A structured name displays when supplied; an absent/blank name falls back to its role. Standalone roles remain valid.
- Preserve `Congregation` and a multi-person text value without splitting names; extra info can accompany a blank value.
- Footer credits do not become timed activities. A rejected assignment edit leaves previous content intact.

**Files and proof:** `src/domain/parts.ts`, `src/api/parts.ts`, `web/src/parts/`, `test/parts.test.ts`, `e2e/assignments.spec.ts`.
**Dependencies:** U5; none of the open product questions for direct values.

### 7. U7 — Reuse Participant definitions by name or role

**Goal and outcome:** The coordinator defines a Participant once and reuses the definition in repeated Parts and Footer credits.

**In:** Participant CRUD, reference selection/display mode, role-only definitions, honorific/subtitle/position/organization, and reference validation.
Allow explicit sharing between Programs the coordinator may manage, including standalone Programs.
**Out:** Event aggregation and automatic identity matching between Programs.

**Acceptance and tests:**

- Define `Alex Placeholder` as Speaker; reference the definition by name and role on Items, blocks, and Footer entries.
- A role reference displays the name when present, otherwise the role label; changing the definition updates its references.
- Participant position/organization/subtitle remain separate from Part extra info and Item Detail.
- Prevent dangling references and accidental name-based identity merging; explicitly select the intended definition when labels collide.
- Reuse one definition in two Programs; edits update both, including published references, after showing affected Programs within coordinator access.
- Deny unauthorized definition selection or edits and avoid exposing inaccessible Program details through reference queries.

**Files and proof:** `src/domain/participants.ts`, `src/api/participants.ts`, `web/src/participants/`, `test/participants.test.ts`, `e2e/participant-reuse.spec.ts`.
**Dependencies:** U6. Q5 settles shared definitions; Event access is added by U8.

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
- An Event coordinator can read and manage every linked Program, including Drafts, without individual Program grants.
- A different identity gains no coordinator access. Linking/unlinking checks authority for the Program and Event; unlinking retains the Program's own coordinator.
- Anyone with an Event link can open its Published Programs without signing in; Draft details remain unavailable through every reader route.
- The dev seed reads the coordinator issuer/subject from existing environment configuration and assigns that identity to every demo Program and Event.
  Verify the configured test user manages all demo Programs without another role or setup; repeated seeds preserve feedback and coordinator edits.

**Files and proof:** `src/api/events.ts`, `web/src/events/`, `src/demo/`, `test/events.test.ts`, `e2e/event-grouping.spec.ts`.
**Dependencies:** U7 and U4. Apply the settled Event-wide coordinator and anonymous Published reader policies.

### 9. U9 — Move or copy Parts within a Program or its Event

**Goal and outcome:** The coordinator relocates or copies an assignment while preserving activities and every existing destination Part.

**In:** Choose one Part and a destination Item/block/Footer entry, preview existing Parts, confirm, and atomically move or copy its value and extra info.
Permit internal operations and operations between Programs linked to the same Event; verify permissions on both sides.
Copies offer `Copy without Participant` and `Copy everything`.
**Out:** Cross-Event moves or copies, operations between standalone Programs, and copying or moving the activity itself.

**Acceptance and tests:**

- Move within nested content and between two Programs linked to `Sabbath`; only the selected source Part clears and the target receives its value/extra info.
- Keep Item labels, Detail, ordering, and Participant descriptive fields unchanged.
- Reject `Sabbath → Example Conference`, standalone-to-other-Program, unauthorized, and stale destination requests without changing either side.
- Move onto assigned or extra-info-only destinations: retain every existing Part and append the moved Part in parallel, without replacement or merging.
- Render all parallel Parts in editor, preview, reader, and print; select each independently so the coordinator can move another Part elsewhere.
- Move a Participant reference across Programs and retain the same definition and display mode, without duplicating or deleting that definition.
- `Copy everything` retains the assignment, extra info, and shared reference; the source stays intact and later definition edits reach both references.
- `Copy without Participant` retains Part extra info and explicit role placeholders, clearing references, direct names, group text, and person details.
  Do not infer a role from free text. Retain a referenced role as a standalone role; it counts as unassigned.
- Both copy options preserve occupied destinations as parallel Parts. Cancellation or failed transactions change neither side.
- Keyboard selection offers the same destinations as pointer interaction; Draft restrictions remain enforced when choosing destinations.

**Files and proof:** `src/domain/move-part.ts`, `src/api/parts.ts`, `web/src/parts/`, `test/move-part.test.ts`, `e2e/move-parts.spec.ts`.
**Dependencies:** U8. Q3 and Q5 settle parallel destinations and shared references; R6 supplies the same boundaries for moves and copies.

### 10. U10 — Review Parts awaiting a named assignment

**Goal and outcome:** The coordinator finds unassigned Parts and opens the corresponding editor directly.

**In:** Server-derived status, review list/filter, links to Items/blocks/Footer entries, and automatic refresh after assignment edits or moves.
**Out:** Requiring every activity to have a Part, reminders, and automatic assignment.

**Acceptance and tests:**

- Include blank and omitted values, including extra-info-only Parts, plus standalone roles and structured roles without names.
- Include role references whose Participant lacks a name; assigning a name removes them from the unassigned result.
- Keep free text such as `Congregation` valid. Do not infer the meaning of `TBA` or split group text into unnamed people.
- Preserve an unassigned Part's full content when opening and saving it; exclude inaccessible Drafts from any cross-Program query.
- Classify parallel Parts independently; a named Part at the same spot does not hide an unnamed role or extra-info-only Part.

**Files and proof:** `src/domain/unassigned.ts`, `web/src/assignments/`, `test/unassigned.test.ts`, `e2e/unassigned.spec.ts`.
**Dependencies:** U7 and U8; extend move-related browser coverage when U9 lands. R7 settles role-only classification.

### 11. U11 — List Participants across an Event, filterable by Program

**Goal and outcome:** The coordinator sees who takes Parts throughout an Event and narrows the list to one Program.

**In:** Event aggregation, Program filter, assignment locations, group-text representation, and traceable links to source Parts.
**Out:** Attendance tracking, contact directories, notifications, and inferring individual names from group strings.

**Acceptance and tests:**

- List Participants from nested content and Footer roles across `Sabbath`; selecting Divine Worship limits results to that Program.
- Show `Named Participants`, `Text assignments`, and `Awaiting a name`, following the [Participant list design](concepts.md#participant-list).
- Group named references by definition, with every assignment location. The same definition across Programs appears once; distinct definitions with equal names remain separate.
- Preserve direct text and structured names per Part, including repeated identical text. Keep `Congregation` and group strings whole; treat `TBA` as text.
- Group references to unnamed definitions under `Awaiting a name`; direct unnamed roles stay tied to their Parts. Blank/extra-info-only Parts remain in U10 only.
- Include all parallel Part locations. Follow first-assignment order using Event Program order, content order, then Footer entries; filtering retains only matching locations.
- Assign, clear, move, or copy a Part, or edit its shared definition, and verify the list updates; omit unused definitions.
- Enforce Draft permissions before aggregating. Empty Events and Programs produce useful empty states.
- A standalone Program offers the same three groups, source links, and empty states, scoped to its own Parts without requiring an Event.

**Files and proof:** `src/domain/participant-list.ts`, `src/api/participants.ts`, `web/src/participants/`, `test/participant-list.test.ts`, `e2e/event-participants.spec.ts`.
**Dependencies:** U7 and U8; extend parallel-Part and copy coverage when U9 lands. Q4–Q5 and R8 settle presentation, identity, and scope.

### 12. U12 — Save an owned template and create a Draft Program from it

**Goal and outcome:** A coordinator saves a Program as an account-owned template and reuses it across their Events.

**In:** Save-as-template from a Program the coordinator manages, persistent owned templates, an owned-template picker, and a creation preview.
Require the new Program's title, allow an optional date and Event destination, and reuse the existing composer.
**Out:** Sharing and importing shared templates (U13), a dedicated template editor, recurrence, occurrence generation, copy-forward, and a template marketplace.

**Acceptance and tests:**

- Save a managed Program as `Example Worship Template`, owned by the saving coordinator's account rather than its source Event.
  Saving leaves the source Program unchanged. Deny saving an inaccessible Program and reading or using another account's private template.
- Snapshot the supported nested structure, labels, Detail, Footer, and Parts, preserving their order, parallel placement, and independent extra info.
  Clear all Participant assignments, including direct person/group text, structured names and person details, and shared Participant references.
  Retain explicit role placeholders without named holders. Extra info alone remains unassigned.
  Omit Header dates/times from the saved snapshot, including nested mini-program Headers.
- Preview the copied structure, ordered Parts, and extra info, and show that no Participant assignments or Header dates/times carry over.
  This applies to the main Header and nested mini-program Headers; require a new Program title and allow its own optional date.
- Create a separate Draft with its own ID and coordinator, either standalone or in any Event the coordinator may manage.
  Reuse the same owned template across two different Events; require destination coordinator rights and inherit no publication status or source access grants.
- Edit the source Program or a created Program without changing the saved template or another Program created from it.
  Cancellation and failed save/create requests leave no partial template or Program and preserve existing records.
- Extend the demo seed with an owned template saved from a placeholder Program, preserving feedback, existing Programs, and coordinator edits.
  Prove repeatable seeding and persistent owned-template readback.

**Files and proof:** Template ownership/content migration in `src/db/migrations/`, `src/domain/templates.ts`, `src/api/templates.ts`, `web/src/templates/`, Program save-as-template controls in `web/src/programs/`, `src/demo/`, `test/templates.test.ts`, and `e2e/templates.spec.ts`.
**Dependencies:** U6 for Parts, extra info, and Footer; U7 for Participant forms to strip; U8 for Event destinations and authorization.
These include U2–U5 Header and structure support. U9 is not required: template reuse copies a snapshot, without moving Parts between Programs or Events.

### 13. U13 — Share templates and import independent owned copies

**Goal and outcome:** A coordinator shares a template for other coordinators to see and import into their own accounts.

**In:** Owner-controlled sharing, a shared-template listing and preview for signed-in coordinators, and copy/import into owned templates.
Use U12's creation flow only after import.
**Out:** Linking Programs to another account's template, synchronized copies, shared editing, source Program access grants, anonymous template browsing, and a template marketplace.

**Acceptance and tests:**

- Share an owned template as `Riley Placeholder`; `Alex Placeholder` can see and preview that shared template.
  Only the owner can change its sharing state; private templates stay inaccessible to other coordinators.
- Sharing exposes the template snapshot only. It grants no rights to read or edit the source Program, including a Draft, or its Event.
  Participant assignments removed by U12 remain absent from shared previews and imports.
- Import the shared template into the recipient's account with a new template ID and independent ownership.
  Preserve the structure, ordered Parts, and extra info; import neither source access grants nor Participant assignments.
- Require import before creating a Program from another coordinator's shared template, including through direct API requests.
  The imported template works across the recipient's Events under U12's destination authorization rules.
- Changes to either template never update the other, and created Programs remain independent.
  Turning off sharing prevents new views/imports by other coordinators while existing imports remain usable.
- Deny unauthorized sharing and import of a private template; cancellation and failed import leave no partial owned copy or changed source.
  Use isolated tests with placeholder coordinator accounts to prove these boundaries without adding deployed demo users.

**Files and proof:** Template sharing migration in `src/db/migrations/`, `src/domain/templates.ts`, `src/api/templates.ts`, `web/src/templates/`, `test/templates.test.ts`, and `e2e/templates.spec.ts`.
**Dependencies:** U12 for owned snapshots, Participant stripping, and Program creation, including its U6–U8 dependencies.

## Settled product decisions

The captain settled Q1–Q3, Q5, and T1–T2; Q4 delegates the list design to this plan.

| ID | Decision | Affected work |
| --- | --- | --- |
| Q1 | An Event coordinator can read and manage every Program in the Event, including Drafts. A standalone Program has its own coordinator. | U2, U4, U8–U11 |
| Q2 | Anyone can read a Published Program by link without signing in. Event links may list their Published Programs; no discoverable public directory is needed. | U4, U8 |
| Q3 | An occupied destination keeps all existing Parts and receives the moved Part in parallel. The coordinator decides whether to move another Part. | U6 representation, U9 |
| Q4 | Use Named Participants grouped by definition, Text assignments per Part, and Awaiting a name for unnamed roles. Retain source locations and offer the same list for standalone Programs. | U11 |
| Q5 | Share Participant definitions between Programs. Moving or fully copying a reference keeps its identity; offer copying without Participant or copying everything. | U7, U9, U11 |
| T1 | Any coordinator can save a managed Program as a template owned by their account and usable across all their Events. Sharing makes the template visible to other coordinators, who must copy/import it as an independent template in their own account, never link to it. Sharing grants no rights to the source Program. | U12, U13 |
| T2 | A new Program copies Parts in order with their extra info, but no Participant assignments. Header dates/times do not carry over; the new Program takes its own title and optional date. | U12 creation preview and carry-over; U13 imports |

Each program entry uses three existing concepts: required title = Item label, optional participant = Part, optional detail line = Item Detail.
For example, `Opening Song` can list a song leader and the detail `Amazing Grace, Hymn #321`.
U6 retains Part extra info only for per-person notes on parallel Parts, avoiding a duplicate entry detail field.

Q4 groups only explicit shared identities, so matching names cannot merge different people.
Text assignments preserve names and groups without requiring individual records or parsing a group string.
`Awaiting a name` keeps role placeholders visible without treating them as named people.
Every group links back to source Parts, so the coordinator can act on the list.

## Open product questions

Q1–Q5 and T1–T2 are settled above. One participant-review question remains open.

| ID | Question | Affected work |
| --- | --- | --- |
| P1 | How should an intentionally unlisted participant interact with the unassigned-Parts review? No marker or change to the current blank/unassigned rules is decided. | U10 |

Platform details are implementation prerequisites rather than product choices: hostname/port availability and OIDC client registration require operator verification.
Do not replace these unknowns with credential values or assume the corresponding resources already exist.

## Core UI states — standing acceptance criteria

Every slice must handle each core UI state that applies to its screens, with tests where practical.
Its PR body must list all ten states, explaining how each is handled or why it cannot occur in that slice.
Name the affected screen and test evidence; where testing is impractical, describe the manual check or limitation.

| State | Acceptance criterion |
| --- | --- |
| Empty State | Guide the user before data exists, with a clear first action. |
| Loading State | Keep the wait active with visible feedback; perceived speed matters. |
| Error State | Explain the cause clearly and offer actionable recovery. |
| Offline State | Inform the user that connectivity is unavailable and prevent blank views. |
| Slow Network | Show incremental progress or updated wait guidance; avoid frozen spinners. |
| Zero Search Results | Offer suggestions or alternatives so the user has a next action. |
| Permission Denied | Explain the access restriction and provide a recovery route without exposing protected data. |
| Session Expiry | Persist draft state before authentication teardown and support recovery after sign-in. |
| Form Validation | Place inline errors at the exact input field that needs correction. |
| Success State | Acknowledge completion and provide a clear next step. |

### Follow-up gaps in merged U1 and U2 screens

These gaps come from reading `main` at `2e4fcae`, after U1 and U2 merged.
Sources: [shell](../web/src/App.tsx), [feedback](../web/src/feedback/Feedback.tsx), [Draft screens](../web/src/programs/Programs.tsx), and [API access checks](../src/app.ts).
This is a follow-up list only; this documentation change fixes none of these gaps and leaves slice ordering unchanged.
U3 covers its own states separately.

| Screen | State | Missing behavior |
| --- | --- | --- |
| U1 feedback list (`/feedback`) | Empty State | `No notes yet.` gives no guidance to create the first note through the Feedback control. |
| U1 feedback list, saved-note context, and done/reopen controls | Loading State | Reads and done/reopen requests have no pending indicator. The list shows `No notes yet.` while its initial request is pending. |
| U1 shell sign-out | Loading State; Error State | Sign-out has no pending feedback. A rejected fetch has no catch or visible recovery message; only non-OK responses show an error. |
| U1 feedback list, saved-note context, and done/reopen controls | Error State | Request errors show a message without an explicit retry action. Network failures use the fetch exception rather than a clear cause and recovery instruction. |
| U1 shell and feedback; U2 Program list and Draft editor | Offline State | No offline indicator or reconnect guidance exists. Requests fall back to generic connection errors rather than explaining the offline state. |
| U1 shell and feedback; U2 Program list and Draft editor | Slow Network | `Connecting…`, loading text, `Sending…`, and `Saving…` never advance or offer delayed-request guidance. Feedback reads and done/reopen requests remain silent. |
| U1 shell access-denied card and feedback readback/management | Permission Denied | The shell explains the coordinator restriction but gives no access-request route. Feedback displays API denial text without an access-recovery route. |
| U2 Program list and Draft editor | Permission Denied | Access failures lack an explanation of how to recover access. Another owner's Draft returns `Program not found.` with no safe access guidance. |
| U1 shell and feedback management; U2 Program list and Draft editor | Session Expiry | The shell reads session state only at mount. Later 401 responses show text without updating authentication state or offering a sign-in recovery action. |
| U1 feedback composer; U2 new/edit Draft forms | Session Expiry | Unsaved text lives only in React state. No persistent recovery copy protects entries across sign-in redirects or reloads; feedback creation itself permits anonymous notes. |
| U1 feedback composer | Form Validation | Native required/length constraints exist, but custom blank-note and API validation messages appear outside the field without an error association to `Your note`. |
| U2 new Draft (`/programs/new` → `/programs/:id`) | Success State | Creation navigates to the saved Draft without an explicit creation acknowledgement. Editing an existing Draft already shows `Draft saved.`. |

Neither slice offers search, so Zero Search Results cannot occur in these screens.
U2 already guides users from an empty Program list and associates Header validation errors with their fields.
Its failed-save and conflict paths retain entries in memory; that does not provide persistence across authentication teardown.

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
6. The slice completes no-mistakes in its own PR. After merge, the workflow publishes its image and the main Firstmate deploys that exact digest and records health/smoke evidence.
7. The slice satisfies the standing core UI state criteria above, with all ten states accounted for in its PR body.

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
- [CI runner registration](https://github.com/adventistasia/dev-platform/blob/37924668716ca6bb5080639df708278e43738f79/docs/how-to/register-ci-runners.md).
- [Platform architecture](https://github.com/adventistasia/dev-platform/blob/37924668716ca6bb5080639df708278e43738f79/docs/explanation/platform-architecture.md), [Zitadel stack](https://github.com/adventistasia/dev-platform/blob/37924668716ca6bb5080639df708278e43738f79/stacks/zitadel/compose.yaml), and [non-secret portal registry](https://github.com/adventistasia/dev-platform/blob/37924668716ca6bb5080639df708278e43738f79/portal/registry.json).
- Steward reference files: [Dockerfile](https://github.com/adventistasia/steward-expense-prototype/blob/main/Dockerfile), [deployment workflow](https://github.com/adventistasia/steward-expense-prototype/blob/main/.github/workflows/deploy.yml), and [design and architecture](https://github.com/adventistasia/steward-expense-prototype/blob/main/docs/design-and-architecture.md).
- [Steward feedback delivery](https://github.com/adventistasia/steward-expense-prototype/pull/20), inspected alongside local `src/feedback.js`, `src/app.js`, and `web/src/feedback/`.
  The inspected implementation passes the product connection into feedback and isolates its table from resets; this plan requires a separate database file.
