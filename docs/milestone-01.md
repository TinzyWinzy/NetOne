# First NetOne delivery

Implemented 5 October 2026 on `netone-cfo-core`.

The copied Vite application now opens on the NetOne executive portfolio. It includes 100 deterministic fictional sites, regional coordinates, technology classes, two reporting months, CAPEX/OPEX and contribution proxies, reliability evidence, strategic tags and intervention history. Region, technology, primary decision state and month filters are shared by portfolio, map and site views. Site links use URL parameters and support reload and browser history.

Missing contribution/utilisation values remain null. Contribution totals state their coverage. Partial, stale and conflicting evidence is visible. Review prompts are explicitly separated from scored recommendations. A site case combines demand, reliability, financial basis, strategy, history and fixture provenance.

The existing MapLibre foundation and presenter gate were adapted. Legacy operational/customer components remain unmounted reference code. This milestone uses local fixtures and makes no calls to inherited API routes. No database migration or deployment was performed.

Verified: TypeScript, production bundle, portfolio invariants and the Playwright NetOne journey. Desktop and mobile screenshots were visually inspected. Browser tests cover filter/totals changes, site evidence, reporting month, history navigation, missing data, reload, regional map drill-down, page width and absence of legacy API calls.

Remaining M0 work: shared API services, broader canonical investment/scenario contracts, and requirement traceability. M1 foundation and CFO/site flow are implemented; formal requirement sign-off remains open. Next delivery adds candidate generation, versioned scoring, component explanations and intervention comparison. Server authentication, persistence, regulatory evaluation and scenario allocation remain pending. The map library is lazy loaded but still creates a large bundle.
