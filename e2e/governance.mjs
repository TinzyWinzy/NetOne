import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const base = process.env.BASE_URL || 'http://127.0.0.1:5175';
const errors = [];
page.on('pageerror', error => errors.push(String(error)));
async function login(username) {
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill('netone-local-demo');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('button', { name: 'Capital scenarios', exact: true }).click();
}
try {
  await page.goto(base);
  await login('finance');
  await page.getByRole('button', { name: 'Run scenario', exact: true }).click();
  await page.getByRole('region', { name: 'Scenario result' }).waitFor();
  const name = `Shared scenario ${Date.now()}`;
  await page.getByLabel('Scenario name', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Save scenario on server' }).click();
  await page.getByRole('checkbox', { name: `Compare scenario ${name}`, exact: true }).waitFor();
  await page.reload();
  await page.getByRole('checkbox', { name: `Compare scenario ${name}`, exact: true }).waitFor();
  const row = page.locator('.priority-preview').filter({ has: page.getByRole('checkbox', { name: `Compare scenario ${name}`, exact: true }) });
  fs.mkdirSync('artifacts/qa', { recursive: true });
  for (const [button, check] of [['Export PDF', bytes => { assert.equal(bytes.subarray(0, 4).toString(), '%PDF'); fs.writeFileSync('artifacts/qa/decision-export.pdf', bytes); }], ['Export CSV', bytes => assert.match(bytes.toString(), /SYNTHETIC/)], ['Export evidence', bytes => { const data = JSON.parse(bytes.toString()); assert.equal(data.scenario.name, name); assert.equal(data.exportedBy, 'finance'); assert.equal(data.evidenceHash.length, 64); }]]) {
    const [download] = await Promise.all([page.waitForEvent('download'), row.getByRole('button', { name: button, exact: true }).click()]);
    check(fs.readFileSync(await download.path()));
  }
  await page.getByRole('button', { name: 'Evidence audit', exact: true }).click();
  await page.getByRole('heading', { name: 'Evidence audit', exact: true }).waitFor();
  await page.getByText('SCENARIO_EXPORTED', { exact: true }).first().waitFor();
  fs.mkdirSync('artifacts/qa', { recursive: true });
  await page.screenshot({ path: 'artifacts/qa/governance-desktop.png' });
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await login('executive');
  assert.equal(await page.getByRole('button', { name: 'Run scenario', exact: true }).isDisabled(), true);
  await page.getByRole('checkbox', { name: `Compare scenario ${name}`, exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Export PDF', exact: true }).first().isDisabled(), true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'artifacts/qa/governance-mobile.png' });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.deepEqual(errors, []);
  console.log('Governance journey passed: server login, shared saves across reload/roles, PDF/CSV/JSON exports, audit and read-only executive policy.');
} finally { await browser.close(); }
