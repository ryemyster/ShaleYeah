import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { selectImpact } from '../ci-impact.mjs';
import { assertGate } from '../ci-gates.mjs';

const codeRevision = 'a'.repeat(40);
const planFor = (file, eventName = 'pull_request') => selectImpact({ eventName, codeRevision,
  baseSha: 'b'.repeat(40), headSha: 'c'.repeat(40), changedPaths: [file] });

test('Market agent and backend changes select full employee qualification instead of obsolete caller work', () => {
  for (const file of ['agents/market-analyst/app/context_runtime.py', 'servers/market/src/review-workflow.ts']) {
    const plan = planFor(file);
    assert.equal(plan.full, false);
    assert.equal(plan.units.market, true);
    assert.deepEqual(Object.entries(plan.units).filter(([, selected]) => selected).map(([unit]) => unit), ['market']);
    assert.deepEqual(plan.callers, []);
  }
});

test('full push/manual and shared inputs require Market independently of the six remaining callers', () => {
  for (const plan of [planFor('CHANGELOG.md', 'push'), planFor('CHANGELOG.md', 'workflow_dispatch'), planFor('evaluations/shaleyeah_evaluations/market.py')]) {
    assert.equal(plan.full, true);
    assert.equal(plan.units.market, true);
    assert.equal(plan.callers.length, 6);
    assert.ok(!plan.callers.includes('market-analyst'));
  }
});

test('other passing roles, missing Market results or false reusable flags cannot waive selected qualification', () => {
  const plan = planFor('servers/market/src/index.ts');
  const results = { reference: 'skipped', reporter: 'skipped', economist: 'skipped', reservoir: 'skipped', risk: 'skipped', legal: 'skipped', market: 'success', 'protocol-callers': 'skipped' };
  const inputs = { geologist: false, reporter: false, economist: false, reservoir: false, risk: false, legal: false, market: true, callers: '[]' };
  assert.doesNotThrow(() => assertGate({ scope: 'reference', plan, results, codeRevision, inputs }));
  for (const result of ['failure', 'cancelled', 'skipped', undefined])
    assert.throws(() => assertGate({ scope: 'reference', plan, results: { ...results, market: result }, codeRevision, inputs }), /market/);
  assert.throws(() => assertGate({ scope: 'reference', plan, results, codeRevision, inputs: { ...inputs, market: false } }), /input/);
});

test('hosted Market job keeps native HTTP, external, installed, artifact and trace grading checks required', () => {
  const workflow = readFileSync(new URL('../../.github/workflows/reference-qualification.yml', import.meta.url), 'utf8');
  const start = workflow.indexOf('\n  market:\n');
  assert.ok(start >= 0);
  const end = workflow.indexOf('\n  protocol-callers:\n', start);
  assert.ok(end > start);
  const job = workflow.slice(start, end);
  assert.match(job, /if: inputs\.market/);
  assert.match(job, /uv run --locked pytest -q --cov=app --cov-fail-under=90/);
  assert.match(job, /run: pnpm --dir servers\/market test/);
  for (const step of ['grade_local_google.py', 'verify_cli_grade.py', 'check-extraction.mjs', 'check-containers.py']) assert.ok(job.includes(step));
  assert.doesNotMatch(job, /continue-on-error|--deselect|--ignore|test-name-pattern/);
  assert.match(workflow, /needs: \[economist, reservoir, risk, legal, market, protocol-callers, reference, reporter\]/);
});

test('the reusable workflow preserves one root job section and each existing job exactly once', () => {
  const workflow = readFileSync(new URL('../../.github/workflows/reference-qualification.yml', import.meta.url), 'utf8');
  assert.equal([...workflow.matchAll(/^jobs:$/gm)].length, 1);
  const jobs = [...workflow.slice(workflow.indexOf('\njobs:\n')).matchAll(/^  ([a-z][a-z-]*):$/gm)].map((match) => match[1]);
  assert.equal(new Set(jobs).size, jobs.length);
  assert.deepEqual([...jobs].sort(), ['economist', 'reservoir', 'risk', 'legal', 'market', 'protocol-callers', 'reference', 'reporter', 'qualification-gate'].sort());
});
