/**
 * Shared LLM Client — Issue #222
 *
 * Single source of truth for all Anthropic API calls in SHALE YEAH.
 * All 14 MCP servers use this instead of instantiating Anthropic directly.
 *
 * Default model: claude-opus-4-6 (most capable, adaptive thinking)
 * Default max_tokens: 4096 (sufficient for server analysis narratives)
 */

import Anthropic from "@anthropic-ai/sdk";

export interface LLMCallOptions {
	/** The user-turn prompt */
	prompt: string;
	/** Optional system prompt (defaults to generic analyst persona) */
	system?: string;
	/** Model override (defaults to claude-opus-4-6) */
	model?: string;
	/** Max output tokens (defaults to 4096) */
	maxTokens?: number;
}

const DEFAULT_MODEL = "claude-opus-4-6";
const DEFAULT_MAX_TOKENS = 4096;

/**
 * Call Claude and return the text response.
 *
 * Throws with a clear message if ANTHROPIC_API_KEY is not set.
 * Uses adaptive thinking on Opus 4.6 for best reasoning quality.
 */
export async function callLLM(options: LLMCallOptions): Promise<string> {
	const apiKey = process.env.ANTHROPIC_API_KEY;
	if (!apiKey) {
		throw new Error(
			"ANTHROPIC_API_KEY environment variable is not set. " +
				"Set it to your Anthropic API key to enable LLM synthesis.",
		);
	}

	const client = new Anthropic({ apiKey });

	const response = await client.messages.create({
		model: options.model ?? DEFAULT_MODEL,
		max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
		thinking: { type: "adaptive" },
		...(options.system ? { system: options.system } : {}),
		messages: [{ role: "user", content: options.prompt }],
	});

	const textBlock = response.content.find((b) => b.type === "text");
	if (!textBlock || textBlock.type !== "text") {
		throw new Error("LLM response contained no text block");
	}

	return textBlock.text;
}
