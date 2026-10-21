import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const codeRevision = 'a'.repeat(40);
const planFor = async (files, eventName = 'pull_request', revision = codeRevision) => {
  const { selectImpact } = await import('../ci-impact.mjs');
  return selectImpact({ eventName, codeRevision: revision, baseSha: 'b'.repeat(40), headSha: 'c'.repeat(40), changedPaths: files });
};
const checkedOutRevision = () => execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const referenceResults = { reference: 'skipped', reporter: 'skipped', economist: 'success', 'protocol-callers': 'skipped' };
const finalResults = { impact: 'success', workspace: 'success', 'reference-qualification': 'success', 'qa-observed-qualification': 'skipped' };

test('reference and final gates permit only declared unaffected skips', async () => {
  const { assertGate } = await import('../ci-gates.mjs');
  const plan = await planFor(['servers/econobot/src/index.ts']);
  assert.doesNotThrow(() => assertGate({ scope: 'reference', plan, results: referenceResults, codeRevision }));
  assert.doesNotThrow(() => assertGate({ scope: 'final', plan, results: finalResults, codeRevision }));
});

for (const result of ['failure', 'cancelled', 'skipped', 'pending', 'neutral', null]) {
  test(`selected qualification cannot report ${result}`, async () => {
    const { assertGate } = await import('../ci-gates.mjs');
    const plan = await planFor(['servers/econobot/src/index.ts']);
    assert.throws(() => assertGate({ scope: 'reference', plan, codeRevision,
      results: { ...referenceResults, economist: result } }), /economist/);
  });
}

test('a missing selected result and failed unexpected extra work are both denied', async () => {
  const { assertGate } = await import('../ci-gates.mjs');
  const plan = await planFor(['servers/econobot/src/index.ts']);
  const missing = { ...referenceResults };
  delete missing.economist;
  assert.throws(() => assertGate({ scope: 'reference', plan, codeRevision, results: missing }), /economist/);
  assert.throws(() => assertGate({ scope: 'reference', plan, codeRevision,
    results: { ...referenceResults, reporter: 'failure' } }), /reporter/);
});

test('workspace, selection, reusable aggregate and selected QA must actually succeed', async () => {
  const { assertGate } = await import('../ci-gates.mjs');
  const plan = await planFor(['servers/qa-server/src/index.ts']);
  for (const key of Object.keys(finalResults)) {
    assert.throws(() => assertGate({ scope: 'final', plan, codeRevision,
      results: { ...finalResults, 'qa-observed-qualification': 'success', [key]: 'skipped' } }), new RegExp(key));
  }
});

test('a docs-only decision still requires workspace and internal qualification gate success', async () => {
  const { assertGate } = await import('../ci-gates.mjs');
  const plan = await planFor(['CHANGELOG.md']);
  assert.doesNotThrow(() => assertGate({ scope: 'reference', plan, codeRevision,
    results: Object.fromEntries(Object.keys(referenceResults).map((key) => [key, 'skipped'])) }));
  assert.doesNotThrow(() => assertGate({ scope: 'final', plan, codeRevision, results: finalResults }));
  assert.throws(() => assertGate({ scope: 'final', plan, codeRevision,
    results: { ...finalResults, workspace: 'failure' } }), /workspace/);
});

test('malformed plans and revision/scope mismatches never become success', async () => {
  const { assertGate } = await import('../ci-gates.mjs');
  const plan = await planFor(['servers/econobot/src/index.ts']);
  for (const broken of [null, {}, { ...plan, units: {} }, { ...plan, callers: ['unknown'] },
    { ...plan, units: { ...plan.units, economist: 'false' } }, { ...plan, full: true },
    { ...plan, eventName: 'push' }]) {
    assert.throws(() => assertGate({ scope: 'reference', plan: broken, codeRevision, results: referenceResults }));
  }
  assert.throws(() => assertGate({ scope: 'reference', plan, codeRevision: 'd'.repeat(40), results: referenceResults }), /revision/);
  assert.throws(() => assertGate({ scope: 'unknown', plan, codeRevision, results: referenceResults }), /scope/);
});

test('effective reusable inputs must match the recorded plan, including caller list', async () => {
  const { assertGate } = await import('../ci-gates.mjs');
  const plan = await planFor(['agents/research-analyst/app/agent.py']);
  const results = { reference: 'skipped', reporter: 'skipped', economist: 'skipped', 'protocol-callers': 'success' };
  const inputs = { geologist: false, reporter: false, economist: false, callers: '["research-analyst"]' };
  assert.doesNotThrow(() => assertGate({ scope: 'reference', plan, codeRevision, results, inputs }));
  assert.throws(() => assertGate({ scope: 'reference', plan, codeRevision, results,
    inputs: { ...inputs, callers: '[]' } }), /input/);
  assert.throws(() => assertGate({ scope: 'reference', plan, codeRevision, results,
    inputs: { ...inputs, geologist: true } }), /input/);
});

test('Actions gate checks real needs-result objects and requires effective reference inputs', async () => {
  const { runGate } = await import('../ci-gates.mjs');
  const actual = checkedOutRevision();
  const plan = await planFor(['servers/econobot/src/index.ts'], 'pull_request', actual);
  const needs = Object.fromEntries(Object.entries(referenceResults).map(([key, result]) => [key, { result, outputs: {} }]));
  const env = { CI_GATE_SCOPE: 'reference', GITHUB_SHA: actual, CI_PLAN_JSON: JSON.stringify(plan),
    CI_NEEDS_JSON: JSON.stringify(needs),
    CI_INPUTS_JSON: JSON.stringify({ geologist: false, reporter: false, economist: true, callers: '[]' }) };
  assert.doesNotThrow(() => runGate(env, () => {}));
  assert.throws(() => runGate({ ...env, CI_INPUTS_JSON: '' }, () => {}), /input/);
  assert.throws(() => runGate({ ...env, CI_NEEDS_JSON: '{}' }, () => {}));
  assert.throws(() => runGate({ ...env, CI_NEEDS_JSON: '{invalid' }, () => {}));
});

test('default reusable qualification is full and cannot be reduced through its input flags', async () => {
  const { runGate } = await import('../ci-gates.mjs');
  const full = await planFor(['CHANGELOG.md'], 'workflow_dispatch');
  const needs = Object.fromEntries(Object.keys(referenceResults).map((key) => [key, { result: 'success' }]));
  const inputs = { geologist: true, reporter: true, economist: true, callers: JSON.stringify(full.callers) };
  const env = { CI_GATE_SCOPE: 'reference', GITHUB_SHA: checkedOutRevision(), CI_NEEDS_JSON: JSON.stringify(needs),
    CI_INPUTS_JSON: JSON.stringify(inputs) };
  assert.doesNotThrow(() => runGate(env, () => {}));
  assert.throws(() => runGate({ ...env, CI_INPUTS_JSON: JSON.stringify({ ...inputs, geologist: false }) }, () => {}), /input/);
  assert.throws(() => runGate({ ...env, CI_GATE_SCOPE: 'final' }, () => {}), /plan/);
});

test('a gate cannot accept a matching envelope and environment for a different checkout', async () => {
  const { runGate } = await import('../ci-gates.mjs');
  const wrong = checkedOutRevision() === 'd'.repeat(40) ? 'e'.repeat(40) : 'd'.repeat(40);
  const plan = await planFor(['servers/econobot/src/index.ts'], 'pull_request', wrong);
  const needs = Object.fromEntries(Object.keys(referenceResults).map((key) => [key, { result: 'success' }]));
  const env = { CI_GATE_SCOPE: 'reference', GITHUB_SHA: wrong, CI_PLAN_JSON: JSON.stringify(plan),
    CI_NEEDS_JSON: JSON.stringify(needs),
    CI_INPUTS_JSON: JSON.stringify({ geologist: false, reporter: false, economist: true, callers: '[]' }) };
  assert.throws(() => runGate(env, () => {}), /revision/);
});

function callerFixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'shale-ci-callers-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const bin = path.join(root, 'bin');
  mkdirSync(bin);
  const log = path.join(root, 'calls.jsonl');
  const uv = path.join(bin, 'uv');
  writeFileSync(uv, '#!/usr/bin/env node\n' +
    'const fs=require("node:fs"); const path=require("node:path");\n' +
    'const role=path.basename(process.cwd());\n' +
    'fs.appendFileSync(process.env.CI_TEST_LOG,JSON.stringify({role,args:process.argv.slice(2)})+"\\n");\n' +
    'if(role===process.env.CI_TEST_FAIL_ROLE) process.exitCode=7;\n');
  chmodSync(uv, 0o755);
  const roles = ['development-planner', 'drilling-engineer', 'infrastructure-planner'];
  for (const role of roles) mkdirSync(path.join(root, 'agents', role), { recursive: true });
  return { root, roles, log, env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}`, CI_TEST_LOG: log } };
}

test('consolidated callers retain separate package cwd and locked subprocesses', async (t) => {
  const fixture = callerFixture(t);
  const { runCallers } = await import('../ci-python-callers.mjs');
  runCallers(fixture.roles, { repoRoot: fixture.root, env: fixture.env });
  const calls = readFileSync(fixture.log, 'utf8').trim().split('\n').map(JSON.parse);
  assert.deepEqual(calls.map((call) => call.role), fixture.roles.flatMap((role) => Array(4).fill(role)));
  assert.ok(calls.every((call) => call.args.includes('--locked')));
  assert.ok(calls.some((call) => call.args.includes('ruff')));
  assert.ok(calls.some((call) => call.args.includes('pytest')));
});

test('caller failure stops subsequent work and invalid/duplicate roles cannot execute', async (t) => {
  const fixture = callerFixture(t);
  const { runCallers } = await import('../ci-python-callers.mjs');
  assert.throws(() => runCallers(fixture.roles, { repoRoot: fixture.root,
    env: { ...fixture.env, CI_TEST_FAIL_ROLE: 'drilling-engineer' } }), /drilling-engineer|failed/);
  const calls = readFileSync(fixture.log, 'utf8').trim().split('\n').map(JSON.parse);
  assert.deepEqual(calls.map((call) => call.role), [...Array(4).fill('development-planner'), 'drilling-engineer']);
  for (const roles of [['../outside'], ['new-role'], ['development-planner', 'development-planner'], null]) {
    assert.throws(() => runCallers(roles, { repoRoot: fixture.root, env: fixture.env }), /role/);
  }
  assert.equal(readFileSync(fixture.log, 'utf8').trim().split('\n').length, 5);
});

test('caller command accepts its role list through environment data and rejects malformed JSON', async (t) => {
  const fixture = callerFixture(t);
  const { runCallerCLI } = await import('../ci-python-callers.mjs');
  runCallerCLI({ repoRoot: fixture.root,
    env: { ...fixture.env, CI_CALLER_ROLES_JSON: JSON.stringify(['development-planner']) } });
  assert.equal(readFileSync(fixture.log, 'utf8').trim().split('\n').length, 4);
  assert.throws(() => runCallerCLI({ repoRoot: fixture.root,
    env: { ...fixture.env, CI_CALLER_ROLES_JSON: '{invalid' } }), /role/);
});
