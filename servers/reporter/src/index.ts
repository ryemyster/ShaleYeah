#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { runMCPServer } from "@shaleyeah/sdk";
import { loadReporterBinding } from "./configuration.js";
import { ReporterServer } from "./server.js";

export { createReporterTemplate, type ReporterOptions, ReporterServer } from "./server.js";
export default ReporterServer;
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	try {
		const file = process.env.REPORTER_CONFIG_FILE;
		runMCPServer(new ReporterServer(file ? await loadReporterBinding(file) : {}));
	} catch {
		console.error("Reporter startup blocked: private configuration unavailable");
		process.exitCode = 1;
	}
}
