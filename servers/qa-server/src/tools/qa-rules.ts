import { createHash } from "node:crypto";
import { reviewJson } from "@shaleyeah/sdk";
import { z } from "zod";
import { decodeQAData, type QARow as Row } from "./qa-data.js";

export { normalizedQADataSchema } from "./qa-data.js";

const id = z
	.string()
	.min(1)
	.max(128)
	.regex(/^[a-zA-Z0-9._:-]+$/);
const field = id.refine((value) => !["__proto__", "constructor", "prototype"].includes(value));
const scopeSchema = z.object({ customerId: id, assetId: id, taskId: id, employeeId: id }).strict();
export type QAScope = z.infer<typeof scopeSchema>;
export interface QASnapshot {
	scope: QAScope;
	evidence: {
		id: string;
		revision: string;
		uri: string;
		hash: { algorithm: string; value: string };
		asOf: string;
		accessClassification: string;
		usagePolicy: { id: string; version: string };
	};
	bytes: Uint8Array;
	projection?: unknown;
	retentionExpiresAt?: string;
}
const common = {
	id,
	revision: id,
	version: z.literal("1").default("1"),
	sourceId: id,
	severity: z.enum(["critical", "major", "minor"]),
	repairOwner: id,
	applicable: z.boolean(),
};
const rules = z.discriminatedUnion("type", [
	z.object({ ...common, type: z.literal("completeness"), field }).strict(),
	z
		.object({
			...common,
			type: z.literal("correctness"),
			field,
			referenceSourceId: id,
			tolerance: z.number().finite().nonnegative().max(1e12),
		})
		.strict(),
	z.object({ ...common, type: z.literal("units"), field, expectedUnit: z.string().min(1).max(128) }).strict(),
	z.object({ ...common, type: z.literal("identity"), expectedAssetId: id, expectedWellId: id }).strict(),
	z
		.object({
			...common,
			type: z.literal("duplication"),
			keys: z
				.array(z.enum(["wellId", "period", "id"]))
				.min(1)
				.max(3),
		})
		.strict(),
	z
		.object({ ...common, type: z.literal("freshness"), maxAgeSeconds: z.number().int().positive().max(315360000) })
		.strict(),
	z.object({ ...common, type: z.literal("provenance") }).strict(),
	z
		.object({
			...common,
			type: z.literal("contradiction"),
			field,
			referenceSourceId: id,
			tolerance: z.number().finite().nonnegative().max(1e12),
		})
		.strict(),
]);
export const qaProfileSchema = z
	.object({ schemaVersion: z.literal("0.1.0"), id, revision: id, rules: z.array(rules).max(256) })
	.strict()
	.superRefine((profile, context) => {
		if (new Set(profile.rules.map((rule) => rule.id)).size !== profile.rules.length)
			context.addIssue({ code: "custom", message: "Duplicate rule identity" });
	});
export type QAProfile = z.infer<typeof qaProfileSchema>;
export type QAStatus = "PASS" | "FAIL" | "UNTESTED" | "ERROR" | "NOT_APPLICABLE";
export interface QADefect {
	location: string;
	reason: string;
	observed?: unknown;
	expected?: unknown;
}
export interface QARuleResult {
	rule: { id: string; revision: string; version: string };
	profile: { id: string; revision: string; sha256: string };
	type: QAProfile["rules"][number]["type"];
	status: QAStatus;
	reason: string;
	severity: string;
	repairOwner: string;
	evidence: QASnapshot["evidence"][];
	defects: QADefect[];
	omittedDefects: number;
	inspectedRows: number;
	assessmentComplete: boolean;
	rowCounts: { total: number; evaluated: number; passed: number; failed: number; untested: number };
}
interface Decoded {
	snapshot: QASnapshot;
	rows?: Row[];
	error?: string;
	actualHash: string;
	identities?: Map<string, Row[]>;
	locations?: Record<string, string>;
}
const hash = (input: string | Uint8Array) => createHash("sha256").update(input).digest("hex");
const same = (left: unknown, right: unknown) => reviewJson(left) === reviewJson(right);

/** Evaluate data-only approved rules on host-supplied snapshots. This pure function grants no access. */
export function evaluateQARules(input: {
	scope: unknown;
	profile: unknown;
	snapshots: QASnapshot[];
	evaluatedAt: string;
}) {
	const scope = scopeSchema.parse(input.scope),
		profile = qaProfileSchema.parse(input.profile);
	const now = Date.parse(input.evaluatedAt);
	if (!Number.isFinite(now) || !Array.isArray(input.snapshots) || input.snapshots.length > 64)
		throw new Error("invalid_qa_input");
	const sources = new Map<string, Decoded>();
	for (const snapshot of input.snapshots) {
		if (!same(scopeSchema.parse(snapshot.scope), scope)) throw new Error("access_denied");
		id.parse(snapshot.evidence.id);
		if (
			sources.has(snapshot.evidence.id) ||
			!(snapshot.bytes instanceof Uint8Array) ||
			snapshot.bytes.byteLength > 8_000_000
		)
			throw new Error("invalid_source");
		const actualHash = hash(snapshot.bytes),
			decoded: Decoded = { snapshot, actualHash };
		if (snapshot.evidence.hash.algorithm !== "sha256" || actualHash !== snapshot.evidence.hash.value)
			decoded.error = "content_hash_mismatch";
		else {
			try {
				const data = decodeQAData(snapshot.bytes, scope, snapshot.projection);
				decoded.rows = data.rows;
				decoded.locations = data.locations;
				decoded.identities = new Map();
				for (const row of decoded.rows) {
					if (!row.assetId || !row.wellId || !row.period) continue;
					const key = reviewJson([row.assetId, row.wellId, row.period]);
					const previous = decoded.identities.get(key) ?? [];
					previous.push(row);
					decoded.identities.set(key, previous);
				}
			} catch {
				decoded.error = "unsupported_or_malformed_source";
			}
		}
		sources.set(snapshot.evidence.id, decoded);
	}
	const profileRef = { id: profile.id, revision: profile.revision, sha256: hash(reviewJson(profile)) };
	const results: QARuleResult[] = profile.rules.map((rule) => {
		const source = sources.get(rule.sourceId);
		const result: QARuleResult = {
			rule: { id: rule.id, revision: rule.revision, version: rule.version },
			profile: profileRef,
			type: rule.type,
			status: "UNTESTED",
			reason: "source_unavailable",
			severity: rule.severity,
			repairOwner: rule.repairOwner,
			evidence: source ? [source.snapshot.evidence] : [],
			defects: [],
			omittedDefects: 0,
			inspectedRows: 0,
			assessmentComplete: false,
			rowCounts: { total: 0, evaluated: 0, passed: 0, failed: 0, untested: 0 },
		};
		if (!rule.applicable) return { ...result, status: "NOT_APPLICABLE", reason: "excluded_by_approved_profile" };
		if (!source) return result;
		if (source.error) {
			const provenance = rule.type === "provenance" && source.error === "content_hash_mismatch";
			return {
				...result,
				status: provenance ? "FAIL" : "ERROR",
				assessmentComplete: provenance,
				reason: source.error,
				defects: provenance
					? [
							{
								location: "/evidence/hash",
								reason: source.error,
								observed: source.actualHash,
								expected: source.snapshot.evidence.hash.value,
							},
						]
					: [],
			};
		}
		const rows = source.rows!;
		if (!rows.length) return { ...result, reason: "no_observations" };
		result.inspectedRows = rows.length;
		const untestedRows = new Set<number>(),
			failedRows = new Set<number>();
		const record = (index: number, reason: string, observed?: unknown, expected?: unknown, suffix = "") => {
			if (result.defects.length >= 100) {
				result.omittedDefects++;
				return;
			}
			result.defects.push({
				location: source.locations?.[`/rows/${index}${suffix}`] ?? `/rows/${index}${suffix}`,
				reason,
				...(observed === undefined ? {} : { observed }),
				...(expected === undefined ? {} : { expected }),
			});
		};
		const defect = (index: number, reason: string, observed?: unknown, expected?: unknown, suffix = "") => {
			failedRows.add(index);
			record(index, reason, observed, expected, suffix);
		};
		const missing = (index: number, reason: string, observed?: unknown, expected?: unknown) => {
			untestedRows.add(index);
			record(index, reason, observed, expected);
		};
		if (rule.type === "provenance") {
			if (
				!source.snapshot.evidence.uri ||
				!source.snapshot.evidence.revision ||
				!source.snapshot.evidence.usagePolicy?.id ||
				!source.snapshot.evidence.usagePolicy.version ||
				!Number.isFinite(Date.parse(source.snapshot.evidence.asOf))
			)
				defect(0, "incomplete_provenance", undefined, "URI, revision, usage policy and observation time");
		} else if (rule.type === "duplication") {
			const seen = new Set<string>();
			rows.forEach((row, index) => {
				const values = rule.keys.map((key) => row[key]);
				if (values.some((v) => v === undefined)) {
					missing(index, "duplicate_key_missing");
					return;
				}
				const key = reviewJson(values);
				if (seen.has(key)) defect(index, "duplicate_composite_key", values, "unique composite key");
				seen.add(key);
			});
		} else if (rule.type === "identity") {
			rows.forEach((row, index) => {
				if (row.assetId !== rule.expectedAssetId)
					defect(index, "asset_identity_mismatch", row.assetId, rule.expectedAssetId, "/assetId");
				if (row.wellId !== rule.expectedWellId)
					defect(index, "well_identity_mismatch", row.wellId, rule.expectedWellId, "/wellId");
			});
		} else if (rule.type === "freshness") {
			rows.forEach((row, index) => {
				const asOf = row.asOf === undefined ? NaN : Date.parse(row.asOf);
				if (!Number.isFinite(asOf) || asOf > now || now - asOf > rule.maxAgeSeconds * 1000)
					defect(
						index,
						"missing_future_or_stale_observation",
						row.asOf,
						{ evaluatedAt: input.evaluatedAt, maxAgeSeconds: rule.maxAgeSeconds },
						"/asOf",
					);
			});
		} else if (rule.type === "completeness" || rule.type === "units") {
			rows.forEach((row, index) => {
				const fact = Object.hasOwn(row.fields, rule.field) ? row.fields[rule.field] : undefined;
				if (
					rule.type === "completeness" &&
					(!fact || fact.value === undefined || fact.value === null || fact.basis === "unknown")
				)
					defect(
						index,
						"required_observation_missing",
						fact?.value,
						"non-null explicit observation",
						`/fields/${rule.field}/value`,
					);
				if (rule.type === "units" && fact?.unit !== rule.expectedUnit)
					defect(index, "unit_mismatch", fact?.unit, rule.expectedUnit, `/fields/${rule.field}/unit`);
			});
		} else {
			const reference = sources.get(rule.referenceSourceId);
			if (!reference || reference.error || !reference.rows?.length)
				return { ...result, reason: "reference_unavailable" };
			result.evidence.push(reference.snapshot.evidence);
			rows.forEach((row, index) => {
				if (!row.assetId || !row.wellId || !row.period) {
					missing(index, "comparison_identity_missing");
					return;
				}
				const counterparts = reference.identities!.get(reviewJson([row.assetId, row.wellId, row.period])) ?? [];
				if (counterparts.length !== 1) {
					missing(index, "reference_identity_missing_or_ambiguous");
					return;
				}
				const actual = Object.hasOwn(row.fields, rule.field) ? row.fields[rule.field] : undefined;
				const expected = Object.hasOwn(counterparts[0].fields, rule.field)
					? counterparts[0].fields[rule.field]
					: undefined;
				if (
					!actual ||
					!expected ||
					actual.value === undefined ||
					expected.value === undefined ||
					actual.value === null ||
					expected.value === null ||
					actual.basis === "unknown" ||
					expected.basis === "unknown"
				) {
					missing(index, "comparison_observation_missing");
					return;
				}
				if (actual.basis !== expected.basis) {
					missing(index, "comparison_basis_requires_review", actual.basis, expected.basis);
					return;
				}
				if (!actual.unit || !expected.unit || actual.unit !== expected.unit) {
					defect(index, "comparison_unit_mismatch", actual.unit, expected.unit);
					return;
				}
				const matches =
					typeof actual.value === "number" && typeof expected.value === "number"
						? Math.abs(actual.value - expected.value) <= rule.tolerance
						: same(actual.value, expected.value);
				if (!matches)
					defect(
						index,
						rule.type === "contradiction" ? "cross_role_contradiction" : "reference_value_mismatch",
						actual.value,
						expected.value,
						`/fields/${rule.field}/value`,
					);
			});
		}
		for (const index of failedRows) untestedRows.delete(index);
		const evaluated = rows.length - untestedRows.size;
		result.rowCounts = {
			total: rows.length,
			evaluated,
			passed: evaluated - failedRows.size,
			failed: failedRows.size,
			untested: untestedRows.size,
		};
		result.assessmentComplete = untestedRows.size === 0;
		result.status = failedRows.size ? "FAIL" : untestedRows.size ? "UNTESTED" : "PASS";
		result.reason = failedRows.size
			? "observed_defects"
			: untestedRows.size
				? "required_comparison_or_key_missing"
				: "all_applicable_assertions_held";
		return result;
	});
	const count = (status: QAStatus) => results.filter((result) => result.status === status).length;
	const counts = {
		total: results.length,
		applicable: results.length - count("NOT_APPLICABLE"),
		evaluated: count("PASS") + count("FAIL"),
		passed: count("PASS"),
		failed: count("FAIL"),
		untested: count("UNTESTED"),
		errors: count("ERROR"),
		notApplicable: count("NOT_APPLICABLE"),
	};
	const status: QAStatus = counts.failed
		? "FAIL"
		: counts.errors
			? "ERROR"
			: counts.untested || !counts.total
				? "UNTESTED"
				: !counts.applicable
					? "NOT_APPLICABLE"
					: "PASS";
	return {
		schemaVersion: "0.1.0",
		kind: "qa-rule-results",
		scope,
		profile: profileRef,
		evaluatedAt: input.evaluatedAt,
		status,
		results,
		counts,
		passRate: counts.evaluated ? counts.passed / counts.evaluated : null,
		coverage: counts.applicable
			? results.filter((result) => result.assessmentComplete).length / counts.applicable
			: null,
		disclosures: ["Observed configured data checks; no professional or regulatory certification"],
	};
}
