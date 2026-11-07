import { constants } from "node:fs";
import fs from "node:fs/promises";
import { readPrivateJson } from "@shaleyeah/sdk";
import { loadEconomicBinding } from "../dist/configuration.js";

// Enrolled human API, deliberately separate from employee/model tools.
let binding;
try {
	const [command, reviewId, ...args] = process.argv.slice(2);
	binding = await loadEconomicBinding(process.env.ECONOBOT_CONFIG_FILE);
	const reviewer = await binding.reviewer();
	if (command === "inspect" && args.length === 1) {
		const preview = await binding.reviewWorkflow.inspect(reviewId, reviewer);
		const handle = await fs.open(args[0], constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
		try { await handle.writeFile(`${JSON.stringify(preview, null, 2)}\n`); await handle.sync(); } finally { await handle.close(); }
		console.log(JSON.stringify({ reviewId: preview.reviewId, packetDigest: preview.packetDigest, state: preview.state }));
	} else if (command === "decide" && args.length === 3) {
		const [digest, choice, reasonFile] = args;
		const reason = await readPrivateJson(reasonFile, 4096);
		if (!reason || typeof reason !== "object" || typeof reason.reason !== "string" || Object.keys(reason).some((key) => !["reason", "humanReviewSeconds", "corrections"].includes(key))) throw new Error("Invalid human reason");
		const { reason: text, ...measurements } = reason;
		const result = await binding.reviewWorkflow.decide(reviewId, digest, choice, text, reviewer, measurements);
		console.log(JSON.stringify({ reviewId: result.reviewId, state: result.state }));
	} else {
		throw new Error("Use inspect REVIEW_ID NEW_PRIVATE_PACKET_FILE or decide REVIEW_ID PACKET_DIGEST approve|reject|request_changes PRIVATE_REASON_JSON");
	}
} catch {
	console.error("Economist human review blocked: verify enrolled identity, private configuration, exact revision, current source rights and installed qualification.");
	process.exitCode = 1;
} finally { binding?.close(); }
