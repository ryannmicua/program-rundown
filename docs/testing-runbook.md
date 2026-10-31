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
U1 demo seed is intentionally empty; run it explicitly. Repeated seeds and migrations must leave feedback unchanged.

**Cleanup:** Tests close only servers they started and remove only their temporary database directories.
Stop only the app/container you started for manual QA. Preserve shared demo records and feedback.

**Gotchas:**

- `.treehouse` is a hidden directory. Serve `index.html` relative to an explicit static root to avoid Express dotfile filtering.
- Sign-in rotates cookies. API test clients must use the final `Set-Cookie` header, after the old cookie is cleared.
- Production cookies require HTTPS. Automated browser tests use the permitted loopback HTTP mode; a separate server test checks secure cookie attributes.
- Same-origin JSON mutations require the exact `Origin` matching `APP_ORIGIN`.
- Readback and done/reopen require the configured tester; anonymous creation does not confer read access.
- Browser print CSS hides feedback controls.

The automated journey checks process replacement against persistent files. Operator checks must still verify deployed HTTPS, real Zitadel, portal access, and mounted storage.
