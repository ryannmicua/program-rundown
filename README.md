# program-rundown
Compose and publish worship/event program rundowns (order of service) as shareable, printable listings

See [docs/concepts.md](docs/concepts.md) for the program rundown concepts and vocabulary.
See [docs/build-plan.md](docs/build-plan.md) for the architecture, vertical slices, dev deployment, and demo-data plan.

Coordinators can create, reopen, and edit standalone Draft Program Headers, with optional dates and independent start/end times.
They can compose and reorder a Draft's rundown of Sections and Items.
They can publish a Program to a reader link that anyone can open and print without signing in.
They can group complete Programs under an optional Event, ordered and optionally grouped by date, with a reader link that lists only its Published Programs.
They can save a Program as a template owned by their account and create new Drafts from it across their Events, without copying people or Header dates and times.
They can share a template with other coordinators, who import it as an independent copy in their own account.
The signed-in shell also provides optional dev feedback.

Use Node.js 24. Install with `npm ci`, then run `npm run build`.
Follow [local setup](docs/local-setup.md) for configuration and [the testing runbook](docs/testing-runbook.md) for verification.
