import { z } from "zod";
import { MCPServer } from "../../../dist/index.js";

class FixtureServer extends MCPServer {
	setupCapabilities() {
		this.registerTool({
			name: "echo",
			description: "Echo a synthetic protocol fixture",
			inputSchema: z.object({ value: z.string() }).strict(),
			outputSchema: z.object({ value: z.string() }).strict(),
			handler: async ({ value }) => ({ value }),
		});
	}
	async setupDataDirectories() {}
}

process.env.PORT = "0";
const server = new FixtureServer({
	name: "python-stateless-client-fixture",
	version: "0.0.0",
	description: "Independent protocol fixture only",
	persona: { name: "Fixture", role: "fixture", expertise: [] },
	dataPath: process.env.SHALE_FIXTURE_DIRECTORY,
	http: {
		access: {
			mode: "local",
			accessToken: process.env.SHALE_FIXTURE_TOKEN,
			allowedHosts: ["127.0.0.1"],
			principal: { subjectId: "fixture-owner", customerId: "fixture", employeeId: "fixture", scopes: ["fixture:connect", "fixture:echo"] },
			policy: { id: "fixture", version: "r1", connectionScopes: ["fixture:connect"], toolScopes: { echo: ["fixture:echo"] }, resourceScopes: {} },
			audit: () => {},
		},
	},
});
await server.initialize();
console.log(`http://127.0.0.1:${server.httpPort()}/mcp`);
process.once("SIGTERM", () => void server.stop());
