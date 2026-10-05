# ADR 009 Retain Vite for the NetOne prototype

Accepted 5 October 2026 by user direction.

Retain the copied React/Vite/TypeScript application and standalone Vercel functions. This supersedes the Next.js frontend and route-handler layout in the supplied SAD. Keep independent domain services and canonical models. Existing Neon PostgreSQL access can remain; changing providers is not a prerequisite.

M0/M1 reads deterministic synthetic fixtures in the browser without calls to inherited API/database services. Legacy components and handlers remain in the source as reference but are not mounted by the NetOne shell. Remove them from the active deployed surface or secure them before release. The presentation PIN is not authentication. No deployment or database migration is performed.

Scoring, scenarios, durable evidence, server-side permissions and shared local/deployed services remain pending milestones.

Implementation status update (5 October 2026): signed server sessions replace the presentation PIN; shared evidence, canonical Neon domains, scoring/governance/imports and Vercel deployment are implemented. See ADR-010 and the acceptance review. The pending statements above preserve the original decision context.
