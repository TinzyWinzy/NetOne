import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const compile = path => ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const domainUrl = moduleUrl(compile('src/domain/portfolio.ts'));
const domain = await import(domainUrl);
const { buildPortfolio } = await import(moduleUrl(compile('src/data/portfolio.ts').replace("'../domain/portfolio.js'", JSON.stringify(domainUrl))));
const sites = buildPortfolio();
assert.equal(sites.length, 100);
assert.equal(new Set(sites.map(site => site.id)).size, 100);
assert.deepEqual(sites, buildPortfolio());
for (const period of domain.PERIODS) {
  const total = domain.summarise(sites, period);
  assert.equal(domain.STATES.reduce((sum, state) => sum + sites.filter(site => domain.decisionState(site, domain.observation(site, period)) === state).length, 0), 100);
  assert.ok(domain.STATES.filter(state=>!['Service risk','Commercially strong'].includes(state)).every(state => sites.some(site => domain.decisionState(site, domain.observation(site, period)) === state)));
  assert.ok(total.contributionKnown < sites.length);
  assert.equal(total.capex, sites.reduce((sum, site) => sum + domain.observation(site, period).capex, 0));
  for (const region of new Set(sites.map(site => site.region))) {
    const filtered = domain.filterPortfolio(sites, { ...domain.DEFAULT_FILTERS, region, period });
    assert.equal(filtered.length, 20);
    assert.ok(filtered.every(site => site.region === region));
  }
  assert.ok(sites.every(site => {
    const row = domain.observation(site, period);
    return row.failureCost <= row.opex && (!(row.utilisation === null || row.contribution === null) || row.quality !== 'COMPLETE');
  }));
}
assert.equal(domain.summarise([], '2026-09').capex, 0);
assert.equal(domain.usd(null), 'Unavailable');
assert.ok(Math.abs(sites.find(site => site.region === 'Bulawayo').latitude + 20.15) < .2);
console.log('Portfolio invariants passed: deterministic seed, states, filters, totals, missing data and geography.');


const special=structuredClone(sites[0]);const metric={...special.observations[1],availability:99.9,faults:0,utilisation:60,contribution:20000};special.strategic=false;assert.equal(domain.decisionState(special,metric),'Commercially strong');special.serviceRisk=true;assert.equal(domain.decisionState(special,metric),'Service risk');
