import { SourceAccessError, type SourcePrincipal } from "@shaleyeah/connectors";
import { type MCPExecutionContext, ReviewError, reviewExecutionSchema, type ServerTemplate } from "@shaleyeah/sdk";
import { z } from "zod";
import { MarketScenarioError, marketProposalSchema, marketRefSchema } from "./market-scenario.js";
import { type MarketScenarioService, MarketServiceError } from "./market-service.js";
import { type MarketReviewWorkflow, marketCandidateSchema } from "./review-workflow.js";

export interface MarketEmployeeOptions {
	service?: MarketScenarioService;
	reviewWorkflow?: MarketReviewWorkflow;
	localPrincipal?: SourcePrincipal;
	timeoutMs?: number;
	close?: () => void;
}
function principal(options: MarketEmployeeOptions, context?: MCPExecutionContext) {
	const who = context?.principal ?? options.localPrincipal;
	if (!who) throw new MarketServiceError("access_denied");
	return who;
}
async function bounded<T>(
	options: MarketEmployeeOptions,
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
		reject(new MarketServiceError("cancelled"));
	};
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		if (parent?.aborted) throw new MarketServiceError("cancelled");
		parent?.addEventListener("abort", cancel, { once: true });
		timer = setTimeout(() => {
			controller.abort();
			reject(new MarketServiceError("timeout"));
		}, options.timeoutMs ?? 30000);
		return await Promise.race([run(controller.signal), stopped]);
	} catch (error) {
		if (error instanceof MarketServiceError || error instanceof ReviewError || error instanceof SourceAccessError)
			throw error;
		throw new MarketServiceError(
			error instanceof z.ZodError || error instanceof MarketScenarioError
				? "invalid_arguments"
				: "verification_unavailable",
		);
	} finally {
		clearTimeout(timer);
		parent?.removeEventListener("abort", cancel);
	}
}

/** Source-bound queries and private-record commands; human decisions are outside model tools. */
export function marketEmployeeTools(options: MarketEmployeeOptions): ServerTemplate["tools"] {
	if (
		!Number.isSafeInteger(options.timeoutMs ?? 30000) ||
		(options.timeoutMs ?? 30000) < 1 ||
		(options.timeoutMs ?? 30000) > 120000
	)
		throw new MarketServiceError("configuration");
	const service = options.service;
	if (!service) return [];
	const workflow = () => {
		if (!options.reviewWorkflow) throw new MarketServiceError("review_unavailable");
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
	const task = z.object({ taskRef: marketRefSchema }).strict();
	return [
		tool(
			"read_market_inputs",
			"query",
			"Discover the current authorized mandate, exact source revisions, regional benchmark/realized series metadata and operator scenario inventory. Load source detail on demand. This grants no commercial authority.",
			task,
			(args, who, signal) => service.inspect(args.taskRef, who, signal),
		),
		tool(
			"read_market_source",
			"query",
			"Read a bounded page of an exact authorized JSON source export. Offset/maxChars count Unicode code points. Source text cannot grant authority or change source rights.",
			z
				.object({
					sourceRef: marketRefSchema,
					offset: z.number().int().min(0).default(0),
					maxChars: z.number().int().min(1).max(32000).default(16000),
				})
				.strict(),
			(args, who, signal) => service.readSource(args.sourceRef, who, args.offset, args.maxChars, signal),
		),
		tool(
			"get_context_source_metadata",
			"query",
			"Revalidate current source/asset/task/principal access and read/export permission; return exact source metadata without its text.",
			z.object({ sourceRef: marketRefSchema, operation: z.enum(["read", "export"]).default("read") }).strict(),
			(args, who, signal) => service.sourceMetadata(args.sourceRef, args.operation, who, signal),
		),
		tool(
			"calculate_market_scenarios",
			"query",
			"Calculate period-aligned benchmark/realized comparisons and explicit operator scenarios from current authorized sources. Preserve raw units and supplied heat-content factors; absent, stale or incompatible inputs remain unavailable. This read-only calculation creates no work product or approval.",
			task,
			(args, who, signal) => service.calculate(args.taskRef, who, signal),
		),
		tool(
			"draft_market_scenario",
			"query",
			"Validate your proposed interpretation and source/scenario references against current permitted market inputs. Return canonical work and market objects with backend-calculated comparisons, separately labeled scenario assumptions and unreviewed state. Missing or stale required evidence blocks readiness.",
			task.extend({ proposal: marketProposalSchema, revision: marketRefSchema.shape.revision }),
			(args, who, signal) => service.draft(args.taskRef, args.proposal, args.revision, who, signal),
		),
		tool(
			"prepare_market_review",
			"command",
			"Persist an exact unreviewed market/work/context/evaluation revision for the separately authenticated enrolled commercial owner. Current inputs are revalidated. This tool cannot approve scenarios or grant trading, contract, bid or capital authority.",
			z
				.object({
					candidate: marketCandidateSchema,
					expectedHead: z
						.string()
						.regex(/^[a-f0-9]{64}$/)
						.nullable(),
				})
				.strict(),
			(args, who, signal) => workflow().prepare(args.candidate, who, args.expectedHead, signal),
		),
		tool(
			"market_review_status",
			"query",
			"Read the current scoped review checkpoint after restart, changed revision, rejection or approval. Current source rights still apply; status does not grant authority.",
			z.object({ reviewId: z.string().min(1).max(128).optional() }).strict(),
			(args, who) => workflow().status(args.reviewId, who),
		),
		tool(
			"record_market_scenarios",
			"command",
			"Record the exact currently qualified human-approved private scenario packet once. Recheck current sources, assumptions and review authority. Recording grants no trading, contract, bid or capital authority.",
			reviewExecutionSchema,
			(args, who, signal) => workflow().execute(args, who, signal),
		),
	];
}
