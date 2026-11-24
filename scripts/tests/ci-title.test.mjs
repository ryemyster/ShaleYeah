import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { selectImpact } from '../ci-impact.mjs';
import { assertGate } from '../ci-gates.mjs';

const codeRevision = 'a'.repeat(40);
const planFor = (file, eventName = 'pull_request') => selectImpact({ eventName, codeRevision,
  baseSha: 'b'.repeat(40), headSha: 'c'.repeat(40), changedPaths: [file] });

test('Title agent and backend changes select full employee qualification instead of obsolete caller work', () => {
  for (const file of ['agents/title-analyst/app/context_runtime.py', 'servers/title/src/review-workflow.ts']) {
    const plan = planFor(file);
    assert.equal(plan.full, false);
    assert.equal(plan.units.title, true);
    assert.deepEqual(Object.entries(plan.units).filter(([, selected]) => selected).map(([unit]) => unit), ['title']);
    assert.deepEqual(plan.callers, []);
  }
});

test('full push/manual and shared inputs require Title independently of the four remaining callers', () => {
  for (const plan of [planFor('CHANGELOG.md', 'push'), planFor('CHANGELOG.md', 'workflow_dispatch'), planFor('evaluations/shaleyeah_evaluations/title.py')]) {
    assert.equal(plan.full, true);
    assert.equal(plan.units.title, true);
    assert.equal(plan.callers.length, 4);
    assert.ok(!plan.callers.includes('title-analyst'));
  }
});

test('other passing roles, missing Title results or false reusable flags cannot waive selected qualification', () => {
  const plan = planFor('servers/title/src/index.ts');
  const results = { reference: 'skipped', reporter: 'skipped', economist: 'skipped', reservoir: 'skipped', risk: 'skipped', legal: 'skipped', market: 'skipped', title: 'success', drilling: 'skipped', 'protocol-callers': 'skipped' };
  const inputs = { geologist: false, reporter: false, economist: false, reservoir: false, risk: false, legal: false, market: false, title: true, drilling: false, callers: '[]' };
  assert.doesNotThrow(() => assertGate({ scope: 'reference', plan, results, codeRevision, inputs }));
  for (const result of ['failure', 'cancelled', 'skipped', undefined])
    assert.throws(() => assertGate({ scope: 'reference', plan, results: { ...results, title: result }, codeRevision, inputs }), /title/);
  assert.throws(() => assertGate({ scope: 'reference', plan, results, codeRevision, inputs: { ...inputs, title: false } }), /input/);
});

test('hosted Title job keeps native HTTP, external, installed, artifact and trace grading checks required', () => {
  const workflow = readFileSync(new URL('../../.github/workflows/reference-qualification.yml', import.meta.url), 'utf8');
  const start = workflow.indexOf('\n  title:\n');
  assert.ok(start >= 0);
  const end = workflow.indexOf('\n  drilling:\n', start);
  assert.ok(end > start);
  const job = workflow.slice(start, end);
  assert.match(job, /if: inputs\.title/);
  assert.match(job, /uv run --locked pytest -q --cov=app --cov-fail-under=90/);
  assert.match(job, /run: pnpm --dir servers\/title test/);
  for (const step of ['grade_local_google.py', 'verify_cli_grade.py', 'check-extraction.mjs']) assert.ok(job.includes(step));
  assert.doesNotMatch(job, /check-containers|container-report|Docker|docker|title-containers/);
  assert.doesNotMatch(job, /continue-on-error|--deselect|--ignore|test-name-pattern/);
  assert.match(workflow, /needs: \[economist, reservoir, risk, legal, market, title, drilling, protocol-callers, reference, reporter\]/);
});

test('Title qualification has no Docker prerequisites or displaced image tooling', () => {
  const server = JSON.parse(readFileSync(new URL('../../servers/title/package.json', import.meta.url), 'utf8'));
  assert.doesNotMatch(server.scripts['test:extraction'], /container|docker/i);
  for (const file of ['agents/title-analyst/Dockerfile', 'servers/title/Dockerfile',
    'servers/title/scripts/check-containers.py', 'servers/title/tests/extraction/container-report.test.mjs',
    'servers/title/tests/extraction/pair-fixture.ts', 'servers/title/tests/extraction/generic-client.mjs'])
    assert.equal(existsSync(new URL(`../../${file}`, import.meta.url)), false, file);
  const extraction = readFileSync(new URL('../../servers/title/scripts/check-extraction.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(extraction, /docker|pair-fixture|generic-client\.mjs/i);
});

test('the reusable workflow preserves one root job section and each existing job exactly once', () => {
  const workflow = readFileSync(new URL('../../.github/workflows/reference-qualification.yml', import.meta.url), 'utf8');
  assert.equal([...workflow.matchAll(/^jobs:$/gm)].length, 1);
  const jobs = [...workflow.slice(workflow.indexOf('\njobs:\n')).matchAll(/^  ([a-z][a-z-]*):$/gm)].map((match) => match[1]);
  assert.equal(new Set(jobs).size, jobs.length);
  assert.deepEqual([...jobs].sort(), ['economist', 'reservoir', 'risk', 'legal', 'market', 'title', 'drilling', 'protocol-callers', 'reference', 'reporter', 'qualification-gate'].sort());
});
