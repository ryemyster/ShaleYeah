import assert from "node:assert/strict";
import { test } from "node:test";
import { createEiaSnapshotAdapter, normalizeEiaPriceSnapshot } from "../src/source-hooks.js";
import { fixture, now } from "./fixtures/scenario.js";

// Synthetic APIv2-shaped response. This is not a downloaded or licensed EIA dataset.
const profile = {
	version: "0.1.0",
	route: "petroleum/pri/spt",
	series: "RWTC",
	frequency: "monthly",
	unitsField: "value-units",
	expectedUnit: "Dollars per Barrel",
	maxObservationAgeDays: 90,
};
const payload = () => ({
	response: {
		total: "2",
		frequency: "monthly",
		data: [
			{ period: "2026-08", series: "RWTC", value: "0", "value-units": "Dollars per Barrel" },
			{ period: "2026-09", series: "RWTC", value: "-37.63", "value-units": "Dollars per Barrel" },
		],
	},
	request: { params: { api_key: "synthetic-source-credential" } },
});

test("configured EIA snapshot mapping preserves observations, units and zeros while dropping echoed credentials", () => {
	const csv = normalizeEiaPriceSnapshot(payload(), profile, now);
	assert.match(csv, /2026-08,RWTC,0,Dollars per Barrel,monthly/);
	assert.match(csv, /2026-09,RWTC,-37.63,Dollars per Barrel,monthly/);
	assert.ok(!csv.includes("synthetic-source-credential") && !csv.includes("api_key"));
});

test("missing, stale, incomplete, mismatched or malformed API observations cannot turn into a price deck", () => {
	for (const change of [
		(value: ReturnType<typeof payload>) => {
			value.response.data[0].value = "";
		},
		(value: ReturnType<typeof payload>) => {
			value.response.data[0].value = "NaN";
		},
		(value: ReturnType<typeof payload>) => {
			value.response.data[0]["value-units"] = "USD per gallon";
		},
		(value: ReturnType<typeof payload>) => {
			value.response.data[0].series = "RBRTE";
		},
		(value: ReturnType<typeof payload>) => {
			value.response.frequency = "daily";
		},
		(value: ReturnType<typeof payload>) => {
			value.response.total = "100";
		},
		(value: ReturnType<typeof payload>) => {
			value.response.data[0].period = "2026-09";
		},
		(value: ReturnType<typeof payload>) => {
			value.response.data[0].period = "2099-01";
		},
	]) {
		const value = payload();
		change(value);
		assert.throws(() => normalizeEiaPriceSnapshot(value, profile, now));
	}
	assert.throws(() => normalizeEiaPriceSnapshot({ response: { data: [] } }, profile, now));
	assert.throws(
		() => normalizeEiaPriceSnapshot(payload(), profile, new Date("2030-01-01T00:00:00Z")),
		/stale_price_snapshot/,
	);
});

test("installed snapshot hook accepts host credentials and explicit revisions, with value-free failures", async () => {
	const f = fixture(),
		source = f.fetched("evidence.prices").artifact;
	let calls = 0;
	const adapter = createEiaSnapshotAdapter({
		profile,
		clock: () => now,
		readSnapshot: async (request) => {
			calls++;
			assert.equal(request.credential, "synthetic-private-source-value");
			return { payload: payload(), revision: "snapshot-r1", asOf: source.evidence.asOf };
		},
	});
	const configured = {
		evidence: { ...source.evidence, revision: "snapshot-r1" },
		sourceKind: "public-download",
		format: "csv",
		locator: "operator-selected-eia-snapshot",
		jurisdiction: "US",
		units: [],
		accessNotes: "Public observation snapshot",
		licenseNotes: "Synthetic API fixture",
	};
	const result = await adapter.fetch(configured as never, {
		workspaceRoot: "/unused",
		maxBytes: 65536,
		credential: "synthetic-private-source-value",
		signal: new AbortController().signal,
	});
	assert.equal(calls, 1);
	assert.equal(result.revisionOrigin, "operator-declared");
	assert.ok(new TextDecoder().decode(result.bytes).includes("-37.63"));
	const failing = createEiaSnapshotAdapter({
		profile,
		clock: () => now,
		readSnapshot: async () => {
			throw new Error("synthetic-private-source-value");
		},
	});
	await assert.rejects(
		failing.fetch(configured as never, {
			workspaceRoot: "/unused",
			maxBytes: 65536,
			signal: new AbortController().signal,
		}),
		(error: unknown) =>
			error instanceof Error &&
			/source_unavailable/.test(error.message) &&
			!error.message.includes("synthetic-private-source-value"),
	);
});
