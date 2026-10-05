# NetOne deployment

GitHub: TinzyWinzy/NetOne, production branch main. Vercel project netone serves Vite dist and /api/netone. Neon stores canonical domains, scenarios, audits and session revocations. The managed .vercel project must reference NetOne, never the inherited Econet project.

Server-only variables: NETONE_AUTH_SECRET, NETONE_USERS_JSON (hashed accounts), NETONE_PUBLIC_ORIGIN and either explicit NETONE_DATABASE_URL or Vercel-only NETONE_DATABASE_SOURCE=vercel-neon with its integration DATABASE_URL. Local inherited DATABASE_URL is ignored. Never export sensitive integration variables or commit credentials. Preview deployments require separate data and origins.

Migration files are additive and applied in sorted order by db/migrate-netone.mjs. For this release run: npx vercel --prod --yes --build-env NETONE_MIGRATE=1. The flag lets the Vercel build use its own integration credentials; normal deployments omit it. Existing evidence is preserved. The canonical repository requires SELECT/INSERT/UPDATE and permission to execute the revision function; schema migration requires DDL privileges.

Verify login, canonical workspace initialization, role boundaries, incidents, rule review/evaluation/history, policy versions/sensitivity, scoring components, import quarantine/idempotency, shared candidate export/review and audit. Redeploy without the migration flag and compare immutable records byte-for-byte. Backup/restore exercises and enterprise identity remain pilot work.
