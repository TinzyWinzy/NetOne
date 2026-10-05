# Deploy NetOne with GitHub, Vercel and Neon

GitHub stores code. Vercel serves Vite and the /api/netone server function. Dedicated Neon Postgres stores scenarios, audits and revoked sessions. Site observations remain synthetic fixtures.

## GitHub

The Git repository is Econet/econet-compliance-poc. Preserve its history; do not run git init or overwrite README.md. GitHub CLI is currently signed out. Run gh auth login, then inspect TinzyWinzy/NetOne and its branches before pushing. Reconcile any existing remote commits without force-pushing.

For an empty NetOne repository, run from the app directory:

```powershell
git remote rename origin econet-source
git remote add origin https://github.com/TinzyWinzy/NetOne.git
git status
git add .
git diff --cached --stat
git commit -m "Adapt NetOne investment intelligence and persistent evidence API"
git push -u origin HEAD:main
```

Review staged files for secrets before committing. Environment files, local evidence and QA artifacts must remain ignored.

## Vercel and Neon

1. Import TinzyWinzy/NetOne into a NEW Vercel project, netone. Production branch: main. Framework: Vite. Root directory: . when publishing the app repository. Build: npm run build. Output: dist.
2. Create a dedicated NetOne Neon database through Vercel Marketplace or Neon. Use separate production and preview databases.
3. Set NETONE_DATABASE_URL explicitly to its connection string. The inherited DATABASE_URL is intentionally unused.
4. Run db/migrations/001-netone-evidence.sql in the Neon SQL editor, or npm run migrate:netone with NETONE_DATABASE_URL injected into the process. Use an administrative migration identity. Give the application role schema USAGE and SELECT/INSERT on the three tables. Do not migrate during every Vite build.
5. Configure the server-only variables below in Vercel, then redeploy.

| Variable | Value |
| --- | --- |
| NETONE_DATABASE_URL | Dedicated Neon connection string |
| NETONE_AUTH_SECRET | Stable cryptographically random secret, at least 32 characters |
| NETONE_USERS_JSON | JSON array of hashed account records |
| NETONE_PUBLIC_ORIGIN | Exact production HTTPS origin, no trailing slash |

Generate each account with node db/create-account.mjs, supplying NETONE_ACCOUNT_NAME, NETONE_ACCOUNT_ROLE and NETONE_ACCOUNT_PASSWORD in the process environment. Collect the emitted hashed account records into a JSON array. Production does not enable the local demo accounts. Never prefix credentials with VITE_.

The copied .vercel/project.json still links Econet. Dashboard import avoids that linkage. Before any CLI deployment, run vercel link and explicitly select and verify the new NetOne project.

## Acceptance

Sign in as Finance, run and save a uniquely named scenario, and check its audit event. Redeploy and sign in again: both records must remain. Check logout revokes the old session, Executive can read but cannot save/export, and exports retain the stored evidence hash. Live Neon persistence is not verified until these checks pass.

Local .netone-data/store.json records are not imported automatically; the production database starts empty. A deliberate import needs record validation and duplicate handling.

Once Vercel Git integration is connected, pushes to main deploy production. Preview environments require separate database credentials, accounts and a matching origin; do not share production data with preview code.
