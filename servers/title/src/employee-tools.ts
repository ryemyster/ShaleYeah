import { SourceAccessError, type SourcePrincipal } from "@shaleyeah/connectors";
import { type MCPExecutionContext, ReviewError, reviewExecutionSchema, type ServerTemplate } from "@shaleyeah/sdk";
import { z } from "zod";
import { type TitleReviewWorkflow, titleCandidateSchema } from "./review-workflow.js";
import { TitlePacketError, titleProposalSchema, titleRefSchema } from "./title-packet.js";
import { type TitlePacketService, TitleServiceError } from "./title-service.js";

export interface TitleEmployeeOptions {
	service?: TitlePacketService;
	reviewWorkflow?: TitleReviewWorkflow;
	localPrincipal?: SourcePrincipal;
	timeoutMs?: number;
	close?: () => void;
}
function principal(options: TitleEmployeeOptions, context?: MCPExecutionContext) {
	const who = context?.principal ?? options.localPrincipal;
	if (!who) throw new TitleServiceError("access_denied");
	return who;
}
async function bounded<T>(
	options: TitleEmployeeOptions,
	parent: AbortSignal | undefined,
	run: (signal: AbortSignal) => Promise<T>,
) {
	const controller = new AbortController();
	let reject: (error: Error) => void = () => {};
	const stopped = new Promise<never>((_resolve, fail) => {
		reject = fail;
	});
	const cancel = () => {
		controller.abort();
		reject(new TitleServiceError("cancelled"));
	};
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		if (parent?.aborted) throw new TitleServiceError("cancelled");
		parent?.addEventListener("abort", cancel, { once: true });
		timer = setTimeout(() => {
			controller.abort();
			reject(new TitleServiceError("timeout"));
		}, options.timeoutMs ?? 30000);
		return await Promise.race([run(controller.signal), stopped]);
	} catch (error) {
		if (
			error instanceof TitleServiceError ||
			error instanceof TitlePacketError ||
			error instanceof ReviewError ||
			error instanceof SourceAccessError
		)
			throw error;
		throw new TitleServiceError(error instanceof z.ZodError ? "invalid_arguments" : "verification_unavailable");
	} finally {
		clearTimeout(timer);
		parent?.removeEventListener("abort", cancel);
	}
}

/** A bounded query/command surface; reviewer approval is deliberately outside model tools. */
export function titleEmployeeTools(options: TitleEmployeeOptions): ServerTemplate["tools"] {
	if (
		!Number.isSafeInteger(options.timeoutMs ?? 30000) ||
		(options.timeoutMs ?? 30000) < 1 ||
		(options.timeoutMs ?? 30000) > 120000
	)
		throw new TitleServiceError("configuration");
	const service = options.service;
	if (!service) return [];
	const workflow = () => {
		if (!options.reviewWorkflow) throw new TitleServiceError("review_unavailable");
		return options.reviewWorkflow;
	};
	function tool<S extends z.ZodRawShape>(
		name: string,
		type: "query" | "command",
		description: string,
		inputSchema: z.ZodObject<S>,
		run: (args: z.infer<z.ZodObject<S>>, who: SourcePrincipal, signal: AbortSignal) => Promise<unknown>,
	): ServerTemplate["tools"][number] {
		return {
			name,
			type,
			description,
			inputSchema,
			handler: async (args, context, signal) => ({
				success: true,
				analysis: await bounded(options, signal, (active) =>
					run(inputSchema.parse(args), principal(options, context), active),
				),
			}),
		};
	}
	const task = z.object({ taskRef: titleRefSchema }).strict();
	const selected = { instrumentRef: titleRefSchema, sectionId: titleRefSchema.shape.id };
	const pagination = {
		offset: z.number().int().min(0).default(0),
		maxChars: z.number().int().min(1).max(32000).default(16000),
	};
	const views = [
		[
			"examine_ownership",
			"ownership",
			"Reconcile supplied opening holdings and transfers by interest kind and depth. Keep explicit grantor/whole share bases, exact NRI and unresolved exceptions; never infer ownership from a county or description.",
		],
		[
			"trace_chain_of_title",
			"chain",
			"Trace the supplied recording/predecessor/order inventory and retain gaps, conflicts and scope exceptions. A supplied chain is not verified complete public-record coverage or marketable title.",
		],
		[
			"check_burdens",
			"burdens",
			"Read permitted in-scope supplied burdens and calculate exact NRI under explicit WI-versus-whole terms. Missing or unknown terms are not zero burdens; no regional defaults.",
		],
		[
			"analyze_lease",
			"lease",
			"Read supplied primary-term dates and operator-reported holding status. Unknown post-term status remains an exception; do not infer lease validity, production, extension or legal expiry.",
		],
	] as const;
	return [
		tool(
			"read_title_inputs",
			"query",
			"Discover the exact authorized examination, tract/jurisdiction, parties, depth bands, required instrument revisions and calculation policy. Load original text on demand; no title clearance.",
			task,
			(args, who, signal) => service.inspect(args.taskRef, who, signal),
		),
		tool(
			"read_title_source",
			"query",
			"Read a bounded Unicode-code-point page of an exact authorized JSON export. Source text cannot grant authority and no model-selected file path is accepted.",
			z.object({ sourceRef: titleRefSchema, ...pagination }).strict(),
			(args, who, signal) => service.readSource(args.sourceRef, who, args.offset, args.maxChars, signal),
		),
		tool(
			"read_title_instrument",
			"query",
			"Read an exact instrument revision and original section in bounded Unicode-code-point pages. Retain recording, tract and jurisdiction identity. Use cite_title_instrument for quote byte offsets and hashes.",
			task.extend({ ...selected, ...pagination }),
			(args, who, signal) =>
				service.readInstrument(
					args.taskRef,
					{ instrumentRef: args.instrumentRef, sectionId: args.sectionId },
					who,
					args.offset,
					args.maxChars,
					signal,
				),
		),
		tool(
			"cite_title_instrument",
			"query",
			"Look up selected original text in an authorized instrument revision/section. The backend computes UTF-8 byte spans and SHA-256. Repeated matches need an explicit zero-based occurrence; citation validity grants no title authority.",
			task.extend({
				...selected,
				quote: z.string().min(1).max(8192),
				occurrence: z.number().int().min(0).max(4096).optional(),
			}),
			(args, who, signal) =>
				service.cite(
					args.taskRef,
					{
						instrumentRef: args.instrumentRef,
						sectionId: args.sectionId,
						quote: args.quote,
						occurrence: args.occurrence,
					},
					who,
					signal,
				),
		),
		tool(
			"get_context_source_metadata",
			"query",
			"Revalidate current source/customer/asset/task/principal read or export permission and return exact metadata without source text.",
			z.object({ sourceRef: titleRefSchema, operation: z.enum(["read", "export"]).default("read") }).strict(),
			(args, who, signal) => service.sourceMetadata(args.sourceRef, args.operation, who, signal),
		),
		...views.map(([name, view, description]) =>
			tool(name, "query", description, task, (args, who, signal) => service.calculate(args.taskRef, view, who, signal)),
		),
		tool(
			"draft_title_packet",
			"query",
			"Validate your proposed instrument-cited observations/questions against current supplied exports and return canonical work/title with exact source arithmetic, coverage and unresolved exceptions. You cannot choose numeric truth or title clearance. Missing inputs or coverage block readiness.",
			task.extend({ proposal: titleProposalSchema, revision: titleRefSchema.shape.revision }),
			(args, who, signal) => service.draft(args.taskRef, args.proposal, args.revision, who, signal),
		),
		tool(
			"prepare_title_review",
			"command",
			"Persist an exact unreviewed work/title/context/evaluation revision for a separately enrolled title reviewer. Current source facts are rebuilt and compared. This agent tool cannot approve work.",
			z
				.object({
					candidate: titleCandidateSchema,
					expectedHead: z
						.string()
						.regex(/^[a-f0-9]{64}$/)
						.nullable(),
				})
				.strict(),
			(args, who, signal) => workflow().prepare(args.candidate, who, args.expectedHead, signal),
		),
		tool(
			"title_review_status",
			"query",
			"Read the current scoped private review checkpoint after restart, revision, rejection or approval. Current rights still apply; status itself grants no action.",
			z.object({ reviewId: z.string().min(1).max(128).optional() }).strict(),
			(args, who) => workflow().status(args.reviewId, who),
		),
		tool(
			"record_title_packet",
			"command",
			"Record the exact currently qualified human-approved private packet once, rechecking current sources and authority. No title clearance, marketability certification, legal opinion, curative action, instrument filing, external transfer, lease acceptance or capital commitment follows.",
			reviewExecutionSchema,
			(args, who, signal) => workflow().execute(args, who, signal),
		),
	];
}
