// Explicit offline preload for tests only. The actual local launcher and native SDK adapters still execute.
import fs from "node:fs/promises";
import { parseReferenceModelConfig } from "@shaleyeah/sdk";

const config = JSON.parse(await fs.readFile(process.env.GEOWIZ_HTTP_CONFIG_FILE, "utf8"));
const profile = parseReferenceModelConfig(JSON.parse(await fs.readFile(config.modelConfigFile, "utf8"))).synthesis;
const key = (await fs.readFile(profile.credentialRef.slice(5), "utf8")).trim();
globalThis.fetch = async (resource, init) => {
	const url = new URL(resource instanceof Request ? resource.url : String(resource));
	if (url.origin !== profile.endpoint || init?.redirect !== "error") throw new Error("Fixture vendor boundary failed");
	const headers = new Headers(init.headers);
	if (headers.get(profile.provider === "gemini" ? "x-goog-api-key" : "x-api-key") !== key) throw new Error("Fixture credential boundary failed");
	const body = JSON.parse(String(init.body));
	if (profile.provider === "gemini" ? !url.pathname.includes(profile.model) : body.model !== profile.model) throw new Error("Fixture model boundary failed");
	await fs.appendFile(process.env.GEOWIZ_PROVIDER_FIXTURE_RECEIPT_FILE, `${JSON.stringify({ provider: profile.provider, model: profile.model, revision: profile.revision, requestObserved: true })}\n`, { mode: 0o600 });
	const output = { toc: 1.25, recommendation: "Controlled offline result requires human geological review" };
	const response = profile.provider === "gemini"
		? { candidates: [{ content: { role: "model", parts: [{ text: JSON.stringify(output) }] }, finishReason: "STOP" }], modelVersion: "fixture-native-001" }
		: { id: "fixture", type: "message", role: "assistant", model: "fixture-native-001", content: [{ type: "tool_use", id: "fixture-call", name: "submit_result", input: output }], stop_reason: "tool_use", usage: { input_tokens: 12, output_tokens: 16 } };
	return new Response(JSON.stringify(response), { headers: { "content-type": "application/json" } });
};
