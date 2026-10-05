# Investment prioritisation milestone

Implemented 5 October 2026 in the existing Vite app.

## Delivered behaviour

Capital priorities shares the portfolio's region, technology, decision-state and reporting-month filters. It generates four candidate alternatives per site: capacity upgrade, power resilience, backhaul improvement and targeted maintenance. The default September fixture produces 400 candidates, of which 87 are eligible. Eligibility is an advisory demonstration gate, not approved engineering feasibility.

Candidates include fictional USD intervention costs, eligibility reasons, seven score components, source/period, evidence completeness, model and weight versions, normalisation assumptions and an exact demonstration service-rule record. Rankings are deterministic, with score descending, cost ascending and ID as tie-breaks. Ineligible candidates have no aggregate recommendation score.

Each scored component equals its bounded 0–100 input multiplied by the action relevance coefficient and the percentage weight divided by 100. The aggregate is the full-precision sum; display rounding does not change ranking. Default weights follow the PRD: demand 20, growth 15, commercial 20, reliability 15, service 15, operating burden 10 and strategy 5 percent.

Normalisation is fixed to versioned demo bounds rather than the currently filtered population. This prevents filters from changing an individual candidate's score. Fault frequency represents reliability burden; recurring failure cost represents operating burden. The monthly commercial contribution is a proxy. None of these scores predicts ROI or causal intervention benefit.

Missing, partial, stale, conflicting or invalid critical inputs withhold all scoring and candidate eligibility. Zero weights do not bypass this requirement. No renormalisation substitutes for missing evidence. Every component retains its raw input, source reference, unit, transform, relevance, weight and contribution. Cost basis and synthetic provenance are explicit.

Users can inspect any candidate, compare two eligible or excluded alternatives, vary weights after a 100-percent validation check, restore defaults and save the full candidate evidence run to local browser storage. Selecting a third candidate replaces the oldest selection. The existing site case now includes its leading eligible intervention and expandable evidence for all alternatives. The CFO portfolio shows its three highest-priority candidates.

## Demonstration policy

Availability rule `DEMO-AVAILABILITY` version 1 covers August and September 2026 and tests availability below 98 percent. Its source is explicitly synthetic product configuration. It is not a validated legal threshold or NetOne policy. The rule and observed availability are captured in each candidate.

Eligibility gates: capacity requires utilisation of at least 80 percent; backhaul requires utilisation of at least 65 percent and growth of at least 5 percent; resilience requires availability below 98 percent; maintenance requires at least three monthly faults. Complete evidence is required for every action. Relevance coefficients are versioned in the pure domain engine and shown in the evidence table. Alternative interventions at one site must not be treated as additive benefit programmes.

Weight edits are session-only demonstration settings; reload restores defaults. A saved local snapshot retains the weights and evidence of that run, overwriting the previous local snapshot. This is not durable shared evidence, audit governance or role-authorised model administration. No operator API, database migration or deployment was added.

## Verification

TypeScript and production bundling pass. Domain tests cover score reconstruction/bounds, candidate identity, deterministic ranking, eligibility, missing-data abstention even at zero component weight, invalid metrics, invalid weight totals, changed ranking, clipping and serialisable snapshots. Browser tests cover comparison, excluded records, individual inspection, weight validation/change, snapshot content, filters, site scoring, direct route reload and mobile width. The previous CFO/site/map browser journey also passes. Desktop and mobile comparison screenshots were inspected.

PRD coverage: INV-001, INV-002 and INV-003 demonstration behaviour; foundation for versioned service evidence. Durable component persistence, controlled model administration and full regulatory lifecycle remain in later milestones. Next: constrained capital scenarios, must-fund feasibility, exclusions and saved scenario comparison.
