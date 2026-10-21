import {
	type MCPExecutionContext,
	type MCPServer,
	reviewExecutionSchema,
	ServerFactory,
	type ServerRuntimeOptions,
	type ServerTemplate,
} from "@shaleyeah/sdk";
import { z } from "zod";
import { qaDispositionProposalSchema } from "./qa-disposition.js";
import { QAError, type QAPrincipal, qaRefSchema } from "./qa-inputs.js";
import { type QAService, qaRunSchema } from "./qa-service.js";
import { type QADispositionWorkflow, qaDispositionCandidateSchema } from "./review-workflow.js";

export interface QAOptions extends ServerRuntimeOptions {
	service?: QAService;
	reviewWorkflow?: QADispositionWorkflow;
	localPrincipal?: QAPrincipal;
	close?: () => void;
	timeoutMs?: number;
}
async function bounded<T>(
	options: QAOptions,
	parent: AbortSignal | undefined,
	action: (signal: AbortSignal) => Promise<T>,
) {
	const controller = new AbortController();
	let timer: ReturnType<typeof setTimeout> | undefined;
	let reject: (error: Error) => void = () => {};
	const stopped = new Promise<never>((_resolve, failure) => {
		reject = failure;
	});
	const cancel = () => {
		controller.abort();
		reject(new QAError("cancelled"));
	};
	try {
		if (parent?.aborted) throw new QAError("cancelled");
		parent?.addEventListener("abort", cancel, { once: true });
		timer = setTimeout(() => {
			controller.abort();
			reject(new QAError("timeout"));
		}, options.timeoutMs ?? 30000);
		return await Promise.race([action(controller.signal), stopped]);
	} finally {
		clearTimeout(timer);
		parent?.removeEventListener("abort", cancel);
	}
}
function principal(options: QAOptions, context?: MCPExecutionContext) {
	const who = context?.principal ?? options.localPrincipal;
	if (!who) throw new QAError("access_denied");
	return who;
}
function service(options: QAOptions) {
	if (!options.service) throw new QAError("configuration");
	return options.service;
}
/** Shared contract/process only: bounded deterministic tools, with no employee reasoning loop. */
export function createQATemplate(options: QAOptions = {}): ServerTemplate {
	if (
		!Number.isSafeInteger(options.timeoutMs ?? 30000) ||
		(options.timeoutMs ?? 30000) < 1 ||
		(options.timeoutMs ?? 30000) > 120000
	)
		throw new QAError("configuration");
	return {
		name: "qa",
		description: "Observed data quality checks and private draft reports",
		persona: {
			name: "Testius Validatus",
			role: "Quality assurance tooling",
			expertise: ["Configured data assertions", "Traceable defect evidence"],
		},
		directories: [],
		tools: [
			{
				name: "get_qa_status",
				type: "discovery",
				description: "Discover supported normalized inputs, rule dimensions, and human review boundaries",
				inputSchema: z.object({}).strict(),
				handler: async () => ({
					success: true,
					analysis: {
						architectureMode: "shared-contract-process-only",
						configured: Boolean(options.service),
						inputFormats: ["normalized-qa-data@0.1.0", "work-product@0.1.0"],
						rules: [
							"completeness",
							"correctness",
							"units",
							"identity",
							"duplication",
							"freshness",
							"provenance",
							"contradiction",
						],
						rawConnectorFormats: [],
						professionalCertification: false,
						dispositionReviewConfigured: Boolean(options.reviewWorkflow),
						reviewBoundary:
							"Data/producing owner reviews defects, waivers, source repair, acceptance and publication outside these tools",
					},
				}),
			},
			{
				name: "run_quality_tests",
				type: "command",
				description:
					"Evaluate the current authorized task inputs against its approved versioned rule profile; store an immutable private draft result. No waiver or certification.",
				inputSchema: qaRunSchema,
				providesFor: ["qa.generate_quality_report"],
				handler: async (args, context, signal) => {
					const who = principal(options, context);
					return {
						success: true,
						analysis: await bounded(options, signal, (active) => service(options).run(args, who, active)),
					};
				},
			},
			{
				name: "triage_quality_result",
				type: "query",
				description:
					"Create an optional unreviewed note using the configured BYO synthesis model. An unavailable model leaves observed checks unchanged; this tool cannot approve or waive defects.",
				inputSchema: z.object({ resultRef: qaRefSchema }).strict(),
				dependsOn: ["qa.run_quality_tests"],
				handler: async (args, context, signal) => {
					const who = principal(options, context);
					return {
						success: true,
						analysis: await bounded(options, signal, (active) => service(options).triage(args.resultRef, who, active)),
					};
				},
			},
			{
				name: "generate_quality_report",
				type: "query",
				description:
					"Read an exact recorded QA result under current task/profile and source export authority. Counts and rates come from the recorded checks; the report remains unreviewed.",
				inputSchema: z.object({ resultRef: qaRefSchema }).strict(),
				dependsOn: ["qa.run_quality_tests"],
				handler: async (args, context, signal) => {
					const who = principal(options, context);
					return {
						success: true,
						analysis: await bounded(options, signal, (active) => service(options).report(args.resultRef, who, active)),
					};
				},
			},
			...(options.reviewWorkflow ? reviewTools(options) : []),
		],
	};
}

function reviewTools(options: QAOptions): ServerTemplate["tools"] {
	const workflow = options.reviewWorkflow!;
	return [
		{
			name: "draft_disposition",
			type: "query",
			description:
				"Derive a new exact source-bound disposition draft from a currently authorized immutable QA report. No human decision or change to original results.",
			inputSchema: z
				.object({ resultRef: qaRefSchema, proposal: qaDispositionProposalSchema, revision: z.string().min(1).max(128) })
				.strict(),
			handler: async (args, context, signal) => ({
				success: true,
				analysis: await bounded(options, signal, (active) =>
					workflow.draft(args.resultRef, args.proposal, args.revision, principal(options, context), active),
				),
			}),
		},
		{
			name: "get_context_source_metadata",
			type: "query",
			description:
				"Verify current task, rule-profile and source metadata rights for this employee's context. No source bytes or authority grant are returned.",
			inputSchema: z.object({ evidenceId: z.string().min(1).max(128), operation: z.enum(["read", "export"]) }).strict(),
			handler: async (args, context, signal) => ({
				success: true,
				analysis: await bounded(options, signal, (active) =>
					service(options).contextMetadata(args.evidenceId, principal(options, context), args.operation, active),
				),
			}),
		},
		{
			name: "prepare_review",
			type: "command",
			description:
				"Prepare an exact private QA disposition with current observed result, source, context and eval bindings. This cannot approve an exception or repair data.",
			inputSchema: z
				.object({
					candidate: qaDispositionCandidateSchema,
					expectedHead: z
						.string()
						.regex(/^[a-f0-9]{64}$/)
						.nullable(),
				})
				.strict(),
			handler: async (args, context, signal) => ({
				success: true,
				analysis: await bounded(options, signal, (active) =>
					workflow.prepare(args.candidate, principal(options, context), args.expectedHead, active),
				),
			}),
		},
		{
			name: "get_review_status",
			type: "query",
			description:
				"Read the current scoped durable disposition checkpoint; current source and profile rights remain required.",
			inputSchema: z.object({ reviewId: z.string().min(1).max(128).optional() }).strict(),
			handler: async (args, context, signal) => ({
				success: true,
				analysis: await bounded(options, signal, () => workflow.status(args.reviewId, principal(options, context))),
			}),
		},
		{
			name: "record_disposition",
			type: "command",
			description:
				"Record the exact qualified authenticated human-approved private disposition once. The original FAIL, UNTESTED or ERROR remains unchanged; no source correction, certification or release.",
			inputSchema: reviewExecutionSchema,
			handler: async (args, context, signal) => ({
				success: true,
				analysis: await bounded(options, signal, (active) =>
					workflow.execute(args, principal(options, context), active),
				),
			}),
		},
	];
}
export const QAServer = function (options: QAOptions = {}) {
	if (!new.target) throw new QAError("configuration");
	const instance = new (ServerFactory.createServer(createQATemplate(options)))(options);
	const stop = instance.stop.bind(instance);
	instance.stop = async () => {
		try {
			await stop();
		} finally {
			options.close?.();
		}
	};
	return instance;
} as unknown as { new (options?: QAOptions): MCPServer };
