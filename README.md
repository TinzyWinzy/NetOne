# NetOne Network Investment Intelligence

React + Vite + TypeScript adapted from the copied Econet application.

Current milestone: CFO portfolio, shared filters, 100 deterministic synthetic sites, map, site cases and investment priorities with configurable weights, eligibility, score evidence and two-candidate comparison. All values and rules are fictional. No operator systems are connected.

Run `npm run dev` and `npm run build`. Server sign-in replaces the presenter PIN: use `finance` / `netone-local-demo` locally. Executive, Network, Regulatory and Admin development accounts use their lowercase role names and the same local password. Production accounts must be configured explicitly.

Run `npm run test:portfolio` for domain invariants. Run `npm run e2e:netone` with the dev server running (`BASE_URL` defaults to `http://localhost:5174`).

Run `npm run test:investments` for scoring invariants and `npm run e2e:investments` for the investment journey. See `docs/milestone-02.md` for formulas, eligibility and evidence limitations.

Capital scenarios now provides budget allocation, objective presets, must-fund/exclusion constraints, immutable local saves, replay and comparison. Run `npm run test:scenarios` and `npm run e2e:scenarios`; see `docs/milestone-03.md`.

See `docs/adr-009-vite.md` and the workspace-level `NETONE_IMPLEMENTATION_PLAN.md` for architecture and upcoming milestones.

Server-backed scenarios, role checks, attributed audit and PDF/CSV/JSON exports are now implemented. Local persistence is an ignored `.netone-data` file; the dedicated PostgreSQL adapter and migration are prepared but not live-tested. See `docs/milestone-04.md` for configuration, permissions and limitations. Legacy API endpoints return 410. Do not deploy using the inherited database or `.vercel` linkage.

Run `npm run test:backend` and `npm run e2e:governance` against a separate test server at port 5175 (or set `BASE_URL`). Set `NETONE_LOCAL_DATA_DIR` to an isolated test directory for verification. Frontend browser tests now sign in through the server.

See [GitHub, Vercel and Neon deployment](docs/deployment.md) for persistent production setup.

Production: https://netone-black.vercel.app uses the dedicated Vercel Neon integration. Production accounts are separate from local demo accounts. See docs/deployment.md; node tests/database.mjs checks database-source boundaries.

## Canonical domain milestone

Network history, incident lifecycle, reviewed service rules, model sensitivity, controlled imports and shared candidate evidence are available through **Network, governance and data**. See [acceptance review](docs/acceptance-review.md) and [architecture amendment](docs/adr-010-canonical-workspace.md). All records remain synthetic.

## Local controlled-pilot extension

The application is now titled **NetOne Network Investment and Service Assurance Intelligence**. The extension is local and synthetic only; do not deploy or run migration 003 without separate authorisation. Read [pilot update and demo sequence](docs/pilot-update.md), [regulatory source mapping](docs/regulatory-feature-mapping.md) and [data governance](docs/data-protection-pilot.md). New verification commands: `npm run test:pilot` and `npm run e2e:pilot`, using an isolated local data directory and BASE_URL. The pilot API suite expects a fresh synthetic store; browser tests use the resulting explicit synthetic cases.
