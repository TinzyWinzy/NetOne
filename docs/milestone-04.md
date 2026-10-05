# Persistence and governance delivery

Implemented 5 October 2026 in the copied Vite application.

## Local verified behaviour

The frontend now uses server accounts and signed eight-hour HttpOnly SameSite sessions. Accounts determine roles on the server; client-supplied roles and actors are ignored. Logout clears the cookie and persists token revocation. Five failed account attempts trigger a 15-minute in-process limit. Mutations require the correct Origin header.

Local demonstration accounts are finance, executive, network, regulatory and admin, with password `netone-local-demo`. These are development-only identities, not production credentials. Local signing keys are process-local, so a server restart requires sign-in again. Scenario and audit data are retained in ignored `.netone-data/store.json`. The single-process local repository serialises writes and atomically replaces the store file. It is not a multi-instance database or a tamper-proof evidence vault.

Finance and Admin can run/save scenarios and export records. All authenticated roles can read shared synthetic scenario evidence. Finance, Regulatory and Admin can read audit records. Executive cannot run/save/export. The signed session checks account identity and role on each request.

Scenario commands regenerate the filtered synthetic candidate universe and recompute allocation on the server. Client-provided costs, results, evidence or actors cannot establish saved truth. Each saved snapshot and its attributed audit entry are committed together. Evidence is identified by SHA-256 over canonical sorted JSON; exports carry the same reproducible hash, model/rule/input references and demo status. Run, save, export, login and logout operations are audited.

PDF decision records summarise budget, constraints, allocations, versions and evidence references. CSV includes every allocation and exclusion reason; JSON contains the complete evidence snapshot. CSV text is escaped against formula interpretation. Export authorisation and audit occur before the browser creates the download. Legacy Econet API handlers are retired with HTTP 410 in development and Vercel handlers.

## Dedicated PostgreSQL path

`server/repository.ts` supports PostgreSQL through `NETONE_DATABASE_URL`; it never reads inherited `DATABASE_URL`. `db/migrations/001-netone-evidence.sql` provides immutable scenario snapshots, audit records and revoked sessions. `npm run migrate:netone` applies that migration to the explicitly configured NetOne database. No external database was provisioned or migrated in this delivery. PostgreSQL transactions are implemented and type-checked but have not been exercised against a live database.

Deployment requires all of the following:

- `NETONE_DATABASE_URL` for a dedicated migrated database.
- `NETONE_AUTH_SECRET`, at least 32 characters, stored as a secret.
- `NETONE_PUBLIC_ORIGIN`, the exact HTTPS application origin.
- `NETONE_USERS_JSON`, an array of username/role/salt/hash account records. `db/create-account.mjs` generates a scrypt record from account environment variables; configure the output without retaining the plaintext password.

Production refuses development accounts and file persistence when the required configuration is absent. Provision a separate migration identity and grant the app account SELECT/INSERT only on the NetOne tables. Backup/restore, enterprise identity lifecycle, multi-instance rate limiting and private deployment remain pilot/production work.

## Verification and remaining scope

Verified locally: authentication failure, role spoofing, wrong Origin, cookie tampering, authoritative recomputation, permissions, server audit attribution, logout token replay denial, shared scenarios across reload/roles, PDF/CSV/JSON downloads and browser layouts. Domain invariant tests remain green. Backend integration exposed and fixed an asynchronous run/save race. All existing executive/investment/scenario journeys were updated for server sign-in.

Local browser scenarios from milestone 3 are retained in browser storage but are not silently imported; new saves go to the server. A fresh database/store starts without those records. Canonical source-system tables/imports, full incident lifecycle, regulatory owner review, shared score-configuration governance, standalone investment-card exports and final acceptance remain later work. This delivery does not claim enterprise readiness or a complete production schema.

Production setup (2026-10-05): dedicated NetOne Vercel project and Neon integration activated. Finance/Admin account hashes and origin are configured. Schema applied inside Vercel without exporting sensitive database variables. Live authentication, scenario save, audit/hash export and logout revocation verified. Database guard regression test: node tests/database.mjs.
