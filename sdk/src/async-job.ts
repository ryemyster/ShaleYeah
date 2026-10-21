/**
 * Compatibility types for the retained employee loops.
 * No backend currently exposes a qualified job-status tool. Preserve injected
 * polling adapters while refusing the displaced anonymous JSON-RPC path.
 */

export type AsyncJobPollResult =
	| { status: "pending" }
	| { status: "complete"; result: unknown }
	| { status: "failed"; error: string };

/** A trusted caller may supply a separately configured bounded polling adapter. */
export type AsyncJobPoller = (jobId: string, serverUrl: string) => Promise<AsyncJobPollResult>;

export const ASYNC_THRESHOLD_MS = 10_000;
export const ASYNC_POLL_INTERVAL_MS = 2_000;

/** Keep the old API explicit without inventing a supported backend capability. */
export const defaultAsyncJobPoller: AsyncJobPoller = async (_jobId, _serverUrl) => ({
	status: "failed",
	error: "Default MCP async-job polling is unsupported; supply a configured bounded poller",
});
