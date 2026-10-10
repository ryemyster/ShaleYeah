#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = 'ryemyster/ShaleYeah';
const MERGE_WORKFLOWS = ['ci', 'codeql', 'gitleaks'].map((name) => `.github/workflows/${name}.yml`);
const HELP = `Sequential issue delivery (Git, gh and Node >=18 required)
  pnpm sdlc install                  install shared Git hooks and local skills
  pnpm sdlc status                   show the active issue and last completion
  pnpm sdlc start <issue> <slug>      fetch develop and start one issue
  pnpm sdlc start <issue> <slug> --adopt
                                    register an existing branch before its first commit
  pnpm sdlc complete <merged-pr>     verify merge/CI, close issue and sync develop
  pnpm sdlc ci <pr>                  validate PR sequence and recorded base
See docs/sdlc.md for review, recovery and merge steps.`;

function run(cwd, command, args, options = {}) {
  return (execFileSync(command, args, { cwd, encoding: 'utf8', timeout: 30_000,
    stdio: ['ignore', 'pipe', 'pipe'], ...options }) ?? '').trim();
}

function positive(value) {
  if (!/^[1-9]\d*$/.test(String(value))) throw new Error('Use a positive issue or PR number.');
  return Number(value);
}

function implementation(pr) {
  return !(pr.user?.login === 'dependabot[bot]' && pr.head?.ref?.startsWith('dependabot/'));
}

export function validatePullRequest(pr, pulls, developSha) {
  if (pr.base.ref !== 'develop') throw new Error('Issue PRs must target develop.');
  if (pr.base.sha !== developSha) throw new Error('PR base is stale; develop changed.');
  if (!implementation(pr)) return;
  const issue = /^issue-([1-9]\d*)-[a-z0-9]+(?:-[a-z0-9]+)*$/.exec(pr.head.ref)?.[1];
  if (!issue) throw new Error('Implementation PR branch must be issue-<number>-<slug>.');
  if (!new RegExp(`^SDLC-Base: ${developSha}$`, 'm').test(pr.body ?? '')) {
    throw new Error('SDLC-Base receipt is missing or stale; use the base from pnpm sdlc status.');
  }
  if (!new RegExp(`(?:Fixes|Closes|Resolves) #${issue}(?!\\d)`, 'i').test(pr.body ?? '')) {
    throw new Error(`PR must link its single issue with Fixes #${issue}.`);
  }
  const linked = [...(pr.body ?? '').matchAll(/(?:Fixes|Closes|Resolves) #(\d+)/gi)];
  if (linked.some((match) => match[1] !== issue)) throw new Error('One implementation PR must rectify one issue.');
  const active = pulls.filter(implementation);
  if (active.length !== 1 || active[0].number !== pr.number) {
    throw new Error('Only one implementation PR into develop may be open.');
  }
}

function green(checks, context) {
  const normalized = checks.map((check) => ({ name: check.name ?? check.context,
    done: check.status ? check.status.toLowerCase() === 'completed' : true,
    result: (check.conclusion ?? check.state ?? '').toLowerCase() }));
  if (!normalized.some((check) => check.name === 'PR checks' && check.done && check.result === 'success') ||
      normalized.some((check) => !check.done || !['success', 'neutral', 'skipped'].includes(check.result))) {
    throw new Error(`${context} checks are missing, pending or failed. Wait for green CI; active issue stays locked.`);
  }
}

export function createSdlc({ cwd = process.cwd(), gh: github } = {}) {
  const git = (...args) => run(cwd, 'git', args);
  const root = git('rev-parse', '--show-toplevel');
  const common = resolve(cwd, git('rev-parse', '--git-common-dir'));
  const stateDir = join(common, 'sdlc');
  const stateFile = join(stateDir, 'state.json');
  const gh = github ?? ((args) => {
    const output = run(root, 'gh', args);
    return args.includes('--json') || args[0] === 'api' ? JSON.parse(output) : output;
  });
  const status = () => existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')) : { active: null, lastComplete: null };
  const save = (state) => {
    const temporary = `${stateFile}.${process.pid}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
    renameSync(temporary, stateFile);
  };
  const locked = (action) => {
    mkdirSync(stateDir, { recursive: true });
    const lock = join(stateDir, 'lock');
    try { mkdirSync(lock); } catch (error) {
      if (error.code === 'EEXIST') throw new Error(`An SDLC operation is already running. Inspect ${lock}; do not clear a live lock.`);
      throw error;
    }
    try { return action(); } finally { rmdirSync(lock); }
  };
  const clean = () => {
    if (git('status', '--porcelain', '--untracked-files=no')) throw new Error('Commit or stash tracked changes before switching issues.');
  };
  const fetchDevelop = () => {
    git('fetch', 'origin', 'refs/heads/develop:refs/remotes/origin/develop');
    return git('rev-parse', 'origin/develop');
  };
  const ancestor = (older, newer) => {
    try { git('merge-base', '--is-ancestor', older, newer); return true; } catch (error) {
      if (error.status === 1) return false;
      throw error;
    }
  };
  const syncDevelop = (sha) => {
    if (!ancestor('develop', sha)) throw new Error('Local develop has unmerged commits; resolve without resetting work.');
    git('switch', 'develop');
    git('merge', '--ff-only', 'origin/develop');
    if (git('rev-parse', 'HEAD') !== sha) throw new Error('Develop changed during synchronization; retry.');
  };
  const pulls = () => gh(['api', `repos/${REPO}/pulls?state=open&base=develop&per_page=100`, '--paginate', '--slurp']).flat();
  const noOtherPr = (branch) => {
    const others = pulls().filter((pr) => implementation(pr) && pr.head.ref !== branch);
    if (others.length) throw new Error(`Finish the open develop PR(s) first: ${others.map((pr) => `PR #${pr.number}`).join(', ')}.`);
  };
  const active = () => {
    const record = status().active;
    if (!record) throw new Error('No active issue. Run pnpm sdlc start <issue> <slug> first.');
    if (record.repo !== REPO || git('branch', '--show-current') !== record.branch) {
      throw new Error(`Current branch must match active issue #${record.issue}: ${record.branch}.`);
    }
    return record;
  };
  const currentBase = (record) => {
    if (fetchDevelop() !== record.baseSha) {
      throw new Error('Develop changed since this issue started. Stop; inspect docs/sdlc.md recovery before continuing.');
    }
    if (!ancestor(record.baseSha, 'HEAD')) throw new Error('Issue branch does not contain its recorded develop base.');
  };
  const start = (issue, slug, { adopt = false } = {}) => locked(() => {
    issue = positive(issue);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug ?? '')) throw new Error('Use a lowercase hyphenated branch slug.');
    const state = status();
    if (state.active) throw new Error(`Finish active issue #${state.active.issue} before starting another.`);
    clean();
    if (gh(['issue', 'view', String(issue), '--repo', REPO, '--json', 'state']).state !== 'OPEN') {
      throw new Error('An open issue must exist before work starts.');
    }
    const branch = `issue-${issue}-${slug}`;
    noOtherPr();
    const baseSha = fetchDevelop();
    if (adopt) {
      if (git('branch', '--show-current') !== branch || git('rev-parse', 'HEAD') !== baseSha) {
        throw new Error('Adopt only the matching issue branch before its first commit, at current develop.');
      }
    } else {
      // Check for collisions before switching; Git preserves untracked files itself.
      try { git('show-ref', '--verify', '--quiet', `refs/heads/${branch}`); throw new Error(`Branch ${branch} already exists; inspect it before proceeding.`); }
      catch (error) { if (error.status !== 1) throw error; }
      syncDevelop(baseSha);
      git('switch', '--no-track', '-c', branch, 'origin/develop');
    }
    state.active = { repo: REPO, issue, branch, baseSha, startedAt: new Date().toISOString() };
    save(state);
    return state.active;
  });
  const complete = (number) => locked(() => {
    number = positive(number);
    const state = status();
    const record = state.active;
    if (!record || record.repo !== REPO) throw new Error('No active issue to complete.');
    clean();
    const pr = gh(['pr', 'view', String(number), '--repo', REPO, '--json',
      'number,state,baseRefName,headRefName,headRefOid,isCrossRepository,mergeCommit,statusCheckRollup']);
    if (pr.state !== 'MERGED' || !pr.mergeCommit?.oid) throw new Error('PR must be merged before completing this issue.');
    if (pr.baseRefName !== 'develop' || pr.headRefName !== record.branch || pr.isCrossRepository ||
        pr.headRefOid !== git('rev-parse', record.branch)) throw new Error('PR base/head must match the active issue branch and its exact committed result.');
    green(pr.statusCheckRollup, 'PR head');
    const developSha = fetchDevelop();
    if (!ancestor(pr.mergeCommit.oid, developSha)) throw new Error('Merged result is not in fetched develop.');
    const runs = gh(['api', `repos/${REPO}/actions/runs?head_sha=${pr.mergeCommit.oid}&event=push&per_page=100`, '--paginate', '--slurp'])
      .flatMap((page) => page.workflow_runs);
    if (MERGE_WORKFLOWS.some((path) => !runs.some((run) => run.path === path)) ||
        runs.some((run) => run.status !== 'completed' || run.conclusion !== 'success' || !run.check_suite_id)) {
      throw new Error('Merge push workflows are missing, pending or failed. Active issue stays locked.');
    }
    const suites = new Set(runs.map((run) => run.check_suite_id));
    const checks = gh(['api', `repos/${REPO}/commits/${pr.mergeCommit.oid}/check-runs?per_page=100`, '--paginate', '--slurp']);
    // A commit can also be the head of an unrelated release PR or background job.
    green(checks.flatMap((page) => page.check_runs).filter((check) => suites.has(check.check_suite?.id)), 'Merge push');
    noOtherPr();
    syncDevelop(developSha);
    gh(['issue', 'close', String(record.issue), '--repo', REPO, '--comment',
      `Acceptance verified. PR #${number} merged into develop at ${pr.mergeCommit.oid}; PR and merge CI passed. Sequential delivery slot released.`]);
    state.lastComplete = { ...record, pr: number, mergeSha: pr.mergeCommit.oid, completedAt: new Date().toISOString() };
    state.active = null;
    save(state);
    return state.lastComplete;
  });
  const guardCommit = () => { const record = active(); currentBase(record); };
  const guardPush = (input) => {
    const record = active();
    const updates = input.trim().split('\n').filter(Boolean);
    if (!updates.length) return;
    for (const line of updates) {
      const [localRef, localSha, remoteRef] = line.split(/\s+/);
      if (localRef !== `refs/heads/${record.branch}` || remoteRef !== localRef || /^0+$/.test(localSha) ||
          localSha !== git('rev-parse', 'HEAD')) throw new Error('Push only the active issue branch to its matching remote ref; protected refs, tags and deletions are blocked.');
    }
    currentBase(record);
    noOtherPr(record.branch);
  };
  const install = () => {
    const hooks = 'scripts/git-hooks';
    const old = (() => { try { return git('config', '--get', 'core.hooksPath'); } catch (error) { if (error.status === 1) return ''; throw error; } })();
    const previousDir = old ? (isAbsolute(old) ? old : join(root, old)) : join(common, 'hooks');
    if (old !== hooks && existsSync(previousDir)) {
      const otherHooks = readdirSync(previousDir).filter((name) => !name.endsWith('.sample') &&
        !['pre-commit', 'pre-push'].includes(name) && statSync(join(previousDir, name)).isFile() &&
        (statSync(join(previousDir, name)).mode & 0o111));
      if (otherHooks.length) throw new Error(`Other active hooks require explicit chaining before install: ${otherHooks.join(', ')}. Existing configuration is preserved.`);
    }
    for (const name of ['pre-commit', 'pre-push']) {
      const path = join(root, hooks, name);
      if (!existsSync(path)) throw new Error(`Missing tracked hook ${path}.`);
    }
    const skill = readFileSync(join(root, 'scripts', 'sdlc-skill.md'), 'utf8');
    const targets = ['.agents/skills/sdlc/SKILL.md', '.claude/skills/sdlc/SKILL.md'];
    for (const target of targets) {
      const path = join(root, target);
      if (existsSync(path) && readFileSync(path, 'utf8') !== skill) throw new Error(`Preserve existing ${target}; reconcile it before install.`);
    }
    for (const target of targets) {
      const path = join(root, target); mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, skill);
    }
    if (old !== hooks) git('config', '--local', 'sdlc.previousHooksPath', old || join(common, 'hooks'));
    for (const name of ['pre-commit', 'pre-push']) chmodSync(join(root, hooks, name), 0o755);
    git('config', '--local', 'core.hooksPath', hooks);
    return 'Installed Git guards and sdlc skills for Codex, Antigravity and Claude Code. Prior hooks are chained.';
  };
  const previousHook = (name, args, input) => {
    if (!['pre-commit', 'pre-push'].includes(name)) throw new Error('Unsupported hook.');
    let previous;
    try { previous = git('config', '--get', 'sdlc.previousHooksPath'); } catch (error) { if (error.status === 1) return; throw error; }
    const path = join(isAbsolute(previous) ? previous : join(root, previous), name);
    if (resolve(path) === resolve(root, 'scripts', 'git-hooks', name)) throw new Error('Recursive hook configuration; inspect core.hooksPath.');
    if (existsSync(path)) run(root, path, args, { input, timeout: 0, stdio: ['pipe', 'inherit', 'inherit'] });
  };
  const ci = (number) => {
    number = positive(number);
    const pr = gh(['api', `repos/${REPO}/pulls/${number}`]);
    const developSha = gh(['api', `repos/${REPO}/git/ref/heads/develop`]).object.sha;
    validatePullRequest(pr, pulls(), developSha);
    if (implementation(pr)) {
      const issue = /^issue-(\d+)-/.exec(pr.head.ref)[1];
      if (gh(['issue', 'view', issue, '--repo', REPO, '--json', 'state']).state !== 'OPEN') {
        throw new Error('An open issue must exist before implementation.');
      }
    }
    const compare = gh(['api', `repos/${REPO}/compare/${developSha}...${pr.head.sha}`]);
    if (compare.merge_base_commit.sha !== developSha) throw new Error('PR head was not based on current develop.');
    return 'Sequential PR gate passed.';
  };
  return { start, complete, status, guardCommit, guardPush, install, previousHook, ci };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [command, first, second, ...rest] = process.argv.slice(2);
    if (!command || ['--help', 'help', '-h'].includes(command)) { console.log(HELP); }
    else {
      const api = createSdlc();
      let result;
      if (command === 'install') result = api.install();
      else if (command === 'status') result = api.status();
      else if (command === 'start') result = api.start(first, second, { adopt: rest.includes('--adopt') });
      else if (command === 'complete') result = api.complete(first);
      else if (command === 'ci') result = api.ci(first);
      else if (command === 'hook') {
        const input = first === 'pre-push' ? readFileSync(0, 'utf8') : '';
        if (first === 'pre-commit') api.guardCommit();
        else if (first === 'pre-push') api.guardPush(input);
        else throw new Error('Unsupported hook.');
        api.previousHook(first, [second, ...rest].filter((arg) => arg !== undefined), input);
      } else throw new Error(HELP);
      if (result !== undefined) console.log(typeof result === 'string' ? result : JSON.stringify(result, null, 2));
    }
  } catch (error) { console.error(`SDLC: ${error.message}`); process.exitCode = 1; }
}
