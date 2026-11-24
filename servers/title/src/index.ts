#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { runMCPServer } from "@shaleyeah/sdk";
import { loadTitleBinding } from "./configuration.js";
import { TitleServer } from "./server.js";

export type { TitleReviewOptions } from "./review-workflow.js";
export { parseTitleReviewPolicy, TitleReviewWorkflow } from "./review-workflow.js";
export type { TitleServerOptions } from "./server.js";
export { createTitleTemplate, TitleServer } from "./server.js";
export type { TitleSnapshotHookOptions } from "./source-hooks.js";
export { createTitleSnapshotHook } from "./source-hooks.js";
export type { TitleCorpus, TitleExamination, TitlePolicy, TitleProposal } from "./title-packet.js";
export { buildTitlePacket, reconcileTitle } from "./title-packet.js";
export type { TitleServiceOptions, TitleSource } from "./title-service.js";
export { TitlePacketService } from "./title-service.js";
export default TitleServer;

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	try {
		const file = process.env.TITLE_CONFIG_FILE;
		runMCPServer(new TitleServer(file ? await loadTitleBinding(file) : {}));
	} catch {
		console.error("Title startup blocked: private source/task/review configuration unavailable");
		process.exitCode = 1;
	}
}
