import {
	type MCPExecutionContext,
	type MCPServer,
	ServerFactory,
	type ServerRuntimeOptions,
	type ServerTemplate,
} from "@shaleyeah/sdk";
import { z } from "zod";
import { QAError, type QAPrincipal, qaRefSchema } from "./qa-inputs.js";
import { type QAService, qaRunSchema } from "./qa-service.js";

export interface QAOptions extends ServerRuntimeOptions {
	service?: QAService;
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
		],
	};
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
