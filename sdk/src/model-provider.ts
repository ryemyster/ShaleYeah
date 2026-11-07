import { constants } from "node:fs";
import fs from "node:fs/promises";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

const identifier = z
	.string()
	.min(1)
	.max(128)
	.regex(/^[a-zA-Z0-9_.:/-]+$/);
const ownerSchema = z.strictObject({ customerId: identifier, employeeId: identifier });
const profileSchema = z.strictObject({
	version: z.literal("0.1.0"),
	id: identifier,
	revision: identifier,
	purpose: z.enum(["agent", "synthesis", "judge"]),
	owner: ownerSchema,
	provider: z.enum(["gemini", "anthropic"]),
	model: identifier.refine((value) => !value.toLowerCase().includes("latest")),
	modelRevision: identifier,
	endpoint: z.string(),
	credentialRef: z
		.string()
		.max(512)
		.regex(/^(secret|file):[^\s]+$/),
	capabilities: z.strictObject({ toolUse: z.boolean(), structuredOutput: z.boolean() }),
	limits: z.strictObject({
		timeoutMs: z.number().int().min(1).max(120_000),
		maxAttempts: z.number().int().min(1).max(3),
		maxOutputTokens: z.number().int().min(1).max(16_384),
		maxRequests: z.number().int().min(1).max(100),
		maxInputChars: z.number().int().min(1).max(262_144),
	}),
});

export type ModelProfile = z.infer<typeof profileSchema>;
export type ModelOwner = ModelProfile["owner"];
const origins = { gemini: "https://generativelanguage.googleapis.com", anthropic: "https://api.anthropic.com" };
const messages = {
	configuration: "Invalid model provider configuration",
	credential: "Model credential unavailable",
	owner: "Model owner scope forbidden",
	capability: "Unsupported model capability",
	budget: "Model request budget exhausted",
	input: "Invalid or oversized model input",
	output: "Invalid model output schema or secret reflection",
	timeout: "Model request timeout",
	cancelled: "Model request cancelled",
	provider: "Model provider unavailable",
} as const;

/** Errors deliberately carry no vendor payload, credential reference, or raw cause. */
export class ModelProviderError extends Error {
	constructor(readonly code: keyof typeof messages) {
		super(messages[code]);
		this.name = "ModelProviderError";
	}
}

export function parseModelProfile(value: unknown): ModelProfile {
	try {
		const profile = profileSchema.parse(value);
		if (profile.endpoint !== origins[profile.provider]) throw new Error();
		return profile;
	} catch {
		throw new ModelProviderError("configuration");
	}
}

export function parseReferenceModelConfig(value: unknown): {
	version: "0.1.0";
	agent: ModelProfile;
	synthesis: ModelProfile;
	judge: ModelProfile | null;
} {
	try {
		const config = z
			.strictObject({ version: z.literal("0.1.0"), agent: z.unknown(), synthesis: z.unknown(), judge: z.unknown() })
			.parse(value);
		const agent = parseModelProfile(config.agent),
			synthesis = parseModelProfile(config.synthesis);
		const judge = config.judge === null ? null : parseModelProfile(config.judge);
		if (
			agent.purpose !== "agent" ||
			synthesis.purpose !== "synthesis" ||
			agent.provider !== synthesis.provider ||
			JSON.stringify(agent.owner) !== JSON.stringify(synthesis.owner) ||
			!agent.capabilities.toolUse ||
			!synthesis.capabilities.structuredOutput
		)
			throw new Error();
		if (
			judge &&
			(judge.purpose !== "judge" ||
				JSON.stringify(judge.owner) !== JSON.stringify(agent.owner) ||
				[agent.credentialRef, synthesis.credentialRef].includes(judge.credentialRef))
		)
			throw new Error();
		return { version: "0.1.0", agent, synthesis, judge };
	} catch {
		throw new ModelProviderError("configuration");
	}
}

export function createFileModelCredentialResolver(boundOwner: ModelOwner): ModelRuntimeOptions["resolveCredential"] {
	const owner = ownerSchema.parse(boundOwner);
	return async (caller, reference, purpose) => {
		if (
			caller.customerId !== owner.customerId ||
			caller.employeeId !== owner.employeeId ||
			!["agent", "synthesis", "judge"].includes(purpose)
		)
			throw new ModelProviderError("owner");
		try {
			if (!reference.startsWith("file:/")) throw new Error();
			return (await readOwnedPrivateText(reference.slice(5), 4096)).trim();
		} catch {
			throw new ModelProviderError("credential");
		}
	};
}

async function readOwnedPrivateText(file: string, maximum: number): Promise<string> {
	if (!constants.O_NOFOLLOW) throw new Error();
	const handle = await fs.open(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
	try {
		const info = await handle.stat();
		if (!info.isFile() || (info.mode & 0o077) !== 0 || (process.getuid && info.uid !== process.getuid()))
			throw new Error();
		const bytes = Buffer.alloc(maximum + 1);
		let total = 0;
		while (total < bytes.length) {
			const { bytesRead } = await handle.read(bytes, total, bytes.length - total, total);
			if (!bytesRead) break;
			total += bytesRead;
		}
		if (total > maximum) throw new Error();
		return bytes.subarray(0, total).toString("utf8");
	} finally {
		await handle.close();
	}
}

export async function readPrivateReferenceModelConfig(file: string) {
	try {
		return parseReferenceModelConfig(JSON.parse(await readOwnedPrivateText(file, 65_536)));
	} catch {
		throw new ModelProviderError("configuration");
	}
}

export interface ModelInput {
	prompt: string;
	system?: string;
	schema: Record<string, unknown>;
	signal?: AbortSignal;
}
export interface ModelMetadata {
	provider: ModelProfile["provider"];
	model: string;
	modelRevision: string;
	revision: string;
	adapterRevision: string;
	reportedModelRevision?: string;
}
export interface ModelResult {
	output: Record<string, unknown>;
	metadata: ModelMetadata;
}
export type PublicModelProfile = Omit<ModelProfile, "credentialRef">;
export interface ModelRuntime {
	publicProfile(): PublicModelProfile;
	generate(input: ModelInput, caller?: ModelOwner): Promise<ModelResult>;
	/** A fresh bounded task budget, with the same private trusted binding. */
	fork?(): ModelRuntime;
}
export interface ModelRuntimeOptions {
	resolveCredential: (owner: ModelOwner, reference: string, purpose: ModelProfile["purpose"]) => Promise<string>;
	adapter?: (
		profile: ModelProfile,
		credential: string,
		input: ModelInput,
		signal: AbortSignal,
	) => Promise<{ output: unknown; reportedModelRevision?: string }>;
	fetch?: typeof globalThis.fetch;
}

/** Maintained native SDKs; transport injection supports offline conformance without global patches. */
export async function nativeModelAdapter(
	profile: ModelProfile,
	key: string,
	input: ModelInput,
	signal: AbortSignal,
	transport = globalThis.fetch,
) {
	if (
		transport === globalThis.fetch &&
		(process.env.NODE_USE_ENV_PROXY === "1" || process.execArgv.includes("--use-env-proxy"))
	)
		throw new ModelProviderError("configuration");
	const fetch: typeof globalThis.fetch = async (resource, init) => {
		const url = new URL(resource instanceof Request ? resource.url : String(resource));
		if (url.origin !== profile.endpoint || url.username || url.password) throw new ModelProviderError("configuration");
		return transport(resource, { ...init, redirect: "error", signal });
	};
	if (profile.provider === "gemini") {
		const client = new GoogleGenAI({
			apiKey: key,
			vertexai: false,
			enterprise: false,
			httpOptions: {
				baseUrl: profile.endpoint,
				apiVersion: "v1beta",
				timeout: profile.limits.timeoutMs,
				retryOptions: { attempts: profile.limits.maxAttempts },
				fetch,
			},
		});
		const response = await client.models.generateContent({
			model: profile.model,
			contents: input.prompt,
			config: {
				systemInstruction: input.system,
				maxOutputTokens: profile.limits.maxOutputTokens,
				responseMimeType: "application/json",
				responseJsonSchema: input.schema,
				abortSignal: signal,
			},
		});
		return { output: JSON.parse(response.text ?? ""), reportedModelRevision: response.modelVersion };
	}
	const client = new Anthropic({
		apiKey: key,
		baseURL: profile.endpoint,
		timeout: profile.limits.timeoutMs,
		maxRetries: profile.limits.maxAttempts - 1,
		fetch,
		logLevel: "off",
	});
	const response = await client.messages.create(
		{
			model: profile.model,
			max_tokens: profile.limits.maxOutputTokens,
			system: input.system,
			messages: [{ role: "user", content: input.prompt }],
			tools: [
				{
					name: "submit_result",
					description: "Return the requested structured analysis",
					input_schema: input.schema as Anthropic.Tool.InputSchema,
				},
			],
			tool_choice: { type: "tool", name: "submit_result", disable_parallel_tool_use: true },
		},
		{ signal },
	);
	const result = response.content.filter((item) => item.type === "tool_use" && item.name === "submit_result");
	if (result.length !== 1 || result[0].type !== "tool_use") throw new ModelProviderError("output");
	return { output: result[0].input, reportedModelRevision: response.model };
}

/** Create one private model binding per task; no environment credential or vendor fallback. */
export function createModelRuntime(value: ModelProfile, options: ModelRuntimeOptions): ModelRuntime {
	const profile = parseModelProfile(value);
	let requests = 0;
	const publicProfile = (): PublicModelProfile => {
		const { credentialRef: _reference, ...publicSettings } = profile;
		return structuredClone(publicSettings);
	};
	return {
		publicProfile,
		fork: () => createModelRuntime(profile, options),
		async generate(input, caller = profile.owner) {
			if (caller.customerId !== profile.owner.customerId || caller.employeeId !== profile.owner.employeeId)
				throw new ModelProviderError("owner");
			if (!profile.capabilities.structuredOutput || (profile.provider === "anthropic" && !profile.capabilities.toolUse))
				throw new ModelProviderError("capability");
			if (requests >= profile.limits.maxRequests) throw new ModelProviderError("budget");
			if (
				typeof input.prompt !== "string" ||
				input.prompt.length + (input.system?.length ?? 0) > profile.limits.maxInputChars
			)
				throw new ModelProviderError("input");
			let validator: z.ZodType;
			try {
				validator = z.fromJSONSchema(input.schema);
			} catch {
				throw new ModelProviderError("input");
			}
			if (input.signal?.aborted) throw new ModelProviderError("cancelled");
			requests++;
			const controller = new AbortController();
			let rejectAbort: (error: Error) => void = () => {};
			const aborted = new Promise<never>((_resolve, reject) => {
				rejectAbort = reject;
			});
			const cancel = () => {
				controller.abort();
				rejectAbort(new ModelProviderError("cancelled"));
			};
			input.signal?.addEventListener("abort", cancel, { once: true });
			const timer = setTimeout(() => {
				controller.abort();
				rejectAbort(new ModelProviderError("timeout"));
			}, profile.limits.timeoutMs);
			try {
				return await Promise.race([
					aborted,
					(async () => {
						let key: string;
						try {
							key = await options.resolveCredential(
								structuredClone(profile.owner),
								profile.credentialRef,
								profile.purpose,
							);
						} catch {
							throw new ModelProviderError("credential");
						}
						if (!key || typeof key !== "string" || key.length < 8 || key.length > 4096 || /\s/.test(key))
							throw new ModelProviderError("credential");
						if (controller.signal.aborted) throw new ModelProviderError("cancelled");
						const serializedInput = JSON.stringify(input);
						if (serializedInput.includes(key) || serializedInput.includes(profile.credentialRef))
							throw new ModelProviderError("input");
						const result = options.adapter
							? await options.adapter(structuredClone(profile), key, input, controller.signal)
							: await nativeModelAdapter(profile, key, input, controller.signal, options.fetch);
						const serialized = JSON.stringify(result);
						if (
							!serialized ||
							serialized.includes(key) ||
							serialized.includes(profile.credentialRef) ||
							serialized.length > profile.limits.maxOutputTokens * 64
						)
							throw new ModelProviderError("output");
						let output: unknown;
						try {
							output = validator.parse(result.output);
						} catch {
							throw new ModelProviderError("output");
						}
						if (!output || typeof output !== "object" || Array.isArray(output)) throw new ModelProviderError("output");
						return {
							output: output as Record<string, unknown>,
							metadata: {
								provider: profile.provider,
								model: profile.model,
								modelRevision: profile.modelRevision,
								revision: profile.revision,
								adapterRevision: profile.provider === "gemini" ? "@google/genai@2.28.0" : "@anthropic-ai/sdk@0.104.1",
								reportedModelRevision: result.reportedModelRevision,
							},
						};
					})(),
				]);
			} catch (error) {
				if (error instanceof ModelProviderError) throw error;
				throw new ModelProviderError("provider");
			} finally {
				clearTimeout(timer);
				input.signal?.removeEventListener("abort", cancel);
			}
		},
	};
}
