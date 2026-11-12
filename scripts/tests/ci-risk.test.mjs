import assert from 'node:assert/strict';
import test from 'node:test';
import { selectImpact } from '../ci-impact.mjs';
import { assertGate } from '../ci-gates.mjs';

const codeRevision = 'a'.repeat(40);
const planFor = (file, eventName = 'pull_request') => selectImpact({ eventName, codeRevision,
  baseSha: 'b'.repeat(40), headSha: 'c'.repeat(40), changedPaths: [file] });

test('Risk agent and backend changes select full employee qualification without obsolete caller-only work', () => {
  for (const file of ['agents/risk-analyst/app/context_runtime.py', 'servers/risk-analysis/src/review-workflow.ts']) {
    const plan = planFor(file);
    assert.equal(plan.full, false);
    assert.equal(plan.units.risk, true);
    assert.deepEqual(Object.entries(plan.units).filter(([, selected]) => selected).map(([unit]) => unit), ['risk']);
    assert.deepEqual(plan.callers, []);
  }
});

test('full push/manual and unknown/shared changes include Risk independently of remaining protocol callers', () => {
  for (const plan of [planFor('CHANGELOG.md', 'push'), planFor('CHANGELOG.md', 'workflow_dispatch'), planFor('evaluations/shaleyeah_evaluations/risks.py')]) {
    assert.equal(plan.full, true);
    assert.equal(plan.units.risk, true);
    assert.equal(plan.callers.length, 8);
    assert.ok(!plan.callers.includes('risk-analyst'));
  }
});

test('no other successful role, missing result or reusable flag can waive selected Risk qualification', () => {
  const plan = planFor('servers/risk-analysis/src/index.ts');
  const results = { reference: 'skipped', reporter: 'skipped', economist: 'skipped', reservoir: 'skipped', risk: 'success', 'protocol-callers': 'skipped' };
  const inputs = { geologist: false, reporter: false, economist: false, reservoir: false, risk: true, callers: '[]' };
  assert.doesNotThrow(() => assertGate({ scope: 'reference', plan, results, codeRevision, inputs }));
  for (const result of ['failure', 'cancelled', 'skipped', undefined])
    assert.throws(() => assertGate({ scope: 'reference', plan, results: { ...results, risk: result }, codeRevision, inputs }), /risk/);
  assert.throws(() => assertGate({ scope: 'reference', plan, results, codeRevision, inputs: { ...inputs, risk: false } }), /input/);
});
