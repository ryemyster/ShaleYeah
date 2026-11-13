import { validateContract } from "@shaleyeah/contracts";
import { z } from "zod";

const id = z
	.string()
	.min(1)
	.max(128)
	.regex(/^[a-zA-Z0-9._:-]+$/);
const field = id.refine((value) => !["__proto__", "constructor", "prototype"].includes(value));
const value = z.union([z.number().finite(), z.string().max(4096), z.boolean(), z.null()]);
const rowSchema = z
	.object({
		id,
		assetId: id.optional(),
		wellId: id.optional(),
		period: z.string().min(1).max(128).optional(),
		asOf: z.string().max(128).optional(),
		fields: z.record(
			field,
			z
				.object({
					value: value.optional(),
					unit: z.string().max(128).optional(),
					basis: z.enum(["measured", "assumed", "unknown"]),
					evidenceIds: z.array(id).max(256).optional(),
					assumptionIds: z.array(id).max(256).optional(),
					location: z.string().max(1024).optional(),
				})
				.strict(),
		),
	})
	.strict();
export const normalizedQADataSchema = z
	.object({
		schemaVersion: z.literal("0.1.0"),
		kind: z.literal("normalized-qa-data"),
		rows: z.array(rowSchema).max(10000),
	})
	.strict();
export type QARow = z.infer<typeof rowSchema>;

export const qaProjectionSchema = z
	.object({ wellIdFinding: field.optional(), periodFinding: field.optional() })
	.strict();
/** Project declared business records without inferring well identifiers, time periods or professional truth. */
export function decodeQAData(
	bytes: Uint8Array,
	recipient: { customerId: string; assetId: string },
	projectionInput: unknown = {},
) {
	const projection = qaProjectionSchema.parse(projectionInput);
	const raw = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
	if (raw?.kind === "normalized-qa-data")
		return { ...normalizedQADataSchema.parse(raw), locations: {} as Record<string, string> };
	const work = validateContract(raw);
	if (work.kind !== "work-product") throw new Error("unsupported_qa_source");
	if (work.scope.customerId !== recipient.customerId || work.scope.assetId !== recipient.assetId)
		throw new Error("access_denied");
	const key = (findingId?: string) => {
		const finding = work.findings.find((item) => item.id === findingId);
		return finding?.basis === "measured" && typeof finding.value === "string" ? finding.value : undefined;
	};
	const fields = Object.fromEntries(
		work.findings.map((finding, index) => [
			finding.id,
			{
				value: finding.value,
				unit: finding.unit,
				basis: finding.basis,
				evidenceIds: finding.evidenceIds,
				assumptionIds: finding.assumptionIds,
				location: `/findings/${index}/value`,
			},
		]),
	);
	const dates = work.evidence.map((item) => item.asOf).sort((left, right) => Date.parse(left) - Date.parse(right));
	const normalized = normalizedQADataSchema.parse({
		schemaVersion: "0.1.0",
		kind: "normalized-qa-data",
		rows: [
			{
				id: work.artifact.id,
				assetId: work.scope.assetId,
				...(key(projection.wellIdFinding) === undefined ? {} : { wellId: key(projection.wellIdFinding) }),
				...(key(projection.periodFinding) === undefined ? {} : { period: key(projection.periodFinding) }),
				...(dates.length ? { asOf: dates[0] } : {}),
				fields,
			},
		],
	});
	const findingLocation = (findingId?: string) => {
		const index = work.findings.findIndex((finding) => finding.id === findingId);
		return index < 0 ? "/findings" : `/findings/${index}/value`;
	};
	return {
		...normalized,
		locations: Object.fromEntries([
			["/rows/0/assetId", "/scope/assetId"],
			["/rows/0/wellId", findingLocation(projection.wellIdFinding)],
			["/rows/0/period", findingLocation(projection.periodFinding)],
			[
				"/rows/0/asOf",
				dates.length ? `/evidence/${work.evidence.findIndex((item) => item.asOf === dates[0])}/asOf` : "/evidence",
			],
			...work.findings.flatMap((finding, index) => [
				[`/rows/0/fields/${finding.id}/value`, `/findings/${index}/value`],
				[`/rows/0/fields/${finding.id}/unit`, `/findings/${index}/unit`],
			]),
		]),
	};
}
