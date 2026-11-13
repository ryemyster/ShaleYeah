import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { EmployeeReviewWorkflow } from "../src/employee-review.js";

test("review core refuses an absent role adapter before creating durable storage", () => {
	const root = mkdtempSync(path.join(os.tmpdir(), "employee-review-control-"));
	try {
		assert.throws(
			() =>
				new EmployeeReviewWorkflow(
					path.join(root, "state"),
					{
						currentPolicy: async () => ({}),
						contentGuard: async () => true,
						sources: {
							request: (id: string) => id,
							fetch: async () => {
								throw new Error("unused");
							},
						},
					},
					undefined as never,
				),
			/configuration/,
		);
	} finally {
		rmSync(root, { recursive: true });
	}
});
