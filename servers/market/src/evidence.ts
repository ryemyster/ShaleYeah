import { createHash } from "node:crypto";
import { readPrivateJson, reviewJson } from "@shaleyeah/sdk";
import { z } from "zod";

export const DEFAULT_SOURCE_AGE_SECONDS = 7 * 24 * 60 * 60;
const id = z
	.string()
	.min(1)
	.max(128)
	.regex(/^[A-Za-z0-9_.:/-]+$/);
const label = z.string().trim().min(1).max(256);
export const unitSchema = z.enum(["USD/bbl", "USD/MMBtu", "fraction", "boe/day", "USD/boe"]);
export type MarketUnit = z.infer<typeof unitSchema>;
export const metricUnits = { market_share: "fraction", production: "boe/day", costs: "USD/boe" } as const;
export type CompetitorMetric = keyof typeof metricUnits;
const sourceSchema = z
	.object({
		id,
		uri: z
			.string()
			.min(1)
			.max(2048)
			.refine((value) => {
				if (/^urn:[A-Za-z0-9_.:/-]+$/.test(value)) return true;
				try {
					const url = new URL(value);
					return (
						["https:", "http:"].includes(url.protocol) && !url.username && !url.password && !url.search && !url.hash
					);
				} catch {
					return false;
				}
			}),
		reportedUnit: z.string().min(1).max(128).optional(),
	})
	.strict();
const reviewSchema = z
	.object({ reviewerId: id, reviewedAt: z.iso.datetime(), reason: z.string().trim().min(1).max(2048) })
	.strict();
export const marketRecordSchema = z
	.object({
		id,
		subject: z.union([
			z.object({ kind: z.literal("commodity"), name: z.enum(["WTI", "HenryHub"]) }).strict(),
			z.object({ kind: z.literal("competitor"), name: label, market: label }).strict(),
		]),
		metric: z.enum(["price", "market_share", "production", "costs"]),
		value: z.number().finite(),
		unit: unitSchema,
		basis: z.enum(["observed", "assumed"]),
		observedAt: z.union([z.iso.date(), z.iso.datetime()]).nullable(),
		retrievedAt: z.iso.datetime(),
		source: sourceSchema.nullable(),
		review: reviewSchema.nullable(),
	})
	.strict()
	.superRefine((record, context) => {
		const validMetric =
			record.subject.kind === "commodity"
				? record.metric === "price" && record.unit === (record.subject.name === "WTI" ? "USD/bbl" : "USD/MMBtu")
				: record.metric !== "price" && record.unit === metricUnits[record.metric];
		const validBasis =
			record.basis === "observed"
				? record.observedAt !== null && record.source !== null && record.review === null
				: record.observedAt === null && record.source === null && record.review !== null;
		if (
			!validMetric ||
			!validBasis ||
			(record.metric !== "price" && record.value < 0) ||
			(record.metric === "market_share" && record.value > 1)
		) {
			context.addIssue({ code: "custom", message: "Source metric, units or basis are inconsistent" });
		}
	});
export type MarketRecord = z.infer<typeof marketRecordSchema>;
export interface MarketDatum {
	id: string | null;
	subject: MarketRecord["subject"] | null;
	metric: MarketRecord["metric"] | null;
	value: number | null;
	unit: MarketUnit;
	basis: "observed" | "assumed" | "unavailable";
	observedAt: string | null;
	retrievedAt: string | null;
	source: MarketRecord["source"];
	review: MarketRecord["review"];
	status: "observed" | "assumed" | "stale" | "unavailable";
	reason: string | null;
}
export class MarketEvidenceError extends Error {
	constructor(public readonly code: string) {
		super(`Market analysis unavailable: ${code}`);
	}
}
export function marketNow(clock: () => Date = () => new Date()) {
	const now = clock();
	if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new MarketEvidenceError("invalid_clock");
	return now;
}
export function sourceAgePolicy(seconds = DEFAULT_SOURCE_AGE_SECONDS) {
	if (!Number.isSafeInteger(seconds) || seconds < 1 || seconds > 31536000)
		throw new MarketEvidenceError("invalid_freshness_policy");
	return seconds;
}
export function unavailableDatum(unit: MarketUnit, reason: string): MarketDatum {
	return {
		id: null,
		subject: null,
		metric: null,
		value: null,
		unit,
		basis: "unavailable",
		observedAt: null,
		retrievedAt: null,
		source: null,
		review: null,
		status: "unavailable",
		reason,
	};
}
export function assessRecord(value: unknown, now: Date, maxAgeSeconds = DEFAULT_SOURCE_AGE_SECONDS): MarketDatum {
	const record = marketRecordSchema.parse(value);
	sourceAgePolicy(maxAgeSeconds);
	marketNow(() => now);
	const date = record.observedAt ?? record.review!.reviewedAt;
	const observed = Date.parse(date),
		retrieved = Date.parse(record.retrievedAt),
		current = now.getTime();
	let status: MarketDatum["status"] = record.basis;
	let reason: string | null = null;
	if (observed > current || retrieved > current || (record.basis === "observed" && retrieved < observed)) {
		status = "unavailable";
		reason = "invalid_source_time";
	} else if (current - observed > maxAgeSeconds * 1000) {
		status = "stale";
		reason = record.basis === "observed" ? "observation_stale" : "assumption_review_stale";
	}
	return { ...structuredClone(record), status, reason };
}
export function marketTextSafe(text: string) {
	return (
		!/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text) &&
		[process.env.EIA_API_KEY, process.env.ANTHROPIC_API_KEY].every((secret) => !secret || !text.includes(secret))
	);
}

const bundleSchema = z
	.object({
		version: z.literal("0.1.0"),
		rights: z.enum(["operator-attested-permitted", "denied"]),
		records: z.array(marketRecordSchema).max(512),
	})
	.strict();
export interface MarketSnapshot {
	status: "available" | "source_missing" | "source_use_denied" | "source_invalid" | "source_unavailable";
	records: MarketRecord[];
	digest: string;
}
/** Host source/rights assertions, not an automated factual or professional certification. */
export async function readMarketSnapshot(read: () => Promise<unknown>): Promise<MarketSnapshot> {
	let value: unknown;
	try {
		value = await read();
	} catch {
		return { status: "source_unavailable", records: [], digest: "unavailable" };
	}
	if (value === undefined || value === null) return { status: "source_missing", records: [], digest: "missing" };
	try {
		const text = reviewJson(value);
		if (Buffer.byteLength(text) > 1_000_000 || !marketTextSafe(text)) throw new MarketEvidenceError("unsafe_source");
		const parsed = bundleSchema.parse(value);
		if (parsed.rights === "denied") return { status: "source_use_denied", records: [], digest: "denied" };
		if (new Set(parsed.records.map((record) => record.id)).size !== parsed.records.length)
			throw new MarketEvidenceError("ambiguous_source");
		return {
			status: "available",
			records: parsed.records,
			digest: createHash("sha256").update(reviewJson(parsed)).digest("hex"),
		};
	} catch {
		return { status: "source_invalid", records: [], digest: "invalid" };
	}
}
export async function readMarketSourceFile(file: string | undefined) {
	return file ? readPrivateJson(file, 1_000_000) : undefined;
}
