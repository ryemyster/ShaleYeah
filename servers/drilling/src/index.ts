#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { runMCPServer } from "@shaleyeah/sdk";
import { loadDrillingBinding } from "./configuration.js";
import { DrillingServer } from "./server.js";

export type { DrillingCorpus, DrillingDesign, DrillingPolicy, DrillingProposal } from "./drilling-packet.js";
export { buildDrillingPacket, reconcileDrilling } from "./drilling-packet.js";
export type { DrillingServiceOptions, DrillingSource } from "./drilling-service.js";
export { DrillingPacketService } from "./drilling-service.js";
export type { DrillingReviewOptions } from "./review-workflow.js";
export { DrillingReviewWorkflow, parseDrillingReviewPolicy } from "./review-workflow.js";
export type { DrillingServerOptions } from "./server.js";
export { createDrillingTemplate, DrillingServer } from "./server.js";
export type { DrillingSnapshotHookOptions } from "./source-hooks.js";
export { createDrillingSnapshotHook } from "./source-hooks.js";
export default DrillingServer;

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	try {
		const file = process.env.DRILLING_CONFIG_FILE;
		runMCPServer(new DrillingServer(file ? await loadDrillingBinding(file) : {}));
	} catch {
		console.error("Drilling startup blocked: private source/task/review configuration unavailable");
		process.exitCode = 1;
	}
}
