import assert from "node:assert/strict";
import { parseAgentJsonResponse } from "../../src/agent-loop.js";

// Import only the parser's module so startup does not load unrelated SDK parsers.
// The parent can kill this process if synchronous regex backtracking returns.
const response = `${" ".repeat(250_000)}x`;
const answer = `prefix${" ".repeat(250_000)}suffix`;
const json = JSON.stringify({ action: "done", answer });

assert.equal(parseAgentJsonResponse(response), null);
for (const input of [json, `\`\`\`json\n${json}\n\`\`\``]) {
	assert.equal(parseAgentJsonResponse(input)?.answer, answer);
}
