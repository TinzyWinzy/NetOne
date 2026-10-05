# ADR-010: Canonical workspace and controlled prototype governance

Status: deployed; synthetic production workflows and post-redeployment persistence verified on 5 October 2026.

Retain Vite and the authenticated Vercel API. Dedicated Neon holds an optimistic revision-controlled workspace plus relational projections for sites, metric observations, financials, interventions, mappings, incidents/events, rule versions/evaluations, policy versions, candidate evidence/candidates/components, import runs, reviews and scoring runs. Migration 002 is additive and preserves existing scenario/audit/revocation tables. External app IDs map deterministically to UUID database IDs.

Commands validate role, canonical inputs and expected revision. A guarded database function rejects stale writes; projections and audit commit in the same transaction. Historical rule evaluations and candidate snapshots are append-only through repository operations. Mutable sites/incidents/rules/reviews are projected on each mutation. No database privilege enforcement of immutability is claimed.

Imports accept at most 100 synthetic rows and 90 KB CSV input, with a 100 KB request limit. Only USD nominal synthetic monthly aggregates and supported periods are accepted. Unknown/customer-level fields, conflicting identity, invalid ranges and duplicates are quarantined. Source plus external reference maps to a canonical asset; canonical_ref explicitly maps an existing site. The same idempotency key/payload returns the prior import; changed payload conflicts. Accepted raw records and previous observations retain lineage. Imported periods trigger fresh retained evaluations.

Rule versions progress draft → reviewed → active → retired; effective intervals for the same code cannot overlap. Monthly aggregates require a rule covering the full month. Model versions require seven weights totalling 100; Finance/Admin create, Admin activates. Candidate evidence is calculated on the server under the persisted policy, with source snapshots and SHA-256. Reviews retain events and require adjacent transitions; they do not authorise spending.

Tradeoffs: workspace reads and mutable projections scale with portfolio/history size. Pilot growth requires paginated queries, incremental writes and bounded background ingestion. Current imports are aggregate site observations, not adapters to live NetOne systems. Vercel runtime uses explicit NetOne database opt-in; local inherited DATABASE_URL is ignored.
