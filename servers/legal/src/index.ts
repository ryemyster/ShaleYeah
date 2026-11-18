#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { runMCPServer } from "@shaleyeah/sdk";
import { loadLegalBinding } from "./configuration.js";
import { LegalServer } from "./server.js";

export type { LegalServiceOptions, LegalSource } from "./legal-service.js";
export { LegalMemoService } from "./legal-service.js";
export type { LegalReviewOptions } from "./review-workflow.js";
export { LegalReviewWorkflow, parseLegalReviewPolicy } from "./review-workflow.js";
export type { LegalServerOptions } from "./server.js";
export { createLegalTemplate, LegalServer } from "./server.js";
export type { LegalSnapshotHookOptions } from "./source-hooks.js";
export { createLegalSnapshotHook } from "./source-hooks.js";
export default LegalServer;

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	try {
		const file = process.env.LEGAL_CONFIG_FILE;
		runMCPServer(new LegalServer(file ? await loadLegalBinding(file) : {}));
	} catch {
		console.error("Legal startup blocked: private source/task/review configuration unavailable");
		process.exitCode = 1;
	}
}
