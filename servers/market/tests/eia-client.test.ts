import assert from "node:assert/strict";
import { test } from "node:test";
import { createEiaPriceClient } from "../src/prices.js";
import { eiaRow, NOW } from "./fixtures/evidence.js";

function fixture(overrides: Partial<Parameters<typeof createEiaPriceClient>[0]> = {}) {
	let now = new Date(NOW);
	let key: string | undefined = "fixture-private-key";
	const requests: URL[] = [];
	const client = createEiaPriceClient({
		clock: () => new Date(now),
		apiKey: () => key,
		fetch: async (input, options) => {
			const url = new URL(String(input));
			requests.push(url);
			assert.ok(options?.signal);
			return new Response(JSON.stringify(eiaRow(url.pathname.includes("RWTC") ? "RWTC" : "RNGWHHD")));
		},
		...overrides,
	});
	return {
		client,
		requests,
		time: (value: string) => {
			now = new Date(value);
		},
		key: (value: string | undefined) => {
			key = value;
		},
	};
}

test("EIA control preserves exact periods/units, selects the declared series and isolates cached data", async () => {
	const f = fixture();
	const first = await f.client.fetch();
	assert.equal(first.oilPrice, 82.5);
	assert.equal(first.gasPrice, 3.75);
	assert.equal(first.oil.observedAt, "2026-11-12");
	assert.equal(first.gas.unit, "USD/MMBtu");
	assert.equal(first.oil.retrievedAt, NOW);
	assert.equal(first.fetchedAt?.toISOString(), NOW);
	assert.equal(first.oil.source?.id, "eia.PET.RWTC.D");
	assert.ok(f.requests.some((x) => x.pathname.endsWith("/seriesid/PET.RWTC.D")));
	assert.ok(f.requests.some((x) => x.pathname.endsWith("/seriesid/NG.RNGWHHD.D")));
	assert.ok(
		f.requests.every((x) => x.searchParams.get("length") === "1" && x.searchParams.get("sort[0][column]") === "period"),
	);
	assert.ok(!JSON.stringify(first).includes("fixture-private-key"));
	first.oil.value = 999999;
	f.time("2026-11-13T12:30:00.000Z");
	const cached = await f.client.fetch();
	assert.equal(cached.oil.value, 82.5);
	assert.equal(cached.fetchedAt?.toISOString(), NOW);
	assert.equal(f.requests.length, 2);
	f.client.clearCache();
	await f.client.fetch();
	assert.equal(f.requests.length, 4);
});

test("credential removal/rotation cannot serve a previous credential's cached snapshot", async () => {
	const f = fixture();
	await f.client.fetch();
	f.key(undefined);
	const absent = await f.client.fetch();
	assert.equal(absent.oilPrice, null);
	assert.equal(absent.fetchedAt, null);
	assert.equal(f.requests.length, 2);
	f.key("second-fixture-key");
	await f.client.fetch();
	assert.equal(f.requests.length, 4);
});

test("cache expiry re-fetches, while an observation aging inside the cache window becomes stale", async () => {
	const f = fixture({ maxObservationAgeSeconds: 129601 });
	await f.client.fetch();
	f.time("2026-11-13T12:00:02.000Z");
	const old = await f.client.fetch();
	assert.equal(old.oilPrice, null);
	assert.equal(old.oil.status, "stale");
	assert.equal(old.oil.observedAt, "2026-11-12");
	assert.equal(f.requests.length, 2);
	f.time("2026-11-13T13:00:00.000Z");
	await f.client.fetch();
	assert.equal(f.requests.length, 4);
});

test("finite zero and negative observed prices survive without being replaced or clamped", async () => {
	const f = fixture({
		fetch: async (input) =>
			new Response(
				JSON.stringify(
					eiaRow(String(input).includes("RWTC") ? "RWTC" : "RNGWHHD", String(input).includes("RWTC") ? "-37.63" : "0"),
				),
			),
	});
	const result = await f.client.fetch();
	assert.equal(result.oilPrice, -37.63);
	assert.equal(result.gasPrice, 0);
});

test("wrong series/units, null/blank/nonfinite values, empty/ambiguous rows and future dates stay unavailable", async () => {
	const row = eiaRow("RWTC").response.data[0];
	const invalid = [
		{ ...row, series: "OTHER" },
		{ ...row, units: "USD/mcf" },
		{ ...row, period: "2099-01-01" },
		{ ...row, period: "2026-02-30" },
		{ ...row, value: "" },
		{ ...row, value: "   " },
		{ ...row, value: null },
		{ ...row, value: true },
		{ ...row, value: "Infinity" },
		{ ...row, value: "1e999" },
	];
	for (const candidate of invalid) {
		const f = fixture({ fetch: async () => new Response(JSON.stringify({ response: { data: [candidate] } })) });
		const result = await f.client.fetch();
		assert.equal(result.oilPrice, null);
		assert.equal(result.oil.status, "unavailable");
	}
	for (const data of [[], [row, row]]) {
		const f = fixture({ fetch: async () => new Response(JSON.stringify({ response: { data } })) });
		assert.equal((await f.client.fetch()).oilPrice, null);
	}
});

test("failed/malformed/oversized responses and revoked access during retrieval are safe failures", async () => {
	for (const response of [
		() => new Response("bad", { status: 401 }),
		() => new Response("not-json"),
		() => new Response("x".repeat(270000)),
		() => new Response(null),
	]) {
		const f = fixture({ fetch: async () => response() });
		const result = await f.client.fetch();
		assert.equal(result.oilPrice, null);
		assert.equal(result.fetchedAt, null);
	}
	let revoked = false;
	const f = fixture({
		apiKey: () => (revoked ? undefined : "fixture-key"),
		fetch: async (input) => {
			revoked = true;
			return new Response(JSON.stringify(eiaRow(String(input).includes("RWTC") ? "RWTC" : "RNGWHHD")));
		},
	});
	assert.equal((await f.client.fetch()).oilPrice, null);
});

test("host configuration and invalid clocks are rejected without inventing source time", async () => {
	for (const options of [{ maxObservationAgeSeconds: 0 }, { cacheTtlMs: -1 }, { timeoutMs: 0 }])
		assert.throws(() => createEiaPriceClient(options));
	await assert.rejects(fixture({ clock: () => new Date("invalid") }).client.fetch());
});

test("a failed credential resolver returns safe unavailability without propagating its private detail", async () => {
	const f = fixture({
		apiKey: () => {
			throw new Error("fixture-private-credential-reference");
		},
	});
	let result: Awaited<ReturnType<typeof f.client.fetch>> | undefined;
	try {
		result = await f.client.fetch();
	} catch {
		/* A credential outage must return a safe unavailable datum. */
	}
	assert.equal(result?.oilPrice, null);
	assert.equal(result?.oil.reason, "access_unavailable");
	assert.ok(!JSON.stringify(result).includes("fixture-private-credential-reference"));
});

test("an older in-flight credential request cannot overwrite or clear a newer credential's cache", async () => {
	let key = "fixture-a";
	let release = () => {};
	const pending = new Promise<void>((resolve) => {
		release = resolve;
	});
	let newerRequests = 0;
	const client = createEiaPriceClient({
		clock: () => new Date(NOW),
		apiKey: () => key,
		fetch: async (input) => {
			const url = new URL(String(input));
			const old = url.searchParams.get("api_key") === "fixture-a";
			if (old) await pending;
			else newerRequests++;
			return new Response(
				JSON.stringify(eiaRow(url.pathname.includes("RWTC") ? "RWTC" : "RNGWHHD", old ? "10" : "88")),
			);
		},
	});
	const earlier = client.fetch();
	key = "fixture-b";
	assert.equal((await client.fetch()).oilPrice, 88);
	release();
	assert.equal((await earlier).oilPrice, null);
	assert.equal((await client.fetch()).oilPrice, 88);
	assert.equal(newerRequests, 2, "the older request cannot invalidate the newer cache");
});

test("clearing a cache invalidates in-flight work even when the credential stays the same", async () => {
	let release = () => {};
	const pending = new Promise<void>((resolve) => {
		release = resolve;
	});
	let requests = 0;
	const client = createEiaPriceClient({
		clock: () => new Date(NOW),
		apiKey: () => "fixture-key",
		fetch: async (input) => {
			const old = ++requests <= 2;
			if (old) await pending;
			return new Response(
				JSON.stringify(eiaRow(String(input).includes("RWTC") ? "RWTC" : "RNGWHHD", old ? "10" : "88")),
			);
		},
	});
	const earlier = client.fetch();
	client.clearCache();
	assert.equal((await client.fetch()).oilPrice, 88);
	release();
	assert.equal((await earlier).oilPrice, null);
	assert.equal((await client.fetch()).oilPrice, 88);
	assert.equal(requests, 4);
});
