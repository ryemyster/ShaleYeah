import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

export const CALLER_ROLES = Object.freeze(['development-planner', 'drilling-engineer',
  'infrastructure-planner', 'investment-chair', 'legal-analyst', 'market-analyst',
  'research-analyst', 'risk-analyst', 'title-analyst']);
export const UNIT_NAMES = Object.freeze(['geologist', 'reporter', 'economist', 'qa']);
export const PLAN_KIND = 'shaleyeah.ci-impact/v1';
export const isRevision = (value) => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);

const agentOwners = {
  geologist: ['geologist', 'reporter'], 'reporter-agent': ['reporter'],
  economist: ['economist'], 'quality-assurance': ['qa'],
};
const serverOwners = {
  geowiz: ['geologist', 'reporter'], reporter: ['reporter'], econobot: ['economist'],
  'qa-server': ['qa'], 'curve-smith': [],
};
const serverCallers = {
  development: 'development-planner', drilling: 'drilling-engineer',
  infrastructure: 'infrastructure-planner', decision: 'investment-chair',
  legal: 'legal-analyst', market: 'market-analyst', research: 'research-analyst',
  'risk-analysis': 'risk-analyst', title: 'title-analyst',
};
const documentationPaths = new Set(['README.md', 'ARCHITECTURE.md', 'CONTRIBUTING.md', 'CHANGELOG.md',
  'docs/ci.md', 'docs/sdlc.md', 'docs/mvp-release-plan.md', 'docs/legacy-migration-ledger.md']);
const sharedRoots = ['sdk/', 'contracts/', 'connectors/', 'evaluations/', '.github/', 'scripts/'];
const own = (map, key) => typeof key === 'string' && Object.hasOwn(map, key) ? map[key] : undefined;

function validPath(value) {
  return typeof value === 'string' && value.length > 0 && !value.startsWith('/') &&
    !/[\x00-\x1f\x7f\\]/.test(value) && !value.split('/').some((part) => part === '.' || part === '..');
}

export function selectImpact({ eventName, baseSha, headSha, codeRevision, changedPaths }) {
  if (!isRevision(codeRevision)) throw new Error('invalid_code_revision');
  const plan = { kind: PLAN_KIND, eventName: ['pull_request', 'push', 'workflow_dispatch'].includes(eventName)
    ? eventName : 'unknown', codeRevision, baseSha: isRevision(baseSha) ? baseSha : null,
  headSha: isRevision(headSha) ? headSha : null, full: false,
  units: Object.fromEntries(UNIT_NAMES.map((unit) => [unit, false])), callers: [],
  changedPathCount: Array.isArray(changedPaths) ? new Set(changedPaths).size : 0, reasons: [] };
  const reasons = new Set();
  const selectedCallers = new Set();
  const full = (reason) => { plan.full = true; reasons.add(reason); };
  if (plan.eventName !== 'pull_request') full('full_event');
  if (!plan.baseSha || !plan.headSha || !Array.isArray(changedPaths) || !changedPaths.length) full('unavailable_comparison');
  for (const file of Array.isArray(changedPaths) ? changedPaths : []) {
    if (!validPath(file)) { full('invalid_path'); continue; }
    if (sharedRoots.some((prefix) => file.startsWith(prefix))) { full('shared_input'); continue; }
    const agent = /^agents\/([^/]+)\//.exec(file)?.[1];
    const server = /^servers\/([^/]+)\//.exec(file)?.[1];
    const owners = agent ? own(agentOwners, agent) : own(serverOwners, server);
    const caller = agent && CALLER_ROLES.includes(agent) ? agent : own(serverCallers, server);
    if (owners !== undefined || caller) {
      for (const owner of owners ?? []) { plan.units[owner] = true; reasons.add(`unit:${owner}`); }
      if (caller) { selectedCallers.add(caller); reasons.add('protocol_caller'); }
      if (!owners?.length && !caller) reasons.add('workspace_owner');
    } else if (!agent && !server && documentationPaths.has(file)) {
      reasons.add('documentation');
    } else full('unknown_path');
  }
  if (plan.full) {
    plan.units = Object.fromEntries(UNIT_NAMES.map((unit) => [unit, true]));
    plan.callers = [...CALLER_ROLES];
  } else plan.callers = CALLER_ROLES.filter((role) => selectedCallers.has(role));
  plan.reasons = [...reasons].sort();
  return plan;
}

export function inspectImpact({ repoRoot, eventName, baseSha, headSha, codeRevision }) {
  const git = (...args) => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', stdio: 'pipe' }).trim();
  const actual = git('rev-parse', 'HEAD');
  if (!isRevision(actual) || actual !== codeRevision) throw new Error('checkout_revision_mismatch');
  const args = { eventName, baseSha, headSha, codeRevision };
  if (eventName !== 'pull_request' || !isRevision(baseSha) || !isRevision(headSha)) return selectImpact(args);
  let changedPaths;
  try {
    // A stale/divergent base uses full verification; it cannot produce a narrow plan.
    git('merge-base', '--is-ancestor', baseSha, headSha);
    git('merge-base', '--is-ancestor', headSha, codeRevision);
    const raw = execFileSync('git', ['diff', '--name-only', '--no-renames', '-z', baseSha, headSha, '--'],
      { cwd: repoRoot, encoding: 'utf8', stdio: 'pipe', maxBuffer: 32 * 1024 * 1024 });
    if (raw && !raw.endsWith('\0')) return selectImpact(args);
    changedPaths = raw ? raw.slice(0, -1).split('\0') : [];
  } catch { return selectImpact(args); }
  return selectImpact({ ...args, changedPaths });
}

export function runImpact({ argv = process.argv.slice(2), env = process.env,
  write = (text) => console.log(text) } = {}) {
  const { values } = parseArgs({ args: argv, options: { repo: { type: 'string' }, output: { type: 'string' } } });
  if (!values.output) throw new Error('missing_plan_output');
  const repoRoot = values.repo ?? process.cwd();
  let event = {};
  try { event = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, 'utf8')); } catch { /* Full fallback for unavailable event input. */ }
  const codeRevision = env.GITHUB_SHA ?? execFileSync('git', ['rev-parse', 'HEAD'],
    { cwd: repoRoot, encoding: 'utf8', stdio: 'pipe' }).trim();
  const plan = inspectImpact({ repoRoot, eventName: env.GITHUB_EVENT_NAME,
    baseSha: event?.pull_request?.base?.sha, headSha: event?.pull_request?.head?.sha, codeRevision });
  mkdirSync(path.dirname(values.output), { recursive: true });
  writeFileSync(values.output, `${JSON.stringify(plan, null, 2)}\n`);
  if (env.GITHUB_OUTPUT) {
    const outputs = { plan: JSON.stringify(plan), callers: JSON.stringify(plan.callers),
      ...Object.fromEntries(UNIT_NAMES.map((unit) => [unit, String(plan.units[unit])])) };
    appendFileSync(env.GITHUB_OUTPUT, `${Object.entries(outputs).map(([key, value]) => `${key}=${value}`).join('\n')}\n`);
  }
  write(JSON.stringify(plan));
  return plan;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { runImpact(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
