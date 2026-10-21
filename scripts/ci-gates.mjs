import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { CALLER_ROLES, PLAN_KIND, UNIT_NAMES, isRevision, selectImpact } from './ci-impact.mjs';

function validCallers(roles) {
  return Array.isArray(roles) && roles.every((role) => CALLER_ROLES.includes(role)) &&
    new Set(roles).size === roles.length &&
    JSON.stringify(roles) === JSON.stringify(CALLER_ROLES.filter((role) => roles.includes(role)));
}

export function validatePlan(plan) {
  if (!plan || plan.kind !== PLAN_KIND || !isRevision(plan.codeRevision) || typeof plan.full !== 'boolean' ||
      !plan.units || Object.keys(plan.units).length !== UNIT_NAMES.length ||
      UNIT_NAMES.some((unit) => typeof plan.units[unit] !== 'boolean') || !validCallers(plan.callers) ||
      !Array.isArray(plan.reasons) || !plan.reasons.length || plan.reasons.some((reason) => typeof reason !== 'string') ||
      !Number.isSafeInteger(plan.changedPathCount) || plan.changedPathCount < 0 ||
      !['pull_request', 'push', 'workflow_dispatch', 'unknown'].includes(plan.eventName)) throw new Error('invalid_plan');
  if (plan.full) {
    if (UNIT_NAMES.some((unit) => !plan.units[unit]) || plan.callers.length !== CALLER_ROLES.length) throw new Error('incomplete_full_plan');
  } else if (plan.eventName !== 'pull_request' || !isRevision(plan.baseSha) || !isRevision(plan.headSha) ||
      !plan.changedPathCount) throw new Error('invalid_narrow_plan');
  return plan;
}

export function assertGate({ scope, plan, results, codeRevision, inputs }) {
  validatePlan(plan);
  if (!isRevision(codeRevision) || plan.codeRevision !== codeRevision) throw new Error('gate_revision_mismatch');
  if (scope === 'reference' && inputs) {
    let callers;
    try { callers = JSON.parse(inputs.callers); } catch { throw new Error('invalid_reusable_input'); }
    if (['geologist', 'reporter', 'economist'].some((unit) => inputs[unit] !== plan.units[unit]) ||
        JSON.stringify(callers) !== JSON.stringify(plan.callers)) throw new Error('reusable_input_mismatch');
  }
  const expected = scope === 'reference' ? { reference: plan.units.geologist, reporter: plan.units.reporter,
    economist: plan.units.economist, 'protocol-callers': plan.callers.length > 0 } : scope === 'final'
    ? { impact: true, workspace: true, 'reference-qualification': true, 'qa-observed-qualification': plan.units.qa }
    : null;
  if (!expected) throw new Error('invalid_gate_scope');
  if (!results || Object.keys(results).some((name) => !Object.hasOwn(expected, name))) throw new Error('unexpected_job_result');
  for (const [name, required] of Object.entries(expected)) {
    const result = results[name];
    if (result !== 'success' && !(result === 'skipped' && !required)) throw new Error(`job_not_successful:${name}`);
  }
}

function parse(value, reason) {
  try { return JSON.parse(value); }
  catch { throw new Error(reason); }
}

export function runGate(env = process.env, write = (text) => console.log(text)) {
  const scope = env.CI_GATE_SCOPE;
  const codeRevision = env.GITHUB_SHA;
  const checkedOut = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: 'pipe' }).trim();
  if (!isRevision(codeRevision) || checkedOut !== codeRevision) throw new Error('gate_checkout_revision_mismatch');
  let plan;
  if (env.CI_PLAN_JSON?.trim()) plan = parse(env.CI_PLAN_JSON, 'invalid_plan');
  else if (scope === 'reference') plan = selectImpact({ eventName: env.GITHUB_EVENT_NAME, codeRevision });
  else throw new Error('missing_plan');
  const needs = parse(env.CI_NEEDS_JSON, 'invalid_needs');
  if (!needs || typeof needs !== 'object' || Array.isArray(needs)) throw new Error('invalid_needs');
  let inputs;
  if (scope === 'reference') {
    inputs = parse(env.CI_INPUTS_JSON, 'invalid_reusable_input');
    if (!inputs || typeof inputs !== 'object' || Array.isArray(inputs)) throw new Error('invalid_reusable_input');
  }
  const results = Object.fromEntries(Object.entries(needs).map(([name, value]) => [name, value?.result]));
  assertGate({ scope, plan, results, codeRevision, inputs });
  write(`CI ${scope} gate passed at ${plan.codeRevision}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { runGate(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
