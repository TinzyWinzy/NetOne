# Capital scenario milestone

Implemented 5 October 2026 in the existing Vite application.

Capital scenarios accepts a USD budget, six objectives, minimum objective score, portfolio filters, required interventions and explicit exclusions. The deterministic baseline selects by objective-adjusted priority per dollar after allocating must-fund candidates. It prevents overspend and conflicting actions at one site, and permits unallocated capital. It is a heuristic, not a claim of globally optimal selection or predicted financial return.

Objective weights are explicit versioned demo presets independent of edited Capital priorities weights. Objective value is the sum of selected objective priority points, not dollars or forecast benefit. Candidate normalised values and action relevance reconstruct objective scores. Financial costs must have the same currency, basis and reporting month. Monetary arithmetic uses integer cents; negative, excessive, invalid or over-precise amounts are rejected.

Must-fund candidates must be present, eligible, within region/technology/state constraints, above minimum objective score, mutually compatible and affordable together. Failure yields a visible infeasible request without a partial allocation. Optional candidates receive selection/exclusion explanations. Required choices retained after filter changes can become unavailable; clearing constraints resolves those stale selections.

Each saved scenario includes input parameters, scope, objective weights, candidate evidence, model/configuration references, allocations and engine version. Snapshots are cloned rather than updated when inputs change. Results display their original inputs; editing the form requires another run. Multiple local records survive reloads and can be compared. Replay checks allocation reproducibility using the stored candidate universe. Malformed or incompatible browser records are ignored during loading.

Storage is local to the browser, without authenticated ownership, shared database persistence, approval or server audit. Directional intervention benefit estimates remain deferred because no validated effect model is available. Inclusion objectives can legitimately return no allocation at higher minimum scores when no eligible strategic intervention is available.

Verification: TypeScript, production build, scenario/investment domain invariants and scenario browser flow. Domain tests cover no overspend, one action per site, eligibility, unallocated budget, impossible/conflicting must-fund selections, currency mismatch, minimum thresholds, region/state constraints, precision and immutable replay. Browser tests cover objective changes, saving two scenarios, comparison, replay, infeasibility, reload and mobile width. Desktop/mobile screenshots were inspected.

Next milestone: shared persistence, authenticated server permissions, evidence/audit and exports. No operator systems, inherited database or deployment were changed.
