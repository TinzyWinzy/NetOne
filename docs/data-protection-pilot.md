# Data protection controls for the synthetic pilot

Status: proposed processing/retention decisions require DPO and controller approval; implemented technical controls do not establish statutory compliance. Sources: Act 5/2021 ss.7–8,13–20,28–29; SI 155/2024 ss.3–4,8,10,12–14,16–17; POTRAZ Compliance Assessment guidance §5(c) and Annexure A.

| Processing / classification | Purpose / minimisation | Role and retention decision |
| --- | --- | --- |
| Fictional network/site/cell aggregates | Service-risk screening and decision evidence; no subscriber identifiers | Authenticated readers; synthetic import gates. Pilot dataset lifecycle to be approved. |
| Usernames, roles, password hashes, signed sessions | Account access and server attribution; no plaintext credentials in records | Admin manages configuration outside the UI. Keep identity while access is active; withdrawal/revocation must precede deletion. Proposed, not a statutory retention duration. |
| Audit, reviews, evidence source references and narrative notes | Reconstruct decisions and changes | Role-restricted audit/export. Account attribution can be personal data. Do not place actual personal/operator information into synthetic notes. Retention, legal holds, redaction and deletion/anonymisation require approved policy. No automatic purge of decision evidence. |
| Revoked session hashes | Prevent replay through token expiry | Server use only; local expired records are pruned. Database cleanup/retention job remains to be approved. |
| CSV/JSON synthetic imports | Controlled aggregate ingestion and quarantine | Admin only; allowed-field validation rejects unknown/customer fields and demo=false. No general evidence-file upload endpoint is enabled. |
| Downloads | Authorised investment discussion | Finance/Admin only; export event audited. Recipients/storage/deletion require approved controller policy. |
| Privacy/security incident notes | Containment and DPO/breach review | Admin only mutation; separate from network incidents. No automatic reporting and no assumed statutory notification timer. |

Before any real pilot, identify the entity deciding purposes/means and its processors, applicability/exemptions and accountable DPO. Keep a processing register covering purposes, lawful basis, categories, recipients, hosting locations, transfers, safeguards, retention and rights-handling. Obtain relevant appointment/licence/exemption evidence and processor agreements; assess Vercel/Neon cross-border arrangements and DPIA need. Account/audit data prevents a blanket claim of zero personal data even when network fixtures are synthetic.

Incident process: record a restricted synthetic security event → containment/review → assess affected processing and evidence → DPO/legal assessment of any notification duty → explicitly authorised external action outside this app → closure with retained review. The implemented prototype records OPEN → UNDER_REVIEW → CLOSED; it does not send notifications, determine a statutory breach or certify compliance. A broader incident response runbook, multi-instance throttling, SSO, retention/deletion execution and security review remain pilot gates.
