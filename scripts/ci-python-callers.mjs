import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { CALLER_ROLES } from './ci-impact.mjs';

export function runCallers(roles, { repoRoot = process.cwd(), env = process.env } = {}) {
  if (!Array.isArray(roles) || new Set(roles).size !== roles.length || roles.some((role) => !CALLER_ROLES.includes(role))) {
    throw new Error('invalid_caller_role');
  }
  const commands = [
    ['run', '--locked', '--extra', 'lint', 'ruff', 'check', 'app', 'tests'],
    ['run', '--locked', 'pytest', '-q'],
    ['run', '--locked', 'python', '-c', 'from app.agent import root_agent; assert root_agent.name; print(root_agent.name)'],
    ['run', '--locked', 'python', '-c', 'from importlib.metadata import version; assert version("mcp") == "2.3.0"; assert version("shaleyeah-mcp-client") == "0.3.0"'],
  ];
  for (const role of roles) {
    for (const args of commands) {
      try { execFileSync('uv', args, { cwd: path.join(repoRoot, 'agents', role), env, stdio: 'inherit' }); }
      catch (cause) { throw new Error(`caller_failed:${role}`, { cause }); }
    }
  }
}

export function runCallerCLI({ repoRoot = process.cwd(), env = process.env } = {}) {
  let roles;
  try { roles = JSON.parse(env.CI_CALLER_ROLES_JSON); }
  catch { throw new Error('invalid_caller_role_input'); }
  runCallers(roles, { repoRoot, env });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { runCallerCLI(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
