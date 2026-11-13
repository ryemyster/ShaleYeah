import { createHash } from "node:crypto";
import {
	assessRecord,
	type MarketDatum,
	MarketEvidenceError,
	type MarketRecord,
	marketNow,
	sourceAgePolicy,
	unavailableDatum,
} from "./evidence.js";

const series = {
	oil: {
		id: "PET.RWTC.D",
		short: "RWTC",
		name: "WTI",
		unit: "USD/bbl",
		units: ["$/bbl", "dollars per barrel"],
		uri: "https://www.eia.gov/dnav/pet/hist/rwtcd.htm",
	},
	gas: {
		id: "NG.RNGWHHD.D",
		short: "RNGWHHD",
		name: "HenryHub",
		unit: "USD/MMBtu",
		units: ["$/mmbtu", "dollars per million btu"],
		uri: "https://www.eia.gov/dnav/ng/hist/rngwhhdD.htm",
	},
} as const;
export interface EiaPrices {
	oilPrice: number | null;
	gasPrice: number | null;
	oil: MarketDatum;
	gas: MarketDatum;
	dataSource: "eia" | "partial" | "unavailable";
	fetchedAt: Date | null;
	attemptedAt: Date;
}
export interface EiaPriceOptions {
	apiKey?: () => string | undefined;
	fetch?: typeof fetch;
	clock?: () => Date;
	maxObservationAgeSeconds?: number;
	cacheTtlMs?: number;
	timeoutMs?: number;
}
async function readResponse(response: Response): Promise<unknown> {
	const reader = response.body?.getReader();
	if (!reader) throw new MarketEvidenceError("invalid_source");
	const chunks: Uint8Array[] = [];
	let length = 0;
	try {
		while (true) {
			const next = await reader.read();
			if (next.done) break;
			length += next.value.byteLength;
			if (length > 262144) {
				await reader.cancel();
				throw new MarketEvidenceError("invalid_source");
			}
			chunks.push(next.value);
		}
	} finally {
		reader.releaseLock();
	}
	return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)));
}
/** Per-host cache. Retrieval time never substitutes for the source's daily observation period. */
export function createEiaPriceClient(options: EiaPriceOptions = {}) {
	const maxAge = sourceAgePolicy(options.maxObservationAgeSeconds);
	const ttl = options.cacheTtlMs ?? 3600000,
		timeout = options.timeoutMs ?? 10000;
	if (
		!Number.isSafeInteger(ttl) ||
		ttl < 1 ||
		ttl > 86400000 ||
		!Number.isSafeInteger(timeout) ||
		timeout < 1 ||
		timeout > 30000
	)
		throw new MarketEvidenceError("invalid_configuration");
	const clock = () => marketNow(options.clock);
	const key = options.apiKey ?? (() => process.env.EIA_API_KEY);
	const credentialState = () => {
		try {
			const credential = key();
			if (credential === undefined || credential === "")
				return { credential: undefined, reason: "access_not_configured" };
			if (typeof credential !== "string" || credential.length > 65536)
				return { credential: undefined, reason: "access_unavailable" };
			return { credential, reason: "" };
		} catch {
			return { credential: undefined, reason: "access_unavailable" };
		}
	};
	const fetcher: typeof fetch = options.fetch ?? ((input, init) => globalThis.fetch(input, init));
	const cache = new Map<"oil" | "gas", MarketRecord>();
	let keyHash = "";
	const fingerprint = (value: string | undefined) => (value ? createHash("sha256").update(value).digest("hex") : "");
	const clearCache = () => {
		cache.clear();
		keyHash = "";
	};
	async function fetchQuote(kind: "oil" | "gas", credential: string): Promise<MarketRecord | MarketDatum> {
		const spec = series[kind],
			cached = cache.get(kind),
			now = clock();
		if (
			cached &&
			now.getTime() >= Date.parse(cached.retrievedAt) &&
			now.getTime() - Date.parse(cached.retrievedAt) < ttl
		)
			return structuredClone(cached);
		try {
			const url = new URL(`https://api.eia.gov/v2/seriesid/${spec.id}`);
			for (const [name, value] of Object.entries({
				api_key: credential,
				frequency: "daily",
				"data[0]": "value",
				"sort[0][column]": "period",
				"sort[0][direction]": "desc",
				length: "1",
			}))
				url.searchParams.set(name, value);
			const response = await fetcher(url, { signal: AbortSignal.timeout(timeout), redirect: "error" });
			if (!response.ok)
				throw new MarketEvidenceError(
					response.status === 401 || response.status === 403 ? "access_denied" : "retrieval_failed",
				);
			const json = (await readResponse(response)) as {
				response?: { data?: Array<{ series?: unknown; value?: unknown; period?: unknown; units?: unknown }> };
			};
			const rows = json?.response?.data;
			if (!Array.isArray(rows) || rows.length !== 1) throw new MarketEvidenceError("invalid_source");
			const row = rows[0];
			if (
				!row ||
				![spec.short, spec.id].includes(row.series as never) ||
				typeof row.value !== "string" ||
				!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(row.value) ||
				!Number.isFinite(Number(row.value)) ||
				typeof row.units !== "string" ||
				!spec.units.some((unit) => unit === (row.units as string).trim().toLowerCase()) ||
				typeof row.period !== "string" ||
				!/^\d{4}-\d{2}-\d{2}$/.test(row.period)
			)
				throw new MarketEvidenceError("invalid_source");
			const record: MarketRecord = {
				id: `eia.${spec.id}`,
				subject: { kind: "commodity", name: spec.name },
				metric: "price",
				value: Number(row.value),
				unit: spec.unit,
				basis: "observed",
				observedAt: row.period,
				retrievedAt: clock().toISOString(),
				source: { id: `eia.${spec.id}`, uri: spec.uri, reportedUnit: row.units },
				review: null,
			};
			const assessed = assessRecord(record, clock(), maxAge);
			if (assessed.status === "unavailable") throw new MarketEvidenceError("invalid_source");
			// A rotated/cleared cache belongs to a newer request, even if this response arrived later.
			const active = fingerprint(credentialState().credential),
				request = fingerprint(credential);
			if (active !== request || keyHash !== request) throw new MarketEvidenceError("access_changed");
			cache.set(kind, structuredClone(record));
			return record;
		} catch (error) {
			return unavailableDatum(spec.unit, error instanceof MarketEvidenceError ? error.code : "retrieval_failed");
		}
	}
	async function fetchPrices(): Promise<EiaPrices> {
		const attemptedAt = clock(),
			access = credentialState(),
			credential = access.credential;
		const hash = fingerprint(credential);
		if (hash !== keyHash) {
			cache.clear();
			keyHash = hash;
		}
		let oil: MarketDatum, gas: MarketDatum;
		if (!credential) {
			clearCache();
			oil = unavailableDatum("USD/bbl", access.reason);
			gas = unavailableDatum("USD/MMBtu", access.reason);
		} else {
			const rows = await Promise.all([fetchQuote("oil", credential), fetchQuote("gas", credential)]);
			if (fingerprint(credentialState().credential) !== hash) {
				if (keyHash === hash) clearCache();
				oil = unavailableDatum("USD/bbl", "access_changed");
				gas = unavailableDatum("USD/MMBtu", "access_changed");
			} else {
				const assess = (row: MarketRecord | MarketDatum) =>
					"status" in row ? row : assessRecord(row, clock(), maxAge);
				oil = assess(rows[0]);
				gas = assess(rows[1]);
			}
		}
		const oilPrice = oil.status === "observed" ? oil.value : null,
			gasPrice = gas.status === "observed" ? gas.value : null;
		const available = Number(oilPrice !== null) + Number(gasPrice !== null);
		const retrieved = [oil.retrievedAt, gas.retrievedAt]
			.filter((value): value is string => value !== null)
			.map(Date.parse);
		return {
			oilPrice,
			gasPrice,
			oil,
			gas,
			dataSource: available === 2 ? "eia" : available === 1 ? "partial" : "unavailable",
			fetchedAt: retrieved.length ? new Date(Math.max(...retrieved)) : null,
			attemptedAt,
		};
	}
	return { fetch: fetchPrices, clearCache };
}
const defaultClient = createEiaPriceClient();
export const fetchEiaPrices = defaultClient.fetch;
export const clearEiaCache = defaultClient.clearCache;
