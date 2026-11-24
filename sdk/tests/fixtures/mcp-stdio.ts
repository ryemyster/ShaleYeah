import { z } from "zod";
import { MCPServer } from "../../src/mcp-server.js";

class ProtocolFixture extends MCPServer {
	protected setupCapabilities(): void {
		this.registerTool({
			name: "echo",
			description: "Protocol control",
			inputSchema: z.object({ value: z.string() }),
			handler: async ({ value }) => ({ value }),
		});
	}
	protected async setupDataDirectories(): Promise<void> {}
}
const server = new ProtocolFixture({
	name: "protocol-fixture",
	version: "1",
	description: "Offline stdio fixture",
	persona: { name: "Fixture", role: "fixture", expertise: [] },
	dataPath: process.argv[2],
});
await server.initialize();
