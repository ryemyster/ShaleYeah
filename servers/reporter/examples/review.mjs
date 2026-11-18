import { constants } from "node:fs";
import fs from "node:fs/promises";
import { readPrivateJson } from "@shaleyeah/sdk";
import { loadReporterBinding } from "../dist/configuration.js";

// This enrolled operator interface is separate from employee/model tools.
let binding;
try {
	const [command, reviewId, ...args] = process.argv.slice(2);
	binding = await loadReporterBinding(process.env.REPORTER_CONFIG_FILE);
	const reviewer = await binding.reviewer();
	if (command === "inspect" && args.length === 1) {
		const inspected = await binding.reviewWorkflow.inspect(reviewId, reviewer);
		const handle = await fs.open(
			args[0],
			constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
			0o600,
		);
		try {
			await handle.writeFile(`${JSON.stringify(inspected, null, 2)}\n`);
			await handle.sync();
		} finally {
			await handle.close();
		}
		console.log(
			JSON.stringify({ reviewId: inspected.reviewId, packetDigest: inspected.packetDigest, state: inspected.state }),
		);
	} else if (command === "decide" && args.length === 3) {
		const [digest, choice, reasonFile] = args;
		const reason = await readPrivateJson(reasonFile, 2048);
		if (
			!reason ||
			typeof reason !== "object" ||
			typeof reason.reason !== "string" ||
			Object.keys(reason).some((key) => !["reason", "humanReviewSeconds", "corrections"].includes(key))
		)
			throw new Error("Invalid operator reason");
		const { reason: text, ...measurements } = reason;
		const result = await binding.reviewWorkflow.decide(reviewId, digest, choice, text, reviewer, measurements);
		console.log(JSON.stringify({ reviewId: result.reviewId, state: result.state }));
	} else {
		throw new Error(
			"Use inspect REVIEW_ID NEW_PRIVATE_PACKET_FILE or decide REVIEW_ID PACKET_DIGEST approve|reject|request_changes PRIVATE_REASON_JSON",
		);
	}
} catch {
	console.error(
		"Reporter human review blocked: check enrolled identity, private configuration, exact revision, current source rights and qualification.",
	);
	process.exitCode = 1;
} finally {
	binding?.reviewWorkflow.close();
}
