// Retained deterministic estimate helpers are legacy API; production synthesis does not use them.
// Removal of professional-data estimates is owned by #671.
import assert from "node:assert/strict";
import { test } from "node:test";
import { deriveDefaultFormationProperties } from "../src/index.js";

// Formation-aware fallback tests (from support-servers-anti-stub #217)

test("geowiz: Wolfcamp shale stack has lower porosity and higher netPay than unknown formation", () => {
	const wolfcamp = deriveDefaultFormationProperties(["Wolfcamp A", "Wolfcamp B", "Bone Spring"], 7000);
	const unknown = deriveDefaultFormationProperties(["Unidentified Formation"], 7000);
	assert.ok(wolfcamp.porosity < unknown.porosity);
	assert.ok(wolfcamp.netPay > unknown.netPay);
});

test("geowiz: maturity follows depth tiers — deep gas window differs from shallow immature", () => {
	const deepGas = deriveDefaultFormationProperties(["Haynesville"], 9000);
	const shallow = deriveDefaultFormationProperties(["Haynesville"], 3000);
	assert.strictEqual(deepGas.maturity, "Overmature Gas Window");
	assert.strictEqual(shallow.maturity, "Immature");
});

test("geowiz: carbonate play (Spraberry) differs from shale play (Eagle Ford)", () => {
	const spraberry = deriveDefaultFormationProperties(["Spraberry", "Clear Fork"], 6500);
	const eagleFord = deriveDefaultFormationProperties(["Eagle Ford"], 6500);
	assert.notStrictEqual(spraberry.porosity, eagleFord.porosity);
	assert.ok(spraberry.porosity > eagleFord.porosity);
	assert.notStrictEqual(eagleFord.porosity, 12.0);
	assert.notStrictEqual(eagleFord.netPay, 150);
});
