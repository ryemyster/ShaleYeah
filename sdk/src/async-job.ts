/**
 * Async job polling — Arcade pattern #24.
 *
 * When a Tier 1 MCP server launches a long-running operation (seismic inversion,
 * Monte Carlo at 100k+ iterations), it can return { jobId, status: "pending" }
 * immediately rather than blocking. The agent layer polls get_job_status until the
 * job is complete or the tool's declared timeoutMs is exceeded.
 *
 * Tools opt in by declaring timeoutMs > ASYNC_THRESHOLD_MS in their AgentToolManifest.
 * The default poller calls get_job_status via MCP JSON-RPC on the same server that
 * issued the job. Tests inject a mock poller via runXxxTask({ asyncJobPoller }).
 */

export type AsyncJobPollResult =
	| { status: "pending" }
	| { status: "complete"; result: unknown }
	| { status: "failed"; error: string };

/** Injectable polling function — default calls get_job_status on the MCP server. */
export type AsyncJobPoller = (jobId: string, serverUrl: string) => Promise<AsyncJobPollResult>;

/** Tools with timeoutMs above this threshold are eligible for async-job polling. */
export const ASYNC_THRESHOLD_MS = 10_000;

/** Default poll interval — 2s matches typical seismic processing checkpoints. */
export const ASYNC_POLL_INTERVAL_MS = 2_000;

/**
 * Default poller — calls get_job_status via MCP JSON-RPC on the target server.
 * Servers that don't implement async jobs return { status: "failed", error: "..." }.
 */
export const defaultAsyncJobPoller: AsyncJobPoller = async (jobId, serverUrl) => {
	try {
		const res = await fetch(`${serverUrl}/mcp`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: 1,
				method: "tools/call",
				params: { name: "get_job_status", arguments: { jobId } },
			}),
		});
		if (!res.ok) return { status: "failed", error: `HTTP ${res.status}` };
		const body = (await res.json()) as { result?: { content?: Array<{ text?: string }> } };
		const text = body.result?.content?.[0]?.text;
		if (!text) return { status: "failed", error: "Empty response from get_job_status" };
		const parsed = JSON.parse(text) as { status?: string; result?: unknown; error?: string };
		if (parsed.status === "complete") return { status: "complete", result: parsed.result };
		if (parsed.status === "failed") return { status: "failed", error: parsed.error ?? "job failed" };
		return { status: "pending" };
	} catch (err) {
		return { status: "failed", error: err instanceof Error ? err.message : String(err) };
	}
};
