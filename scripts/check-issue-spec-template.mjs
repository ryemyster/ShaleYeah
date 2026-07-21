import { readFileSync } from "node:fs";

const templatePath = ".github/ISSUE_TEMPLATE/implementation_spec.yml";
const template = readFileSync(templatePath, "utf8");

const requiredIds = [
  "role",
  "use_case",
  "operating_mode",
  "boundaries",
  "inputs",
  "outputs",
  "behavior_spec",
  "hitl",
  "memory",
  "runtime",
  "evals",
  "trust",
  "docs_topology",
  "deletion_migration",
  "non_goals",
  "dependencies",
  "planning_gate",
];

const requiredPhrases = [
  "Given/When/Then",
  "Failure case",
  "maintainer has approved the issue plan before code changes",
  "Delete displaced TypeScript adapter",
  "No root ADK scaffold",
  "one branch and one PR",
];

let failed = false;

for (const id of requiredIds) {
  if (!new RegExp(`id:\\s*${id}\\b`).test(template)) {
    console.error(`Missing required issue-form id: ${id}`);
    failed = true;
  }
}

for (const phrase of requiredPhrases) {
  if (!template.includes(phrase)) {
    console.error(`Missing required issue-form phrase: ${phrase}`);
    failed = true;
  }
}

const requiredCount = (template.match(/required:\s*true/g) ?? []).length;
if (requiredCount < requiredIds.length) {
  console.error(`Expected at least ${requiredIds.length} required fields, found ${requiredCount}`);
  failed = true;
}

if (failed) {
  process.exit(1);
}

console.log(`Issue spec template check passed: ${requiredIds.length} required sections verified.`);
