# PRD/SAD acceptance review — 5 October 2026

This is a synthetic prototype acceptance record, not NetOne policy or enterprise production certification. The original PRD/SAD remain the baseline; this record and ADR-010 describe implementation amendments.

## PRD traceability

| PRD requirement | Implemented behaviour | Verification |
| --- | --- | --- |
| PRD-EXE-001/002 | Portfolio KPIs, drill-down and filters | portfolio tests; core browser journey |
| PRD-MAP-001 | Utilisation, reliability, priority and risk map modes | domains browser layouts; map interactions |
| PRD-SIT-001/002 | Combined site case and ordered synthetic interventions | site browser journey; retained source records |
| PRD-INV-001/002/003 | Candidates, decomposable scores and comparison | investment unit/browser tests; canonical component projection |
| PRD-SCN-001/002/003/004/005 | Budgets, six objectives, constraints, abstention and comparison | scenario invariant/browser tests; saved replay |
| PRD-NET-001 | Six-month utilisation, traffic, availability, downtime and faults | domain API and responsive browser tests |
| PRD-INC-001/002 | Seven retained states, site links and incident burden | domain lifecycle tests; source snapshots |
| PRD-REG-001/002 | Reviewed version activation, effective dates and warning evidence | domain API rule/history tests |
| PRD-EVD-001 | Immutable candidate/scenario inputs, policies, rules and hashes | export tests; redeployment verification |
| PRD-GOV-001 | Explicit missing values and source quality; withheld scores | portfolio/investment tests; incomplete evaluations |
| PRD-GOV-002 | Authorised policy versions and ranking/threshold sensitivity | domain role and five-baseline tests |
| PRD-GOV-003 | Server-attributed mutation, scoring, review and export audit | domain/API audit assertions |
| PRD-REP-001 | Candidate/scenario PDF, CSV and full JSON | download browser tests |
| PRD-AUTH-001 | Five role policies; signed HttpOnly sessions | backend/domain permission tests |
| PRD-DAT-001 | Synthetic markers and synthetic-only controlled imports | domain import rejection tests; UI labels |

Local domain API, domain invariants, responsive domain browser checks (320, 390, 768 and 1440 pixels) and TypeScript/production build passed. Production migration, workflow and post-redeployment verification are recorded below once completed. Browser layout coverage does not independently prove every filter/mode combination.

## SAD alignment

- Sections 7–10: additive canonical entity tables, external source mappings, period/source/quality metrics, financial basis, candidate components, validated CSV/JSON, quarantine and idempotency. Workspace replacement, relational projection and mutation audit commit in one PostgreSQL transaction.
- Domain/scoring/scenarios: framework-independent deterministic calculation, immutable decision snapshots and six objective presets. Balanced allocation uses the active policy; evidence preserves the policy used.
- Governance and sensitivity (§24): immutable weight versions, Admin activation, baseline rank movement/top-ten overlap and minimum-threshold counts. Minimum score defaults scenario selection; it does not silently remove candidates from the entire application.
- Evidence: candidate/scenario hashes and frozen source/rule/model references, retained incident events, review submissions and authorised exports. REVIEWED is a review state, not capital approval.
- Security: server-derived identities/roles, origin checks, signed sessions and persisted revocation. In-process login throttling remains unsuitable as a distributed enterprise control.
- Deployment amendments: retained Vite/React, Vercel API functions and dedicated Neon Postgres, as authorised by the user. No Next.js/Supabase migration is required.

## Release gates and remaining limitations

v0.1/v0.2 functionality is deployed and previously verified. v0.3/v0.4 functionality is implemented and locally verified; final release acceptance requires successful migration, production journeys and retained evidence after redeployment.

Pilot gates remain open: approved NetOne extracts and source ownership, financial/strategic definitions, owner-validated service/regulatory rules, intervention-outcome validation, stakeholder UAT and a documented go/no-go. Synthetic associations do not establish causal investment benefit. Monthly rule evaluation requires full-period coverage; no day-level interpolation is inferred. Incident burden is current linked estimated burden and is not added again to observed OPEX.

Enterprise SAD gates remain open: SSO/identity lifecycle, approved deployment/data residency, distributed throttling, central telemetry/alerts, measured load targets, backup/restore and disaster-recovery exercises, security review and separate preview data. Public SEO is outside authenticated prototype acceptance.
