# NetOne prototype API contract

All operations use /api/netone?action=NAME. Reads use GET; commands use POST JSON with the exact public Origin and signed HttpOnly session. Client actors/roles do not establish identity. Candidate/scenario reads/exports accept id as a query parameter. Responses are no-store.

| Action | Access | Contract |
| --- | --- | --- |
| workspace GET | Authenticated | Canonical workspace, evidence summaries; raw import records restricted to Admin. |
| incidents POST | Network/Admin | create or adjacent transition, siteId, note and expected revision. |
| rules POST | Regulatory/Admin | create/review/activate/retire/evaluate, exact version and revision; review requires note. |
| config POST | Finance/Admin create; Admin activate | Immutable seven-weight configuration, minimumScore, revision. |
| sensitivity POST | Finance/Network/Admin | filters; five comparison baselines and threshold counts. |
| score POST | Finance/Admin | filters, optional configId, revision; authoritative candidate/component evidence snapshots. |
| candidate-evidence GET/POST | Authenticated read; Finance/Admin save | Read by id; save candidateId and filters under persisted config, revision. |
| candidate-export POST | Finance/Admin | id; audited immutable evidence with data status/export identity. |
| imports POST | Admin | source, key, format json/rows or csv/csv, revision; 100 synthetic rows maximum. |
| reviews POST | Finance/Admin submit; Network/Regulatory/Admin transition | subjectType candidate/scenario, subjectId, note; transition uses status; revision required. |
| run/scenarios POST | Finance/Admin | Validated scenario input; save optional expectedHash to reject source/policy drift. |
| scenarios GET | Authenticated | Shared frozen scenario records. |
| export POST | Finance/Admin | Stored scenario id, audit and export hash. |
| audit GET | Finance/Regulatory/Admin | Server-attributed retained audit records. |

400 invalid command; 401 missing session; 403 role/origin denial; 404 missing record/action; 409 stale revision or idempotency conflict; 413 oversized request; 503 storage/configuration unavailable. Commands refresh the workspace after mutation. No silent fixture fallback is used in a failed production workspace load.

Review lifecycle: SUBMITTED → IN_REVIEW → REVIEWED or CHANGES_REQUESTED → IN_REVIEW. Incident lifecycle: OPEN → ACKNOWLEDGED → INVESTIGATING → FIELD_RESPONSE → RESTORED → VERIFIED → CLOSED. Review completion does not approve capital expenditure.

## Pilot command contract (local, not deployed)

POST action=pilot accepts expected revision and explicit operation. Network/Admin record synthetic cell counters, diagnosis, engineering review, implementation and outcomes. Regulatory/Admin record obligation interpretation/applicability and finding confirmation; missing authoritative provisions cannot be reviewed into numerical evaluation. Finance/Admin submit investment cases. Network/Finance/Admin can draft cases/options; Network/Regulatory/Admin review submitted cases. Admin handles separate privacy/security reviews. Server identities determine actors and roles. Unsupported/insufficient evidence cannot be confirmed, submitted or verified through forged client status.

POST compare-objectives is Finance/Admin only and generates Balanced/Growth/Reliability from one canonical candidate/policy snapshot. Service Assurance is a separate evidence-gated objective. Must-fund requests require rationale; no mandatory expenditure is inferred.

Pilot observations retain independently entered synthetic counters and a cell/site/service/technology/window mapping. Unknown benefit inputs are null. No arbitrary uploaded evidence documents or real operator measurements are accepted. Source references/notes must remain fictional in this deployment.
