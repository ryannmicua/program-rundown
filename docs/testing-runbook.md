# Testing runbook

## U1 shell, identity, and feedback

**Last tested:** 2026-10-31. **Tested by:** program-rundown-u1 worker.

Run from the repository root with Node.js 24:

```bash
npm ci
npm run typecheck
npm test
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
docker build -t program-rundown:local .
```

Server tests use temporary product and feedback databases, dynamic loopback ports, and a local signed OIDC issuer.
The mock issuer verifies PKCE and single-use codes. Tests do not contact Zitadel or require a real test account.
Component tests exercise context privacy, action suppression, escaped rendering, and disabled UI.
The Playwright journey uses the built frontend, so build before running it after UI changes.

**How to test manually:**

1. Start the app following [local setup](local-setup.md), with dev feedback enabled.
2. Open `/signin`, click **Feedback**, then select **Sign in**. Verify the selection does not navigate.
3. Enter a note and click **Send**. Verify the receipt appears.
4. Sign in as the mapped tester and open **View feedback notes**.
5. Mark the note done, reopen it, and reload. Verify the saved state.
6. Follow **Open page context**. Verify the note remains readable if its element no longer exists.
7. Replace only the app container while preserving both mounts and configuration. Verify notes and the tester session persist.
8. Check at 1280px, 768px, and 390px widths. Verify no horizontal overflow and usable feedback controls.
9. Disable feedback and restart. Verify `/feedback` and `/api/feedback` return 404 and no feedback button appears.
10. Set `APP_ENV=production` with `FEEDBACK_ENABLED=true`. Verify feedback stays disabled and its file is unopened.

**Safe actions:** Health checks, anonymous shell reads, running automated tests, and feedback readback.
**Data changes:** Posting notes and done/reopen update only the selected feedback database. Sign-in writes identity and session records.
Use synthetic data and disposable storage for local QA. Never reset a shared database to clean up a test.

**Setup:** Automated tests create their own synthetic subject and temporary files. Manual OIDC needs operator-supplied registration and mapping.
Run the demo seed explicitly with the configured coordinator issuer and subject. Repeated seeds and migrations must leave feedback unchanged.

**Cleanup:** Tests close only servers they started and remove only their temporary database directories.
Stop only the app/container you started for manual QA. Preserve shared demo records and feedback.

**Gotchas:**

- Serve `index.html` relative to an explicit static root. Express `sendFile` rejects absolute paths that pass through a hidden (dot) directory.
- Sign-in rotates cookies. API test clients must use the final `Set-Cookie` header, after the old cookie is cleared.
- Production cookies require HTTPS. Automated browser tests use the permitted loopback HTTP mode; a separate server test checks secure cookie attributes.
- Same-origin JSON mutations require the exact `Origin` matching `APP_ORIGIN`.
- Readback and done/reopen require the configured tester; anonymous creation does not confer read access.
- Browser print CSS hides feedback controls.

The automated journey checks process replacement against persistent files. Operator checks must still verify deployed HTTPS, real Zitadel, portal access, and mounted storage.

## U2 standalone Draft Headers

**Last tested:** 2026-10-31. **Tested by:** program-rundown-u2 worker.

**Setup:** Node.js 24, `npm ci`, then `npm run build`. Automated tests use temporary SQLite files and the local OIDC issuer.
Run the explicit demo seed described in [local setup](local-setup.md) only against the intended dev database.

**How to test:**

1. Sign in as the configured coordinator. Choose **New Program**, enter a title, and save with no date or times.
2. Open the saved `/programs/<id>` URL after signing out, signing in, and restarting the app against the same database.
3. Save start-only, end-only, both, and neither. Reload after each change; verify each value independently.
4. Enter a blank title. Verify the field error and that the saved Header is unchanged.
5. Open the same Draft in two tabs. Save the second tab, then attempt to save different entries in the first.
6. Verify the conflict keeps the first tab's entries. Reload the saved Draft, reapply the kept entries, review, and save.
7. Repeat at desktop and 390px mobile widths. Tab from Title to Date and verify all inputs and buttons work by keyboard.
8. Run the seed twice before first sign-in. Verify one `Community Gathering` Draft belongs to the configured coordinator.
9. Edit that Header, seed again, and verify the edit remains. Confirm feedback and unrelated Programs remain unchanged.

**Safe actions:** Automated tests, reads, and responsive inspection against isolated fixtures.
**Data changes:** Create/edit and seed commands write product data. Use disposable databases for QA; do not reset shared data.
**Cleanup:** Tests close only their own servers and delete their own temporary directories. Preserve shared demo edits and feedback.

**Verification commands:**

```bash
npm run typecheck
npm test
npm run build
npm run test:e2e
docker build -t program-rundown:local .
git diff --check
```

**Coverage:** `test/programs.test.ts` checks API validation, owner restrictions, authentication, restart persistence, and unchanged state after rejected edits.
Its process-replacement test saves through one child server, terminates that process, starts a second server, and reopens the same SQLite record.
`test/program-seed.test.ts` checks migration from U1, replay, compatibility of identity/session reads, seed ownership, and preservation of later edits.
`web/src/programs/Programs.test.tsx` checks conflict recovery, the network-failure message, and retained form values.
`e2e/draft.spec.ts` runs the complete browser journey with the real API at desktop and mobile widths.

**Gotchas:**

- The browser journey serves `web/dist`; rebuild after changing frontend source.
- Browser date/time controls normalize input, so malformed calendar/time values are tested directly through the API.
- PATCH needs the version from the last read Header. A stale version returns 409; no Header field changes.
- Same-origin JSON requires `Origin` matching `APP_ORIGIN`. Native browser fetch supplies it for mutations.
- A previous U1 database migrates on open. Schema changes are additive; identity/session tables remain readable by U1.
- No lint script exists in the project. Typechecking and `git diff --check` accompany the tests and build.

## U3 ordered Sections and Items

**Last tested:** 2026-11-01. **Tested by:** program-rundown-u3 worker.

**Setup:** Follow the U2 setup above. Use an isolated database and the local OIDC fixture for automated tests.
The explicit dev seed adds three Sections and four Items to `Community Gathering` once, preserving later edits and removals.

**How to test:**

1. Create a Draft. Add a headed Section with a start time only, then add `*Introit` and `Prayer` Items.
2. Give `*Introit` multiline Detail and an end time only. Add an unheaded Section with `Closing Remarks`.
3. Focus **Move Prayer up** and press Enter. Click **Move unheaded Section up**, then **Save rundown**.
4. Reload. Verify the unheaded Section comes first, and `Prayer` precedes `*Introit` within the headed Section.
5. Verify literal `*Introit`, independent times, and three Items in the preview. Detail wrapping must not add Items.
6. Inspect at 1280px, 768px, and 390px. Verify no horizontal overflow and usable move controls.
7. Edit labels, Detail, and times. Remove an Item, save, and reload; remove a Section and its Items, save, and reload.
8. Open the Draft in two tabs, save one, then save the other's rundown. Verify a conflict retains unsaved entries.
9. Choose **Reload saved rundown**, then **Reapply my rundown entries**, review, and save.
10. Run the seed twice, edit content, then seed again. Delete all demo content and seed again; removed content must stay removed.

**Safe actions:** Reads and tests against temporary fixtures.
**Data changes:** Saving replaces the selected Program's tree atomically. Removing a Section also removes its Items when saved.
Use disposable storage for QA. Preserve shared demo edits and feedback.
**Cleanup:** Automated tests close their own servers and remove their own temporary databases. Stop only manual fixtures started for this task.

**Verification commands:** `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e`, and `git diff --check`.
Set `PLAYWRIGHT_OUTPUT_DIR` to a task-specific directory outside the checkout for screenshots and failure traces.

**Coverage:** `test/content.test.ts` exercises real API saves, reorder persistence across restart, removal, parent validation, and atomic failure.
It also checks Header/content revision conflicts and anonymous and unauthorized access.
`test/program-seed.test.ts` covers migration replay, seed ordering, edited content, and intentional deletion preservation.
`web/src/editor/ContentEditor.test.tsx` checks escaped preview text, multiline grouping, retry after connection failure, and conflict recovery.
`e2e/compose.spec.ts` covers the complete compose/reorder/remove journey and captures three viewport screenshots.

**Gotchas:**

- Header and content share the Program revision. A stale save returns 409 without changing either Header or tree.
- The editor stores order locally until **Save rundown**. Pointer and keyboard users share the same move buttons.
- The flat U3 tree permits only root Sections and Items under Sections; nesting and mini-programs arrive in U5.
- Content IDs remain stable across edits and sibling moves. Array order defines sibling order, even when children are interleaved in the API array.
- A seed marker prevents deleted demo content from returning. Seeding never opens feedback storage.
- Rebuild before browser tests, because the fixture serves `web/dist`.

**UI state inventory for the U3 PR description:**

1. **Loading:** the Program list shows “Loading Programs”; a Draft detail shows “Loading Draft.”
2. **Empty:** an account without Programs gets the new Draft prompt; a Draft without Sections gets an add-Section prompt.
3. **Loaded:** saved Sections and Items appear in the editor and escaped, ordered preview.
4. **Edited:** local changes are marked unsaved; Save rundown becomes available.
5. **Saving:** the button announces saving and the editor controls are disabled.
6. **Validation rejected:** required Item labels are enforced in the form; server validation errors preserve entries and allow correction.
7. **Saved:** a successful write advances the revision and announces “Rundown saved.”
8. **Connection failure:** an alert keeps entries editable and allows retry.
9. **Revision conflict:** an alert preserves entries and offers reload, then reapply against the latest revision.
10. **Access denied:** a coordinator denial is surfaced with retry on the Program list; content APIs also reject anonymous requests and return 404 for another coordinator's Draft. A separate read-only Reader or Published state cannot occur in U3 because publication and Reader routes arrive in U4.

Move controls are disabled at sibling boundaries, during saves, and during conflicts. The focused U3 browser journey also checks keyboard use and 1280px, 768px, and 390px layouts.
