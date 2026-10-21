import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const callers = ['development-planner', 'drilling-engineer', 'infrastructure-planner',
  'investment-chair', 'legal-analyst', 'market-analyst', 'research-analyst', 'risk-analyst', 'title-analyst'];
const base = '1'.repeat(40);
const head = '2'.repeat(40);
const revision = '3'.repeat(40);
const units = (...selected) => Object.fromEntries(
  ['geologist', 'reporter', 'economist', 'qa'].map((unit) => [unit, selected.includes(unit)]));
const impact = async (changedPaths, extra = {}) => {
  const { selectImpact } = await import('../ci-impact.mjs');
  return selectImpact({ eventName: 'pull_request', baseSha: base, headSha: head,
    codeRevision: revision, changedPaths, ...extra });
};

test('workspace feedback has an independent job before the final required gate', () => {
  const workflow = readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8');
  const lines = workflow.split('\n');
  const start = lines.indexOf('  workspace:');
  assert.ok(start >= 0, 'Workspace/SDLC checks must start independently of container qualification');
  const end = lines.findIndex((line, i) => i > start && /^  [a-z][a-z-]*:$/.test(line));
  const job = lines.slice(start, end < 0 ? undefined : end).join('\n');
  assert.doesNotMatch(job, /^\s+needs:/m);
  assert.ok(lines.includes('    name: PR checks'), 'Preserve the protected check identity');
});

for (const [file, selected, expectedCallers = []] of [
  ['agents/geologist/app/agent.py', ['geologist', 'reporter']],
  ['servers/geowiz/src/index.ts', ['geologist', 'reporter']],
  ['agents/reporter-agent/docs/ARCHITECTURE.md', ['reporter']],
  ['servers/reporter/src/index.ts', ['reporter']],
  ['agents/economist/tests/eval/cases.json', ['economist']],
  ['servers/econobot/scripts/check-containers.py', ['economist']],
  ['agents/quality-assurance/README.md', ['qa']],
  ['servers/qa-server/src/index.ts', ['qa']],
  ['servers/curve-smith/src/index.ts', []],
  ['docs/mvp-release-plan.md', []],
  ['CHANGELOG.md', []],
  ['README.md', []],
  ['agents/research-analyst/app/agent.py', [], ['research-analyst']],
  ['servers/research/src/index.ts', [], ['research-analyst']],
]) {
  test(`selects actual qualification owners: ${file}`, async () => {
    const plan = await impact([file]);
    assert.equal(plan.full, false);
    assert.deepEqual(plan.units, units(...selected));
    assert.deepEqual(plan.callers, expectedCallers);
    assert.equal(plan.codeRevision, revision);
    assert.equal(plan.baseSha, base);
    assert.equal(plan.headSha, head);
    assert.ok(plan.reasons.length > 0);
  });
}

test('all nine existing caller packages have explicit ownership', async () => {
  for (const role of callers) {
    const plan = await impact([`agents/${role}/app/agent.py`]);
    assert.equal(plan.full, false);
    assert.deepEqual(plan.callers, [role]);
    assert.deepEqual(plan.units, units());
  }
});

test('combines consumers deterministically without duplicate caller work', async () => {
  const files = ['servers/geowiz/src/index.ts', 'agents/economist/app/agent.py',
    'servers/research/src/index.ts', 'agents/research-analyst/app/agent.py'];
  const plan = await impact(files);
  assert.deepEqual(plan.units, units('geologist', 'reporter', 'economist'));
  assert.deepEqual(plan.callers, ['research-analyst']);
  assert.deepEqual(plan, await impact([...files].reverse()));
});

for (const file of ['sdk/employee/shaleyeah_employee/context.py', 'sdk/python/shaleyeah_mcp/client.py',
  'sdk/src/model-provider.ts', 'contracts/schemas/work-product.json', 'connectors/operator-file.py',
  'evaluations/policy.json', '.github/workflows/ci.yml', 'scripts/ci-impact.mjs',
  'package.json', 'pnpm-lock.yaml', 'turbo.json', 'data/samples/production.csv',
  'docs/policies/runtime.json', 'future-unit/README.md', 'agents/new-employee/app/agent.py',
  'docs/prompts/employee.md', 'docs/new-contract.md',
  'agents/reservoir-engineer/app/agent.py', 'docs/../sdk/README.md',
  'servers/constructor/src/tool.ts', 'agents/toString/app/agent.py', 'servers/__proto__/src/tool.ts']) {
  test(`shared or unknown impact remains full: ${file}`, async () => {
    const plan = await impact([file]);
    assert.equal(plan.full, true);
    assert.deepEqual(plan.units, units('geologist', 'reporter', 'economist', 'qa'));
    assert.deepEqual(plan.callers, callers);
  });
}

test('full events, missing comparison and invalid paths cannot omit qualification', async () => {
  for (const extra of [{ eventName: 'push' }, { eventName: 'workflow_dispatch' },
    { eventName: 'unknown' }, { baseSha: null }, { headSha: 'invalid' }]) {
    assert.equal((await impact(['CHANGELOG.md'], extra)).full, true);
  }
  for (const changed of [[], null, [''], ['/absolute/path'], ['docs/../../outside.md']]) {
    assert.equal((await impact(changed)).full, true);
  }
});

function history(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'shale-ci-history-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  git('init', '--quiet');
  git('config', 'user.name', 'CI fixture');
  git('config', 'user.email', 'fixture@example.invalid');
  writeFileSync(path.join(root, 'CHANGELOG.md'), 'Original documentation\n');
  git('add', 'CHANGELOG.md');
  git('commit', '--quiet', '-m', 'fixture baseline');
  const initial = git('rev-parse', 'HEAD');
  return { root, git, initial };
}

test('real Git comparison includes both sides of a rename and deleted paths', async (t) => {
  const fixture = history(t);
  renameSync(path.join(fixture.root, 'CHANGELOG.md'), path.join(fixture.root, 'unknown-name.md'));
  fixture.git('add', '-A');
  fixture.git('commit', '--quiet', '-m', 'fixture rename');
  const current = fixture.git('rev-parse', 'HEAD');
  const { inspectImpact } = await import('../ci-impact.mjs');
  const plan = inspectImpact({ repoRoot: fixture.root, eventName: 'pull_request',
    baseSha: fixture.initial, headSha: current, codeRevision: current });
  assert.equal(plan.full, true, 'The unknown destination cannot hide behind a docs-only deletion');
  assert.equal(plan.changedPathCount, 2);
  assert.equal(plan.codeRevision, current);
});

test('missing history falls back to full; a different checked-out revision is rejected', async (t) => {
  const fixture = history(t);
  const { inspectImpact } = await import('../ci-impact.mjs');
  const args = { repoRoot: fixture.root, eventName: 'pull_request', baseSha: 'f'.repeat(40),
    headSha: fixture.initial, codeRevision: fixture.initial };
  assert.equal(inspectImpact(args).full, true);
  assert.throws(() => inspectImpact({ ...args, codeRevision: 'e'.repeat(40) }), /revision/);
});

test('Actions command emits the same revision-bound plan and excludes event body text', async (t) => {
  const fixture = history(t);
  writeFileSync(path.join(fixture.root, 'CHANGELOG.md'), 'Updated documentation\n');
  fixture.git('add', 'CHANGELOG.md');
  fixture.git('commit', '--quiet', '-m', 'fixture update');
  const current = fixture.git('rev-parse', 'HEAD');
  const eventPath = path.join(fixture.root, 'event.json');
  const output = path.join(fixture.root, 'plan.json');
  const githubOutput = path.join(fixture.root, 'outputs');
  writeFileSync(eventPath, JSON.stringify({ pull_request: { base: { sha: fixture.initial },
    head: { sha: current }, body: 'PRIVATE_EVENT_BODY_FIXTURE' } }));
  const { runImpact } = await import('../ci-impact.mjs');
  const plan = runImpact({ argv: ['--repo', fixture.root, '--output', output],
    env: { GITHUB_EVENT_NAME: 'pull_request', GITHUB_SHA: current,
      GITHUB_EVENT_PATH: eventPath, GITHUB_OUTPUT: githubOutput }, write: () => {} });
  assert.equal(plan.full, false);
  assert.equal(plan.codeRevision, current);
  assert.deepEqual(JSON.parse(readFileSync(output, 'utf8')), plan);
  const outputs = readFileSync(githubOutput, 'utf8');
  assert.ok(outputs.includes(`plan=${JSON.stringify(plan)}\n`));
  assert.ok(outputs.includes('geologist=false\n'));
  assert.ok(outputs.includes('callers=[]\n'));
  assert.ok(!outputs.includes('PRIVATE_EVENT_BODY_FIXTURE'));
  assert.throws(() => runImpact({ argv: ['--repo', fixture.root, '--output', `${output}.bad`],
    env: { GITHUB_SHA: head }, write: () => {} }), /revision/);
  assert.equal(existsSync(`${output}.bad`), false);
});

test('missing or malformed event payload schedules full verification', async (t) => {
  const fixture = history(t);
  const { runImpact } = await import('../ci-impact.mjs');
  const eventPath = path.join(fixture.root, 'event.json');
  for (const payload of [null, '{invalid']) {
    if (payload !== null) writeFileSync(eventPath, payload);
    const plan = runImpact({ argv: ['--repo', fixture.root, '--output', path.join(fixture.root, 'plan.json')],
      env: { GITHUB_EVENT_NAME: 'pull_request', GITHUB_SHA: fixture.initial, GITHUB_EVENT_PATH: eventPath }, write: () => {} });
    assert.equal(plan.full, true);
    assert.deepEqual(plan.callers, callers);
  }
});
