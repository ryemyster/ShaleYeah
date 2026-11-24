import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { createModelRuntime, type ModelProfile } from "@shaleyeah/sdk";
import { synthesizeCompetitorAnalysisWithLLM } from "../src/analysis.js";
import { loadMarketBinding } from "../src/configuration.js";
import { createMarketTemplate } from "../src/index.js";
import { bundle, competitorQuery, NOW, narrative } from "./fixtures/evidence.js";
import { localBindingFixture } from "./fixtures/local-binding.js";

function profile(
	provider: "gemini" | "anthropic",
	purpose: "agent" | "synthesis" | "judge" = "synthesis",
): ModelProfile {
	return {
		version: "0.1.0",
		id: `market.${purpose}`,
		revision: "r1",
		purpose,
		owner: { customerId: "operator-fixture", employeeId: "employee.market-analyst" },
		provider,
		model: `${provider}-fixture-001`,
		modelRevision: "fixture-001",
		endpoint: provider === "gemini" ? "https://generativelanguage.googleapis.com" : "https://api.anthropic.com",
		credentialRef: `secret:market-${purpose}`,
		capabilities: { toolUse: true, structuredOutput: true },
		limits: { timeoutMs: 1000, maxAttempts: 1, maxOutputTokens: 1024, maxRequests: 2, maxInputChars: 262144 },
	};
}

for (const provider of ["gemini", "anthropic"] as const) {
	test(`configured ${provider} synthesis interprets permitted facts through the shared runtime`, async () => {
		const calls: unknown[] = [],
			secret = "synthetic-market-provider-key";
		const runtime = createModelRuntime(profile(provider), {
			resolveCredential: async (owner, reference, purpose) => {
				assert.deepEqual(owner, profile(provider).owner);
				assert.equal(reference, "secret:market-synthesis");
				assert.equal(purpose, "synthesis");
				return secret;
			},
			adapter: async (selected, credential, request) => {
				assert.equal(selected.provider, provider);
				assert.equal(credential, secret);
				assert.ok(!JSON.stringify(request).includes(secret));
				calls.push(selected);
				return { output: JSON.parse(narrative()) };
			},
		});
		const result = await synthesizeCompetitorAnalysisWithLLM(competitorQuery, {
			clock: () => new Date(NOW),
			readSources: async () => bundle,
			modelRuntime: runtime,
		});
		assert.equal(result[0].interpretation.status, "available");
		assert.equal(result[0].production, 0);
		assert.equal(result[0].commercialAuthority, false);
		assert.equal(calls.length, 1);
		assert.ok(!JSON.stringify(result).includes(secret));
	});
}

test("authenticated caller ownership is checked before advisory model credentials or source reads", async () => {
	let touched = false;
	const modelRuntime = createModelRuntime(profile("gemini"), {
		resolveCredential: async () => {
			touched = true;
			throw new Error("must not resolve");
		},
	});
	const tool = createMarketTemplate({
		modelRuntime,
		readSources: async () => {
			touched = true;
			return bundle;
		},
	}).tools.find((item) => item.name === "competitive_analysis")!;
	const denied = await tool.handler(
		{ competitors: ["Acme"], market: "Permian" },
		{
			principal: {
				subjectId: "foreign",
				customerId: "another-operator",
				employeeId: "employee.market-analyst",
				scopes: ["market:read"],
			},
		},
	);
	assert.equal(denied.success, false);
	assert.match(denied.error, /owner|scope|forbidden/i);
	assert.equal(touched, false);
});

test("private Market binding loads the owned synthesis profile and rejects another employee's model configuration", async () => {
	const f = await localBindingFixture();
	const file = path.join(f.root, "models.json");
	const config = { version: "0.1.0", agent: profile("gemini", "agent"), synthesis: profile("gemini"), judge: null };
	config.agent.credentialRef = config.synthesis.credentialRef = `file:${path.join(f.root, "access-key")}`;
	Object.assign(f.config, { modelConfigFile: file });
	await fs.writeFile(file, JSON.stringify(config), { mode: 0o600 });
	await f.write();
	try {
		const binding = await loadMarketBinding(f.file, { clock: f.clock });
		try {
			assert.equal(binding.modelRuntime!.publicProfile().provider, "gemini");
			config.synthesis.revision = "r2";
			await fs.writeFile(file, JSON.stringify(config));
			await assert.rejects(binding.service.inspect(f.ref(), binding.localPrincipal), /configuration/);
			await fs.writeFile(path.join(f.root, "access-key"), "");
			await assert.rejects(
				binding.modelRuntime!.generate({ prompt: "Interpret permitted evidence", schema: { type: "object" } }),
				/configuration_changed/,
			);
		} finally {
			binding.close();
		}
		config.agent.owner.employeeId = config.synthesis.owner.employeeId = "employee.foreign";
		await fs.writeFile(file, JSON.stringify(config));
		await assert.rejects(loadMarketBinding(f.file, { clock: f.clock }), /owner|scope|configuration/i);
	} finally {
		await f.close();
	}
});

test("configured model credentials are scanned in source exports even when not repeated in sensitiveFiles", async () => {
	const f = await localBindingFixture({ unsafeSource: true });
	const file = path.join(f.root, "models.json");
	const config = { version: "0.1.0", agent: profile("gemini", "agent"), synthesis: profile("gemini"), judge: null };
	config.agent.credentialRef = config.synthesis.credentialRef = `file:${path.join(f.root, "access-key")}`;
	Object.assign(f.config, { modelConfigFile: file, sensitiveFiles: [] });
	await fs.writeFile(file, JSON.stringify(config), { mode: 0o600 });
	await f.write();
	let binding: Awaited<ReturnType<typeof loadMarketBinding>> | undefined;
	try {
		binding = await loadMarketBinding(f.file, { clock: f.clock });
		await assert.rejects(binding.service.inspect(f.ref(), binding.localPrincipal), /unsafe_content/);
		assert.ok(!(await fs.readFile(f.config.auditFile, "utf8")).includes(f.secret));
	} finally {
		binding?.close();
		await f.close();
	}
});
