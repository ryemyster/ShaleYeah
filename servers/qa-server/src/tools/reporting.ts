/**
 * QA report generation — deterministic report structure.
 *
 * Metrics that require live telemetry (Prometheus, Datadog, etc.) are marked N/A.
 * This server provides LLM-based QA validation, not runtime monitoring. The N/A
 * values are intentional — they signal to operators that a live telemetry integration
 * is needed for those fields (#412).
 */

export interface QAReport {
	report: { type: string; period: string; generated: string };
	dataSource: string;
	metrics: {
		accuracy?: { current: string; target: string; trend: string };
		performance?: { avgResponseTime: string; uptime: string; trend: string };
		reliability?: { errorRate: string; mtbf: string; trend: string };
	};
	compliance: { status: string; lastAudit: string; nextReview: string; gaps: string[] };
	recommendations: string[];
}

/**
 * Derive a quality report structure for the requested metrics and period.
 * All live-telemetry fields return "N/A" intentionally — they require
 * Prometheus/Datadog integration to populate.
 */
export function deriveQualityReport(reportType: string, period: string, requestedMetrics: string[]): QAReport {
	return {
		report: {
			type: reportType,
			period,
			generated: new Date().toISOString(),
		},
		dataSource: "llm-validation",
		metrics: {
			accuracy: requestedMetrics.includes("accuracy")
				? { current: "N/A — requires live telemetry", target: "N/A", trend: "N/A" }
				: undefined,
			performance: requestedMetrics.includes("performance")
				? { avgResponseTime: "N/A", uptime: "N/A", trend: "N/A" }
				: undefined,
			reliability: requestedMetrics.includes("reliability")
				? { errorRate: "N/A", mtbf: "N/A", trend: "N/A" }
				: undefined,
		},
		compliance: {
			status: "LLM-assessed — verify with formal audit",
			lastAudit: "N/A",
			nextReview: "N/A",
			gaps: [],
		},
		recommendations: [
			"Connect to live telemetry (Prometheus/Datadog) for runtime metrics",
			"Schedule formal compliance audit to replace LLM assessment",
			"Continue LLM-based QA validation for configuration and threshold review",
		],
	};
}
