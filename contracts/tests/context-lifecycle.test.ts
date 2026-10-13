import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { ContractValidationError, validateContract } from "../src/index.js";

const reference = JSON.parse(readFileSync(new URL("../fixtures/context-lifecycle.json", import.meta.url), "utf8"));

for (const [name, record] of Object.entries(reference.records)) {
	test(`context lifecycle example: ${name}`, () => assert.deepEqual(validateContract(record), record));
}
for (const example of reference.invalidRecords) {
	test(`context lifecycle invalid example: ${example.name}`, () => {
		assert.throws(
			() => validateContract(example.record),
			(error) => {
				assert(error instanceof ContractValidationError);
				assert.equal(error.code, example.code);
				return true;
			},
		);
	});
}

test("the reference handoff binds the approved product, source revision and reviewer", () => {
	const context = reference.records.sharedContext;
	const decision = reference.records.approval;
	const product = reference.records.reviewedProduct;
	assert.deepEqual(context.sharedKnowledge[0].artifact, product.artifact);
	assert.deepEqual(context.sharedKnowledge[0].origin, product.scope);
	assert.deepEqual(context.sharedKnowledge[0].evidence, product.evidence);
	assert.deepEqual(context.sharedKnowledge[0].reviewDecisionRef, { id: decision.id, revision: decision.revision });
	assert.deepEqual(decision.productRef, product.artifact);
	assert.deepEqual(decision.scope, product.scope);
	assert.equal(decision.taskRevision, product.taskRevision);
	assert.deepEqual(product.review.decisionRefs, [{ id: decision.id, revision: decision.revision }]);
	assert.equal(decision.decision, "approve");
	assert.equal(context.scope.employeeId, "employee.research-analyst");
});
