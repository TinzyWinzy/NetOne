import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const compile = path => ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const url = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const portfolioUrl = url(compile('src/domain/portfolio.ts'));
const engine = await import(url(compile('src/domain/investments.ts').replace("'./portfolio'", JSON.stringify(portfolioUrl))));
const { buildPortfolio } = await import(url(compile('src/data/portfolio.ts').replace("'../domain/portfolio'", JSON.stringify(portfolioUrl))));
const sites = buildPortfolio();
const { generateCandidates, rankCandidates, DEFAULT_WEIGHTS, validateWeights } = engine;
const candidates = generateCandidates(sites, '2026-09');
assert.equal(candidates.length, 400);
assert.equal(new Set(candidates.map(candidate => candidate.id)).size, 400);
assert.deepEqual(candidates, generateCandidates(sites, '2026-09'));
assert.deepEqual(rankCandidates(candidates), rankCandidates([...candidates].reverse()), 'ranking independent of input order');
for (const candidate of candidates) {
  assert.equal(candidate.components.length, 7);
  if (candidate.eligible) {
    assert.ok(candidate.score >= 0 && candidate.score <= 100);
    assert.ok(Math.abs(candidate.score - candidate.components.reduce((sum, item) => sum + item.contribution, 0)) < 1e-9);
    assert.ok(candidate.components.every(item => item.normalised >= 0 && item.normalised <= 100));
  } else assert.equal(candidate.score, null);
  assert.ok(candidate.estimatedCost > 0);
  assert.ok(candidate.sourceRef.includes(candidate.period));
  assert.equal(candidate.serviceEvidence.rule.version, '1');
}
for (const site of sites.filter(site => site.observations[1].quality !== 'COMPLETE')) {
  assert.ok(candidates.filter(candidate => candidate.siteId === site.id).every(candidate => !candidate.eligible && candidate.score === null && candidate.components.every(item => item.contribution === null)));
}
const growWeights = { ...DEFAULT_WEIGHTS, demand: 100, growth: 0, commercial: 0, reliability: 0, service: 0, opex: 0, strategy: 0 };
assert.notDeepEqual(rankCandidates(candidates).filter(candidate => candidate.eligible).map(candidate => candidate.id), rankCandidates(generateCandidates(sites, '2026-09', growWeights)).filter(candidate => candidate.eligible).map(candidate => candidate.id));
assert.ok(generateCandidates(sites, '2026-09', growWeights).filter(candidate => candidate.siteId === 'N001').every(candidate => candidate.score === null), 'zero missing-component weight must not bypass evidence policy');
assert.throws(() => generateCandidates(sites, '2026-09', { ...DEFAULT_WEIGHTS, demand: 21 }), /100/);
assert.ok(validateWeights({ ...DEFAULT_WEIGHTS, demand: NaN }));
assert.ok(validateWeights({ ...DEFAULT_WEIGHTS, demand: -1 }));
const invalidSite = structuredClone(sites[1]);
invalidSite.observations[1].availability = 150;
assert.ok(generateCandidates([invalidSite], '2026-09').every(candidate => candidate.score === null && candidate.reason.includes('invalid')));
const oversized = structuredClone(sites[1]);
oversized.observations[1].contribution = 10000000;
assert.equal(generateCandidates([oversized], '2026-09')[0].components.find(component => component.code === 'commercial').normalised, 100);
const copiedWeights = { ...DEFAULT_WEIGHTS };
const snapshot = generateCandidates(sites, '2026-09', copiedWeights);
copiedWeights.demand = 0;
assert.equal(snapshot[0].weights.demand, 20);
assert.deepEqual(JSON.parse(JSON.stringify(candidates)), candidates, 'evidence serialisation preserves reconstruction inputs');
console.log('Investment invariants passed: reconstruction, bounds, deterministic ranking, eligibility, abstention, weight validation, sensitivity and snapshots.');
