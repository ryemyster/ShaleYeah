import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { createSdlc, validatePullRequest } from '../sdlc.mjs';

const source = resolve('scripts');
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'shale-sdlc-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const cwd = join(dir, 'repo');
  const remote = join(dir, 'remote.git');
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  execFileSync('git', ['init', '--bare', remote], { stdio: 'ignore' });
  mkdirSync(cwd);
  git('init', '-b', 'develop');
  git('config', 'user.name', 'SDLC Test');
  git('config', 'user.email', 'sdlc@example.invalid');
  writeFileSync(join(cwd, 'input.txt'), 'baseline\n');
  git('add', 'input.txt');
  git('commit', '-m', 'baseline');
  git('remote', 'add', 'origin', remote);
  git('push', '-u', 'origin', 'develop');
  const baseline = git('rev-parse', 'HEAD');
  const data = {
    issue: { state: 'OPEN' }, pulls: [],
    pr: { number: 10, state: 'OPEN', baseRefName: 'develop', headRefName: 'issue-1-first', headRefOid: baseline,
      isCrossRepository: false, mergeCommit: null, statusCheckRollup: [{ name: 'PR checks', status: 'COMPLETED', conclusion: 'SUCCESS' }] },
    checks: { check_runs: [{ name: 'PR checks', status: 'completed', conclusion: 'success', check_suite: { id: 1 } }] },
    runs: { workflow_runs: ['ci', 'codeql', 'gitleaks'].map((name, index) => ({ path: `.github/workflows/${name}.yml`,
      status: 'completed', conclusion: 'success', check_suite_id: index + 1 })) },
    closed: [], offline: false, ci: null, mergeBase: baseline,
  };
  const gh = (args) => {
    if (data.offline) throw new Error('GitHub unavailable');
    if (args[0] === 'issue' && args[1] === 'view') return data.issue;
    if (args[0] === 'issue' && args[1] === 'close') { data.closed.push(args[2]); return ''; }
    if (args[0] === 'pr' && args[1] === 'view') return data.pr;
    if (args[0] === 'api' && args[1].includes('/pulls?')) return [data.pulls];
    if (args[0] === 'api' && args[1].includes('/check-runs')) return [data.checks];
    if (args[0] === 'api' && args[1].includes('/pulls/')) return data.ci;
    if (args[0] === 'api' && args[1].includes('/git/ref/')) return { object: { sha: baseline } };
    if (args[0] === 'api' && args[1].includes('/compare/')) return { merge_base_commit: { sha: data.mergeBase } };
    if (args[0] === 'api' && args[1].includes('/actions/runs?')) return [data.runs];
    throw new Error(`Unexpected gh command: ${args.join(' ')}`);
  };
  const api = createSdlc({ cwd, gh });
  const commit = () => { writeFileSync(join(cwd, 'input.txt'), 'issue change\n'); git('add', 'input.txt'); git('commit', '-m', 'issue change'); };
  const merge = () => {
    data.pr.headRefOid = git('rev-parse', 'HEAD');
    git('switch', 'develop'); git('merge', '--no-ff', 'issue-1-first', '-m', 'merge issue');
    data.pr.state = 'MERGED'; data.pr.mergeCommit = { oid: git('rev-parse', 'HEAD') };
    git('push', 'origin', 'develop'); git('switch', 'issue-1-first');
  };
  return { cwd, git, baseline, data, api, gh, commit, merge, dir };
}

test('waterfall: merged and green A completes, then B starts from updated develop', (t) => {
  const f = fixture(t);
  f.api.start(1, 'first');
  assert.equal(f.api.status().active.baseSha, f.baseline);
  f.commit(); f.merge(); f.api.complete(10);
  assert.deepEqual(f.data.closed, ['1']);
  assert.equal(f.git('branch', '--show-current'), 'develop');
  assert.equal(f.api.status().active, null);
  f.api.start(2, 'second');
  assert.equal(f.git('rev-parse', 'HEAD'), f.data.pr.mergeCommit.oid);
  assert.equal(f.api.status().active.issue, 2);
  assert.equal(f.api.status().lastComplete.pr, 10);
});

test('active issue blocks starting another issue, also from a separate worktree', (t) => {
  const f = fixture(t); f.api.start(1, 'first');
  assert.throws(() => f.api.start(2, 'second'), /active issue/i);
  const second = join(f.dir, 'worktree'); f.git('worktree', 'add', '--detach', second, 'origin/develop');
  assert.throws(() => createSdlc({ cwd: second, gh: f.gh }).start(2, 'second'), /active issue/i);
  assert.equal(f.git('branch', '--show-current'), 'issue-1-first');
});

test('unmerged, mismatched and failed PRs cannot clear an active issue', (t) => {
  const f = fixture(t); f.api.start(1, 'first');
  assert.throws(() => f.api.complete(10), /merged/i);
  f.commit(); f.merge();
  for (const [field, wrong] of [['baseRefName', 'main'], ['headRefName', 'issue-2-other'], ['isCrossRepository', true]]) {
    const old = f.data.pr[field]; f.data.pr[field] = wrong;
    assert.throws(() => f.api.complete(10)); f.data.pr[field] = old;
  }
  f.data.pr.statusCheckRollup[0].conclusion = 'FAILURE';
  assert.throws(() => f.api.complete(10), /check/i);
  assert.equal(f.api.status().active.issue, 1);
  assert.deepEqual(f.data.closed, []);
});

test('missing or pending merged-commit CI fails closed; offline preserves receipt', (t) => {
  const f = fixture(t); f.api.start(1, 'first'); f.commit(); f.merge();
  for (const checks of [[], [{ name: 'PR checks', status: 'in_progress', conclusion: null }],
    [{ name: 'PR checks', status: 'completed', conclusion: 'failure' }]]) {
    f.data.checks.check_runs = checks;
    assert.throws(() => f.api.complete(10), /check/i);
  }
  f.data.offline = true;
  assert.throws(() => f.api.complete(10), /unavailable/);
  assert.equal(f.api.status().active.issue, 1);
});

test('stale base blocks commits and pushes after another merge advances develop', (t) => {
  const f = fixture(t); f.api.start(1, 'first');
  f.git('switch', 'develop'); writeFileSync(join(f.cwd, 'other.txt'), 'other merge');
  f.git('add', 'other.txt'); f.git('commit', '-m', 'other'); f.git('push', 'origin', 'develop');
  f.git('switch', 'issue-1-first');
  assert.throws(() => f.api.guardCommit(), /develop.*changed/i);
  assert.throws(() => f.api.guardPush(`refs/heads/issue-1-first ${f.baseline} refs/heads/issue-1-first ${'0'.repeat(40)}\n`), /develop.*changed/i);
});

test('dirty tracked state and closed issues do not create a branch or receipt', (t) => {
  const f = fixture(t); writeFileSync(join(f.cwd, 'input.txt'), 'dirty');
  assert.throws(() => f.api.start(1, 'first'), /tracked/i);
  f.git('restore', 'input.txt'); f.data.issue.state = 'CLOSED';
  assert.throws(() => f.api.start(1, 'first'), /open issue/i);
  assert.equal(f.api.status().active, null);
  assert.equal(f.git('branch', '--show-current'), 'develop');
});

test('no receipt, protected target refs, wrong branch and deleting pushes are blocked', (t) => {
  const f = fixture(t);
  assert.throws(() => f.api.guardCommit(), /active issue/i);
  f.api.start(1, 'first');
  for (const line of [`refs/heads/issue-1-first ${f.baseline} refs/heads/develop ${f.baseline}`,
    `refs/heads/issue-1-first ${f.baseline} refs/heads/main ${f.baseline}`,
    `(delete) ${'0'.repeat(40)} refs/heads/issue-1-first ${f.baseline}`]) {
    assert.throws(() => f.api.guardPush(`${line}\n`));
  }
  f.git('switch', '-c', 'issue-2-bypass');
  assert.throws(() => f.api.guardCommit(), /branch/i);
});

test('pending implementation PR blocks start; existing Dependabot proposals do not', (t) => {
  const f = fixture(t);
  f.data.pulls = [{ number: 99, user: { login: 'developer' }, head: { ref: 'issue-99-existing' } }];
  assert.throws(() => f.api.start(1, 'first'), /PR.*99/);
  f.data.pulls = [{ number: 99, user: { login: 'dependabot[bot]' }, head: { ref: 'dependabot/npm/update' } }];
  f.api.start(1, 'first');
  assert.equal(f.api.status().active.issue, 1);
});

test('atomic operation lock rejects overlapping starts without clearing another lock', (t) => {
  const f = fixture(t);
  const lock = join(f.cwd, '.git', 'sdlc', 'lock'); mkdirSync(lock, { recursive: true });
  assert.throws(() => f.api.start(1, 'first'), /operation.*running/i);
  assert.equal(readFileSync(join(f.cwd, 'input.txt'), 'utf8'), 'baseline\n');
});

test('adoption is explicit and accepts only an issue branch at current develop', (t) => {
  const f = fixture(t); f.git('switch', '-c', 'issue-1-first');
  f.commit();
  assert.throws(() => f.api.start(1, 'first', { adopt: true }), /before.*commit/i);
  assert.equal(f.api.status().active, null);
});

test('installer is idempotent, preserves prior hooks and discovers all three skill paths', (t) => {
  const f = fixture(t); cpSync(source, join(f.cwd, 'scripts'), { recursive: true });
  mkdirSync(join(f.cwd, '.agents', 'hooks'), { recursive: true });
  writeFileSync(join(f.cwd, '.agents', 'hooks', 'pre-commit'), '#!/bin/sh\necho prior-hook-ran >&2\n', { mode: 0o755 });
  f.git('config', 'core.hooksPath', '.agents/hooks');
  f.api.install(); f.api.install();
  assert.equal(f.git('config', 'sdlc.previousHooksPath'), '.agents/hooks');
  for (const path of ['.agents/skills/sdlc/SKILL.md', '.claude/skills/sdlc/SKILL.md']) {
    assert.match(readFileSync(join(f.cwd, path), 'utf8'), /pnpm sdlc start/);
  }
  f.api.start(1, 'first');
  const result = spawnSync('git', ['hook', 'run', 'pre-commit'], { cwd: f.cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout + result.stderr, /prior-hook-ran/);
  f.git('switch', '-c', 'issue-2-bypass');
  assert.throws(() => f.git('commit', '--allow-empty', '-m', 'bypass'), /active issue|branch/);
});

test('CI accepts sole current implementation PR; rejects stale bases and second PR', () => {
  const pr = { number: 10, base: { ref: 'develop', sha: 'current' }, head: { ref: 'issue-1-first' },
    user: { login: 'developer' }, body: 'SDLC-Base: current\nFixes #1' };
  validatePullRequest(pr, [pr], 'current');
  assert.throws(() => validatePullRequest(pr, [pr], 'new-develop'), /base/i);
  assert.throws(() => validatePullRequest(pr, [pr, { ...pr, number: 11 }], 'current'), /one.*PR/i);
  assert.throws(() => validatePullRequest({ ...pr, body: 'Fixes #1' }, [pr], 'current'), /SDLC-Base/);
  assert.throws(() => validatePullRequest({ ...pr, body: `${pr.body}\nFixes #2` }, [pr], 'current'), /one issue/i);
});

test('installer preserves configuration when another active hook needs chaining', (t) => {
  const f = fixture(t); cpSync(source, join(f.cwd, 'scripts'), { recursive: true });
  const hooks = join(f.cwd, '.git', 'hooks');
  writeFileSync(join(hooks, 'commit-msg'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  assert.throws(() => f.api.install(), /commit-msg/);
  assert.throws(() => f.git('config', '--get', 'core.hooksPath'));
});

test('installed pre-push guards real Git pushes and preserves prior hook stdin', (t) => {
  const f = fixture(t); cpSync(source, join(f.cwd, 'scripts'), { recursive: true });
  const bin = join(f.dir, 'bin'); mkdirSync(bin);
  writeFileSync(join(bin, 'gh'), '#!/bin/sh\necho "[[]]"\n', { mode: 0o755 });
  mkdirSync(join(f.cwd, '.agents', 'hooks'), { recursive: true });
  writeFileSync(join(f.cwd, '.agents', 'hooks', 'pre-push'), '#!/bin/sh\ncat > prior-push.txt\n', { mode: 0o755 });
  f.git('config', 'core.hooksPath', '.agents/hooks');
  f.api.install(); f.api.start(1, 'first');
  const push = (ref) => spawnSync('git', ['push', 'origin', ref], { cwd: f.cwd, encoding: 'utf8',
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } });
  const allowed = push('issue-1-first'); assert.equal(allowed.status, 0, allowed.stderr);
  assert.match(readFileSync(join(f.cwd, 'prior-push.txt'), 'utf8'), /refs\/heads\/issue-1-first/);
  const blocked = push('issue-1-first:main');
  assert.notEqual(blocked.status, 0); assert.match(blocked.stderr, /protected refs/);
});

test('CI queries live issue and ancestry; rejects closed issue and stale head', (t) => {
  const f = fixture(t);
  const pr = { number: 10, base: { ref: 'develop', sha: f.baseline }, head: { ref: 'issue-1-first', sha: f.baseline },
    user: { login: 'developer' }, body: `SDLC-Base: ${f.baseline}\nFixes #1` };
  f.data.ci = pr; f.data.pulls = [pr];
  assert.match(f.api.ci(10), /passed/);
  f.data.issue.state = 'CLOSED'; assert.throws(() => f.api.ci(10), /open issue/);
  f.data.issue.state = 'OPEN'; f.data.mergeBase = 'old';
  assert.throws(() => f.api.ci(10), /based on current/);
});

test('CLI runs start, status, install and completion with a fixture GitHub executable', (t) => {
  const f = fixture(t); cpSync(source, join(f.cwd, 'scripts'), { recursive: true });
  const bin = join(f.dir, 'bin'); mkdirSync(bin);
  const dataPath = join(f.dir, 'github.json');
  const fakeGh = `#!/usr/bin/env node
const { readFileSync } = require('node:fs');
const data = JSON.parse(readFileSync(process.env.SDLC_TEST_DATA, 'utf8'));
const args = process.argv.slice(2);
let result;
if (args[0] === 'issue' && args[1] === 'view') result = data.issue;
else if (args[0] === 'issue' && args[1] === 'close') result = 'Closed';
else if (args[0] === 'pr') result = data.pr;
else if (args[1].includes('/pulls?')) result = [data.pulls];
else if (args[1].includes('/check-runs')) result = [data.checks];
else if (args[1].includes('/pulls/')) result = data.ci;
else if (args[1].includes('/git/ref/')) result = { object: { sha: data.mergeBase } };
else if (args[1].includes('/compare/')) result = { merge_base_commit: { sha: data.mergeBase } };
else if (args[1].includes('/actions/runs?')) result = [data.runs];
else throw new Error('Unexpected command');
console.log(typeof result === 'string' ? result : JSON.stringify(result));
`;
  writeFileSync(join(bin, 'gh'), fakeGh, { mode: 0o755 });
  const cli = (...args) => {
    writeFileSync(dataPath, JSON.stringify(f.data));
    return runCli(args);
  };
  const cliEnv = { ...process.env, PATH: `${bin}:${process.env.PATH}`, SDLC_TEST_DATA: dataPath };
  // A child CLI is a normal process, not another test runner worker.
  delete cliEnv.NODE_TEST_CONTEXT;
  const runCli = (args) => execFileSync(process.execPath, [join(source, 'sdlc.mjs'), ...args], {
    cwd: f.cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    env: cliEnv,
  }).trim();
  assert.match(cli('--help'), /Sequential issue delivery/);
  assert.throws(() => cli('start', '0', 'invalid'), /positive/);
  assert.throws(() => cli('start', '1', 'Invalid'), /slug/);
  assert.equal(JSON.parse(cli('start', '1', 'first')).baseSha, f.baseline);
  assert.equal(JSON.parse(cli('status')).active.issue, 1);
  assert.throws(() => cli('unknown'), /Sequential issue delivery/);
  assert.throws(() => cli('hook', 'invalid'), /Unsupported hook/);
  f.commit(); f.merge();
  assert.match(cli('install'), /Installed/);
  assert.equal(JSON.parse(cli('complete', '10')).pr, 10);
  assert.equal(JSON.parse(cli('status')).active, null);
});

test('branch collisions preserve work and prior-hook errors propagate', (t) => {
  const f = fixture(t); f.git('branch', 'issue-1-first');
  assert.throws(() => f.api.start(1, 'first'), /already exists/);
  assert.equal(f.git('branch', '--show-current'), 'develop');
  mkdirSync(join(f.cwd, '.agents', 'hooks'), { recursive: true });
  writeFileSync(join(f.cwd, '.agents', 'hooks', 'pre-commit'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
  f.git('config', 'sdlc.previousHooksPath', '.agents/hooks');
  assert.throws(() => f.api.previousHook('pre-commit', [], ''), /Command failed/);
  f.git('config', 'sdlc.previousHooksPath', 'scripts/git-hooks');
  assert.throws(() => f.api.previousHook('pre-commit', [], ''), /Recursive/);
});

test('completion ignores unrelated release and background checks, keeping current push checks', (t) => {
  const f = fixture(t); f.api.start(1, 'first'); f.commit(); f.merge();
  f.data.checks.check_runs.push(
    { name: 'CodeQL', status: 'completed', conclusion: 'failure', check_suite: { id: 99 } },
    { name: 'Dependabot', status: 'in_progress', conclusion: null, check_suite: { id: 100 } },
  );
  f.api.complete(10);
  assert.equal(f.api.status().active, null);
});

test('missing, pending or failed push workflows and failed push checks keep the slot', (t) => {
  const f = fixture(t); f.api.start(1, 'first'); f.commit(); f.merge();
  const original = f.data.runs.workflow_runs;
  for (const runs of [[], original.slice(0, 2), original.map(run => ({ ...run, status: 'in_progress' })),
    original.map(run => ({ ...run, conclusion: 'failure' }))]) {
    f.data.runs.workflow_runs = runs;
    assert.throws(() => f.api.complete(10), /workflow/i);
    assert.equal(f.api.status().active.issue, 1);
  }
  f.data.runs.workflow_runs = original;
  f.data.checks.check_runs.push({ name: 'CodeQL', status: 'completed', conclusion: 'failure', check_suite: { id: 2 } });
  assert.throws(() => f.api.complete(10), /check/i);
  assert.deepEqual(f.data.closed, []);
});
