# program-rundown
Compose and publish worship/event program rundowns (order of service) as shareable, printable listings

See [docs/concepts.md](docs/concepts.md) for the program rundown concepts and vocabulary.
See [docs/build-plan.md](docs/build-plan.md) for the architecture, vertical slices, dev deployment, and demo-data plan.

Coordinators can create, reopen, and edit standalone Draft Program Headers, with optional dates and independent start/end times.
The signed-in shell also provides optional dev feedback.

Use Node.js 24. Install with `npm ci`, then run `npm run build`.
Follow [local setup](docs/local-setup.md) for configuration and [the testing runbook](docs/testing-runbook.md) for verification.
