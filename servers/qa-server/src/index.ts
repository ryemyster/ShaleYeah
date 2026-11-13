#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { runMCPServer } from "@shaleyeah/sdk";
import { loadQABinding } from "./configuration.js";
import { QAServer } from "./server.js";

export { createQATemplate, type QAOptions, QAServer } from "./server.js";
export { evaluateQARules, qaProfileSchema } from "./tools/qa-rules.js";
export default QAServer;
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	try {
		const file = process.env.QA_CONFIG_FILE;
		runMCPServer(new QAServer(file ? await loadQABinding(file) : {}));
	} catch {
		console.error("QA startup blocked: private configuration unavailable");
		process.exitCode = 1;
	}
}
