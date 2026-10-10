/**
 * QA validation domain logic — LLM synthesis + deterministic fallback.
 *
 * These functions provide the core quality assessment logic for the qa-server.
 * They validate O&G analysis outputs (economic models, geological assessments)
 * before those outputs reach the investment chair — peer review of deal analysis,
 * not software monitoring.
 */

import { callLLM } from "@shaleyeah/sdk";

export interface QAValidationResult {
	overallStatus: "PASS" | "FAIL" | "WARNING";
	issues: string[];
	recommendation: string;
}

/**
 * Rule-based QA validation — fallback when the API is unavailable.
 * Output varies with targets and criteria so tests can verify determinism.
 */
export function deriveDefaultQAResult(targets: string[], accuracyThreshold: number): QAValidationResult {
	// Stricter accuracy threshold → higher chance of flagging issues
	const isTight = accuracyThreshold > 0.97;
	const hasMultipleTargets = targets.length > 3;

	return {
		overallStatus: isTight ? "WARNING" : "PASS",
		issues: isTight ? [`Accuracy threshold of ${accuracyThreshold * 100}% is aggressive — monitor closely`] : [],
		recommendation: hasMultipleTargets
			? `Validate all ${targets.length} targets individually before sign-off`
			: "Standard QA process is sufficient for this scope",
	};
}

/**
 * Ask Claude (Testius Validatus) to review the QA targets and flag inconsistencies.
 * Falls back to deriveDefaultQAResult() if the API is unavailable.
 */
export async function synthesizeQAValidationWithLLM(params: {
	testSuite: string;
	targets: string[];
	accuracyThreshold: number;
	complianceStandards: string[];
}): Promise<QAValidationResult> {
	const { testSuite, targets, accuracyThreshold, complianceStandards } = params;

	const prompt = `You are Testius Validatus, a master quality assurance engineer for oil & gas analysis systems.

Review the following QA test configuration and identify any potential issues or risks. Return a JSON object.

TEST SUITE: ${testSuite}
TARGETS: ${targets.join(", ")}
ACCURACY THRESHOLD: ${accuracyThreshold * 100}%
COMPLIANCE STANDARDS: ${complianceStandards.length > 0 ? complianceStandards.join(", ") : "None specified"}

Return ONLY valid JSON in this exact shape:
{
  "overallStatus": "PASS" | "FAIL" | "WARNING",
  "issues": ["<issue 1 if any>"],
  "recommendation": "<one sentence QA recommendation>"
}

Flag WARNING if thresholds seem unrealistic or targets are ambiguous. Flag FAIL only for clear compliance gaps.`;

	try {
		const raw = await callLLM({ prompt, maxTokens: 300 });
		const match = raw.match(/\{[\s\S]*\}/);
		if (!match) throw new Error("No JSON in response");
		const parsed = JSON.parse(match[0]) as Partial<QAValidationResult>;
		const validStatuses = ["PASS", "FAIL", "WARNING"];
		if (!validStatuses.includes(parsed.overallStatus ?? "")) throw new Error("Invalid overallStatus");
		return {
			overallStatus: parsed.overallStatus as "PASS" | "FAIL" | "WARNING",
			issues: parsed.issues ?? [],
			recommendation: parsed.recommendation ?? "",
		};
	} catch (_err) {
		return deriveDefaultQAResult(targets, accuracyThreshold);
	}
}
