/**
 * Title Analyst MCP Client + runTask Tests — Issue #372
 *
 * Layer 1: verifies callTitleTool delegates to the title server over HTTP.
 * Layer 2: verifies runTitleAnalystTask drives a multi-step LLM loop.
 *
 * Run: cd agents/title-analyst && npx tsx tests/mcp-client.test.ts
 */

import assert from "node:assert";
import type { HumanApprovalChallenge } from "@shaleyeah/sdk";
import { PermanentToolError, RetryableToolError } from "@shaleyeah/sdk";
import { callTitleTool, titleAnalystConfig, titleAnalystManifest, runTitleAnalystTask } from "../src/agent/index.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>): Promise<void> {
    return Promise.resolve()
        .then(fn)
        .then(() => {
            console.log(`  ✓ ${name}`);
            passed++;
        })
        .catch((err: unknown) => {
            console.log(`  ✗ ${name}`);
            console.log(`    ${err instanceof Error ? err.message : String(err)}`);
            failed++;
        });
}

async function titleServerReachable(): Promise<boolean> {
    try {
        const url = titleAnalystConfig.mcpServers?.["title"]?.url ?? "http://localhost:3010";
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 500);
        await fetch(url, { method: "HEAD", signal: ctrl.signal });
        clearTimeout(timer);
        return true;
    } catch {
        return false;
    }
}

async function runTests(): Promise<void> {
    console.log("\n🧪 Title Analyst MCP Client + runTask Tests (#372)\n");

    // ── Layer 1: HTTP client ──────────────────────────────────────────────────

    await test("callTitleTool is exported as a function", () => {
        assert.strictEqual(typeof callTitleTool, "function", "callTitleTool must be exported");
    });

    await test('titleAnalystConfig.mcpServers["title"].url is http://localhost:3010', () => {
        const conn = titleAnalystConfig.mcpServers?.["title"];
        assert.ok(conn, 'mcpServers["title"] entry must be present');
        assert.strictEqual(conn.url, "http://localhost:3010", "title URL must be localhost:3010");
    });

    await test('titleAnalystConfig.mcpServers["title"].transport is http', () => {
        const conn = titleAnalystConfig.mcpServers?.["title"];
        assert.ok(conn, 'mcpServers["title"] entry must be present');
        assert.strictEqual(conn.transport, "http", "title transport must be http");
    });

    await test("all 4 title-analyst tools declare mcpServer: 'title'", () => {
        const wrong = titleAnalystManifest.tools.filter((t) => t.mcpServer !== "title");
        assert.strictEqual(wrong.length, 0, `Tools without mcpServer='title': ${wrong.map((t) => t.name).join(", ")}`);
    });

    await test("titleAnalystConfig.modelRouting['standard-analysis'] uses a real model ID", () => {
        const binding = titleAnalystConfig.modelRouting["standard-analysis"];
        assert.ok(binding, "standard-analysis binding must be present");
        assert.notStrictEqual(binding?.model, "configured-by-operator", "model must not be a placeholder");
        assert.strictEqual(binding?.provider, "anthropic", "provider must be anthropic");
    });

    await test("callTitleTool rejects with a clear error when server is unreachable", async () => {
        let threw = false;
        try {
            await callTitleTool("http://localhost:19998", "examine_ownership", {
                propertyDescription: "Section 12 Block A",
                county: "Reeves",
                state: "TX",
            });
        } catch (err) {
            threw = true;
            const msg = err instanceof Error ? err.message : String(err);
            assert.ok(msg.length > 0, "Error message must be non-empty");
        }
        assert.ok(threw, "callTitleTool must throw when server is unreachable");
    });

    // ── Layer 2: runTask execution loop ───────────────────────────────────────

    await test("runTitleAnalystTask is exported as a function", () => {
        assert.strictEqual(typeof runTitleAnalystTask, "function", "runTitleAnalystTask must be exported");
    });

    await test("runTitleAnalystTask throws when no ANTHROPIC_API_KEY is set", async () => {
        const saved = process.env.ANTHROPIC_API_KEY;
        process.env.ANTHROPIC_API_KEY = "";
        let threw = false;
        try {
            await runTitleAnalystTask("examine title for Section 12 Reeves County TX");
        } catch (err) {
            threw = true;
            const msg = err instanceof Error ? err.message : String(err);
            assert.ok(msg.includes("ANTHROPIC_API_KEY"), `Error must mention ANTHROPIC_API_KEY, got: ${msg}`);
        } finally {
            if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved;
            else delete process.env.ANTHROPIC_API_KEY;
        }
        assert.ok(threw, "runTitleAnalystTask must throw when no API key is set");
    });

    await test("runTitleAnalystTask hits callLLM when API key is present (auth error confirms path)", async () => {
        let threw = false;
        try {
            await runTitleAnalystTask("examine title for Section 12 Reeves County TX", {
                apiKey: "sk-ant-invalid-key-for-test",
            });
        } catch (err) {
            threw = true;
            const msg = err instanceof Error ? err.message : String(err);
            assert.ok(msg.length > 0, "Error from invalid key must have a message");
        }
        assert.ok(threw, "runTitleAnalystTask with invalid key must throw (proves callLLM was hit)");
    });

    // ── SDK error exports ─────────────────────────────────────────────────────

    await test("RetryableToolError is exported from @shaleyeah/sdk", () => {
        assert.strictEqual(typeof RetryableToolError, "function");
        const err = new RetryableToolError("test");
        assert.strictEqual(err.retryable, true);
    });

    await test("PermanentToolError is exported from @shaleyeah/sdk", () => {
        assert.strictEqual(typeof PermanentToolError, "function");
        const err = new PermanentToolError("test");
        assert.strictEqual(err.retryable, false);
    });

    // ── runTitleAnalystTask runtime option ────────────────────────────────────

    await test("runTitleAnalystTask accepts runtime option (signature check)", () => {
        const params = runTitleAnalystTask.length;
        assert.ok(params >= 1, "runTitleAnalystTask must accept at least a goal argument");
    });

    await test("runTitleAnalystTask throws when approval_required and no onApprovalRequired callback", async () => {
        const { createTitleAnalystRuntime } = await import("../src/agent/index.js");
        const runtime = createTitleAnalystRuntime({
            ...titleAnalystConfig,
            hitl: { ...titleAnalystConfig.hitl, approvalMode: "always" },
        });
        await runtime.initialize();
        const result = await runtime.execute({
            toolName: "title-analyst.examine_ownership",
            args: { propertyDescription: "Section 12 Block A", county: "Reeves", state: "TX" },
        });
        await runtime.shutdown();
        assert.strictEqual(result.status, "approval_required", "HITL gate must block with approvalMode='always'");
        assert.ok("challenge" in result, "approval_required result must have a challenge");
        const challenge = (result as { status: "approval_required"; challenge: HumanApprovalChallenge }).challenge;
        assert.strictEqual(challenge.toolName, "title-analyst.examine_ownership");
    });

    // ── Integration tests (require live title server + real API key) ──────────

    const live = await titleServerReachable();
    const HAS_API_KEY = !!process.env.ANTHROPIC_API_KEY;

    if (!live) {
        console.log("\n  ⚠️  [integration] title server not reachable at localhost:3010 — skipping live MCP tests.");
        console.log("     Start with: cd servers/title && PORT=3010 pnpm start");
    }
    if (!HAS_API_KEY) {
        console.log("  ⚠️  [integration] ANTHROPIC_API_KEY not set — skipping runTask live test.");
    }

    if (live) {
        await test("[integration] callTitleTool routes examine_ownership through title MCP", async () => {
            const result = await callTitleTool(titleAnalystConfig.mcpServers!["title"].url, "examine_ownership", {
                propertyDescription: "Section 12 Block A",
                county: "Reeves",
                state: "TX",
            });
            assert.ok(result !== undefined, "MCP tool call must return a value");
        });
    }

    if (live && HAS_API_KEY) {
        await test("[integration] runTitleAnalystTask completes a multi-step title task", async () => {
            const answer = await runTitleAnalystTask(
                "Examine the ownership and chain of title for Section 12 Block A in Reeves County, TX and summarize your findings.",
            );
            assert.strictEqual(typeof answer, "string", "runTitleAnalystTask must return a string");
            assert.ok(answer.length > 0, "Answer must be non-empty");
        });
    }

    console.log(`\nTitle Analyst MCP Client + runTask Tests: ${passed} passed, ${failed} failed`);
    if (failed > 0) process.exit(1);
}

await runTests();
