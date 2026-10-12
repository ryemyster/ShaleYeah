import { constants } from "node:fs";
import fs from "node:fs/promises";
import { loadReviewBinding } from "../dist/review-config.js";

// This command is for the enrolled OS operator, never a model tool or public HTTP route.
let binding;
try {
	const [command, reviewId, ...args] = process.argv.slice(2);
	binding = await loadReviewBinding(process.env.GEOWIZ_REVIEW_CONFIG_FILE);
	const reviewer = await binding.reviewer();
	if (command === "purge" && reviewId === undefined && args.length === 0) {
		console.log(JSON.stringify({ purged: await binding.workflow.purgeExpired(reviewer) }));
	} else if (command === "inspect" && args.length === 1) {
		const packet = await binding.workflow.inspect(reviewId, reviewer);
		const handle = await fs.open(
			args[0],
			constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
			0o600,
		);
		try {
			await handle.writeFile(`${JSON.stringify(packet, null, 2)}\n`);
			await handle.sync();
		} finally {
			await handle.close();
		}
		console.log(JSON.stringify({ reviewId: packet.reviewId, packetDigest: packet.packetDigest, state: packet.state }));
	} else if (command === "decide" && args.length === 3) {
		const [packetDigest, decision, reasonFile] = args;
		const handle = await fs.open(reasonFile, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
		let reason;
		try {
			const stat = await handle.stat();
			if (!stat.isFile() || stat.nlink !== 1 || stat.mode & 0o077 || stat.uid !== process.getuid() || stat.size > 2048)
				throw new Error("Private reason file required");
			const bytes = Buffer.alloc(2049);
			const { bytesRead } = await handle.read(bytes, 0, bytes.length, 0);
			if (bytesRead !== stat.size) throw new Error("Reason changed");
			reason = bytes.subarray(0, bytesRead).toString("utf8").trim();
		} finally {
			await handle.close();
		}
		const result = await binding.workflow.decide(reviewId, packetDigest, decision, reason, reviewer);
		console.log(JSON.stringify({ reviewId: result.reviewId, state: result.state }));
	} else {
		throw new Error(
			"Use inspect REVIEW_ID NEW_PRIVATE_PACKET_FILE or decide REVIEW_ID PACKET_DIGEST approve|reject|request_changes PRIVATE_REASON_FILE",
		);
	}
} catch {
	console.error(
		"Geowiz human review blocked. Check the owned configuration, enrolled OS identity, exact packet digest and current source rights.",
	);
	process.exitCode = 1;
} finally {
	binding?.workflow.close();
}
