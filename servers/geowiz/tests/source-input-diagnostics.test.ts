import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { createConnectorRuntime, operatorFileAdapter } from "@shaleyeah/connectors";
import { z } from "zod";
import { createSourceAnalysisTool } from "../src/source-tools.js";
import { parseLASFile } from "../src/tools/las-parse.js";
import { sourceConfig } from "./fixtures/source-config.mjs";

test("contradictory approved depth is a permanent input error with provenance", async () => {
	const directory = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "geowiz-invalid-input-")));
	const principal = {
		subjectId: "operator",
		customerId: "operator-demo",
		employeeId: "employee.geologist",
		scopes: ["source:read"],
	};
	try {
		const file = path.join(directory, "private.las");
		const sample = await fs.readFile(new URL("sample-files/sample.las", import.meta.url), "utf8");
		await fs.writeFile(file, sample.replace("STOP.FT                 8410.0000", "STOP.FT                 8450.0000"));
		const config = await sourceConfig(file, principal);
		const sources = createConnectorRuntime(config, {
			audit: async () => {},
			installedAdapters: [operatorFileAdapter],
			currentGrant: async () => config.grant,
		});
		const tool = createSourceAnalysisTool({ sourceRuntime: sources, localSourcePrincipal: principal })(
			"assess_quality",
			"observed input",
			z.object({ filePath: z.string(), dataType: z.literal("las") }),
			async (args) => ({ parsed: parseLASFile(args.filePath) }),
		);
		const result = await tool.handler({ filePath: file, dataType: "las" });
		assert.equal(result.success, false);
		assert.equal(result.error_type, "permanent", JSON.stringify(result));
		assert.equal(result.inputError.code, "invalid_depth");
		assert.equal(result.sourceArtifact.evidence.hash.value, config.sources[0].evidence.hash.value);
		assert.ok(!JSON.stringify(result).includes(directory));
	} finally {
		await fs.rm(directory, { recursive: true, force: true });
	}
});
