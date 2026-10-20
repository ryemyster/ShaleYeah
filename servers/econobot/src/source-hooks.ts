import { type InstalledSourceAdapter, SourceAccessError } from "@shaleyeah/connectors";
import { z } from "zod";
import { EconomicScenarioError } from "./scenario-service.js";

const profileSchema = z
	.object({
		version: z.literal("0.1.0"),
		route: z.literal("petroleum/pri/spt"),
		series: z.enum(["RWTC", "RBRTE"]),
		frequency: z.enum(["daily", "monthly", "annual"]),
		unitsField: z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,63}$/),
		expectedUnit: z.enum(["Dollars per Barrel", "$/BBL", "$/bbl"]),
		maxObservationAgeDays: z.number().int().min(1).max(36500),
	})
	.strict();
const responseSchema = z.object({
	response: z.object({
		total: z.union([
			z.number().int().min(1).max(1000),
			z
				.string()
				.regex(/^\d{1,4}$/)
				.transform(Number)
				.pipe(z.number().min(1).max(1000)),
		]),
		frequency: z.enum(["daily", "monthly", "annual"]),
		data: z.array(z.record(z.string(), z.unknown())).min(1).max(1000),
	}),
});
function invalid(): never {
	throw new EconomicScenarioError("invalid_price_snapshot");
}

/** Map a host-supplied APIv2 snapshot. No network, missing-value substitution or forecast construction. */
export function normalizeEiaPriceSnapshot(payload: unknown, configuration: unknown, now: Date): string {
	try {
		const profile = profileSchema.parse(configuration);
		if (Buffer.byteLength(JSON.stringify(payload)) > 1_000_000 || !Number.isFinite(now.getTime())) invalid();
		const { response } = responseSchema.parse(payload);
		if (response.frequency !== profile.frequency || response.total !== response.data.length) invalid();
		const rows = response.data
			.map((row) => {
				if (
					row.series !== profile.series ||
					row[profile.unitsField] !== profile.expectedUnit ||
					typeof row.value !== "string" ||
					row.value.length > 128 ||
					!/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?$/.test(row.value) ||
					!Number.isFinite(Number(row.value)) ||
					typeof row.period !== "string"
				)
					invalid();
				const period = row.period;
				const date =
					profile.frequency === "monthly"
						? /^\d{4}-\d{2}$/.test(period)
							? `${period}-01`
							: invalid()
						: profile.frequency === "annual"
							? /^\d{4}$/.test(period)
								? `${period}-01-01`
								: invalid()
							: period;
				z.iso.date().parse(date);
				const age = now.getTime() - Date.parse(date);
				if (age < 0 || age > profile.maxObservationAgeDays * 86400000)
					throw new EconomicScenarioError("stale_price_snapshot");
				return { period, value: Number(row.value) };
			})
			.sort((left, right) => left.period.localeCompare(right.period));
		if (new Set(rows.map((row) => row.period)).size !== rows.length) invalid();
		// The API echoes request parameters, including keys. Return only selected observation fields.
		return `period,series,value,unit,frequency\n${rows.map((row) => `${row.period},${profile.series},${row.value},${profile.expectedUnit},${profile.frequency}`).join("\n")}\n`;
	} catch (error) {
		if (error instanceof EconomicScenarioError) throw error;
		return invalid();
	}
}

export interface EiaSnapshotHook {
	profile: unknown;
	/** Host owns endpoint selection, access credentials, source rights and any live retrieval. */
	readSnapshot: (request: {
		locator: string;
		credential?: string;
		signal: AbortSignal;
	}) => Promise<{ payload: unknown; revision: string; asOf: string }>;
	clock?: () => Date;
}
/** Optional installed connector hook. The default CLI uses operator-file exports, with no live API claim. */
export function createEiaSnapshotAdapter(options: EiaSnapshotHook): InstalledSourceAdapter {
	const profile = profileSchema.parse(options.profile);
	if (typeof options.readSnapshot !== "function") throw new EconomicScenarioError("configuration");
	return {
		id: "eia-price-snapshot",
		version: "0.1.0",
		sourceKinds: ["public-download", "internal-api"],
		async fetch(source, context) {
			try {
				if (context.signal.aborted) throw new SourceAccessError("source_unavailable");
				const snapshot = await options.readSnapshot({
					locator: source.locator,
					credential: context.credential,
					signal: context.signal,
				});
				if (context.signal.aborted) throw new SourceAccessError("source_unavailable");
				if (snapshot.revision !== source.evidence.revision || snapshot.asOf !== source.evidence.asOf)
					throw new SourceAccessError("revision_mismatch");
				const bytes = Buffer.from(
					normalizeEiaPriceSnapshot(snapshot.payload, profile, options.clock?.() ?? new Date()),
				);
				if (bytes.byteLength > context.maxBytes) throw new SourceAccessError("source_unavailable");
				return { bytes, revision: snapshot.revision, asOf: snapshot.asOf, revisionOrigin: "operator-declared" };
			} catch (error) {
				if (error instanceof SourceAccessError) throw error;
				throw new SourceAccessError(
					error instanceof EconomicScenarioError
						? error.code === "stale_price_snapshot"
							? "stale_evidence"
							: "conflicting_evidence"
						: "source_unavailable",
				);
			}
		},
	};
}
