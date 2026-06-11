#!/usr/bin/env node

/**
 * Title MCP Server — Titulus Verificatus, Master Title Analyst
 *
 * Four focused tools covering the core title workflow:
 *   examine_ownership    → WI/NRI split, royalty, ORRI
 *   analyze_lease        → primary term, expiry risk, depth/acreage limits
 *   check_burdens        → encumbrances, production payments, ORRI verification
 *   trace_chain_of_title → conveyance chain gaps, curative requirements
 *
 * Business logic lives in src/tools/. This file is a thin facade that wires
 * each tool to its domain module and registers them on the MCP server.
 */

import type { MCPServer } from "@shaleyeah/sdk";
import { runMCPServer, ServerFactory, type ServerTemplate, ServerUtils } from "@shaleyeah/sdk";
import { z } from "zod";
import { synthesizeBurdenCheckWithLLM } from "./tools/burden-check.js";
import { synthesizeChainOfTitleWithLLM } from "./tools/chain-of-title.js";
import { synthesizeLeaseAnalysisWithLLM } from "./tools/lease-analysis.js";
import { synthesizeOwnershipWithLLM } from "./tools/ownership.js";

// ---------------------------------------------------------------------------
// Re-export types and domain functions for tests and downstream consumers
// ---------------------------------------------------------------------------

export type { OwnershipBreakdown } from "./tools/ownership.js";
export type { LeaseAnalysis } from "./tools/lease-analysis.js";
export type { BurdenAssessment } from "./tools/burden-check.js";
export type { ChainOfTitleResult } from "./tools/chain-of-title.js";
export { deriveOwnershipBreakdown, synthesizeOwnershipWithLLM } from "./tools/ownership.js";
export { deriveLeaseAnalysis, synthesizeLeaseAnalysisWithLLM } from "./tools/lease-analysis.js";
export { deriveBurdenAssessment, synthesizeBurdenCheckWithLLM } from "./tools/burden-check.js";
export { deriveChainOfTitle, synthesizeChainOfTitleWithLLM } from "./tools/chain-of-title.js";

// ---------------------------------------------------------------------------
// Legacy interface — kept so existing server.test.ts imports don't break
// ---------------------------------------------------------------------------

export interface TitleFindings {
    clearTitle: boolean;
    ownershipPercentage: number;
    riskLevel: "low" | "medium" | "high";
    encumbrances: number;
    notes: string;
}

/**
 * Rule-based title findings — backward-compat shim used by server.test.ts.
 * New code should call the focused domain functions exported above.
 */
export function deriveDefaultTitleFindings(
    propertyDescription: string,
    county: string,
    examPeriod: string,
): TitleFindings {
    const isComplex = propertyDescription.includes(",") || examPeriod.includes("40") || examPeriod.includes("50");
    const isKnownActiveCounty = ["reeves", "midland", "lea", "weld"].some((c) => county.toLowerCase().includes(c));

    return {
        clearTitle: !isComplex,
        ownershipPercentage: isComplex ? 75.0 : 87.5,
        riskLevel: isComplex ? "medium" : isKnownActiveCounty ? "low" : "low",
        encumbrances: isComplex ? 2 : 1,
        notes: isComplex
            ? `Complex title chain in ${county} — recommend thorough examination over ${examPeriod}`
            : `Standard title in ${county} — ${examPeriod} examination period`,
    };
}

// ---------------------------------------------------------------------------
// Server template — thin wiring, no business logic here
// ---------------------------------------------------------------------------

const titleServerTemplate: ServerTemplate = {
    name: "title",
    description: "Title & Ownership Analysis MCP Server",
    persona: {
        name: "Titulus Verificatus",
        role: "Master Title Analyst",
        expertise: [
            "Title examination and verification",
            "Ownership structure analysis (WI, NRI, ORRI)",
            "Lease term analysis and expiry risk",
            "Encumbrance and burden identification",
            "Chain of title and curative requirements",
        ],
    },
    directories: ["examinations", "ownership", "reports", "documents"],
    tools: [
        ServerFactory.createAnalysisTool(
            "examine_ownership",
            "Analyze working interest (WI) and net revenue interest (NRI) for an O&G property",
            z.object({
                propertyDescription: z.string().describe("Legal description of the property"),
                county: z.string(),
                state: z.string(),
                outputPath: z.string().optional(),
            }),
            async (args) => {
                const result = await synthesizeOwnershipWithLLM({
                    propertyDescription: args.propertyDescription,
                    county: args.county,
                    state: args.state,
                });
                return { ...result, confidence: ServerUtils.calculateConfidence(0.9, 0.8) };
            },
        ),

        ServerFactory.createAnalysisTool(
            "analyze_lease",
            "Parse lease terms and assess expiry risk, depth severance, and acreage limitations",
            z.object({
                primaryTerm: z.string().describe("Lease primary term, e.g. '3 years' or '36 months'"),
                county: z.string(),
                state: z.string(),
                examPeriod: z.string().default("20 years"),
                outputPath: z.string().optional(),
            }),
            async (args) => {
                const result = await synthesizeLeaseAnalysisWithLLM({
                    primaryTerm: args.primaryTerm,
                    county: args.county,
                    state: args.state,
                    examPeriod: args.examPeriod,
                });
                return { ...result, confidence: ServerUtils.calculateConfidence(0.9, 0.8) };
            },
        ),

        ServerFactory.createAnalysisTool(
            "check_burdens",
            "Identify ORRI, production payments, liens, and other encumbrances on an O&G property",
            z.object({
                propertyDescription: z.string().describe("Legal description of the property"),
                county: z.string(),
                state: z.string(),
                outputPath: z.string().optional(),
            }),
            async (args) => {
                const result = await synthesizeBurdenCheckWithLLM({
                    propertyDescription: args.propertyDescription,
                    county: args.county,
                    state: args.state,
                });
                return { ...result, confidence: ServerUtils.calculateConfidence(0.9, 0.8) };
            },
        ),

        ServerFactory.createAnalysisTool(
            "trace_chain_of_title",
            "Validate conveyance chain, identify gaps, and list curative requirements",
            z.object({
                propertyDescription: z.string().describe("Legal description of the property"),
                county: z.string(),
                state: z.string(),
                examPeriod: z.string().default("20 years"),
                outputPath: z.string().optional(),
            }),
            async (args) => {
                const result = await synthesizeChainOfTitleWithLLM({
                    propertyDescription: args.propertyDescription,
                    county: args.county,
                    state: args.state,
                    examPeriod: args.examPeriod,
                });
                return { ...result, confidence: ServerUtils.calculateConfidence(0.9, 0.8) };
            },
        ),
    ],
};

export const TitleServer = ServerFactory.createServer(titleServerTemplate);
export default TitleServer;

if (import.meta.url === `file://${process.argv[1]}`) {
    const server = new (TitleServer as unknown as new () => MCPServer)();
    runMCPServer(server);
}
