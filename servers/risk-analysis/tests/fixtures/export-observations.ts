/** Backend observations only. Frozen independent arithmetic lives in joint-scenario-oracles.json. */
import { oracles } from "./joint-risk.js";
import { now, ref, riskFixture, who } from "./risk.js";

const observations: Record<string, unknown> = {};
for (const name of [...Object.keys(oracles.cases), "missing-evidence", "severe-zero"]) {
	const referenceName = name === "missing-evidence" ? "dependent" : name === "severe-zero" ? "zero-variance" : name;
	const f = riskFixture(referenceName);
	if (name === "missing-evidence") {
		f.register.entries[0].evidenceState = "missing";
		f.register.entries[0].evidenceRefs = [];
	} else if (name === "severe-zero") f.register.entries[1].severity = "critical";
	f.texts.set("register", JSON.stringify(f.register));
	f.bind();
	const result = await f.service.draft(ref, { id: "joint.fixture", revision: "r1" }, "r1", who);
	observations[name] = {
		...result,
		evaluatedAt: now.toISOString(),
		register: f.register,
		policy: f.policy,
		model: f.scenarios.models[0],
		referenceName,
	};
}
process.stdout.write(`${JSON.stringify(observations, null, 2)}\n`);
