import { type MCPServer, ServerFactory, type ServerRuntimeOptions, type ServerTemplate } from "@shaleyeah/sdk";
import { type LegalEmployeeOptions, legalEmployeeTools } from "./employee-tools.js";

export type LegalServerOptions = LegalEmployeeOptions & ServerRuntimeOptions;
export function createLegalTemplate(options: LegalServerOptions = {}): ServerTemplate {
	return {
		name: "legal",
		description: "Source-cited requirement/exception memos with exact human legal review",
		persona: {
			name: "Legatus Juridicus",
			role: "Source-cited legal diligence tooling",
			expertise: [
				"Exact source revisions and citations",
				"Declared jurisdiction and effective dates",
				"Private memos for qualified human review",
			],
		},
		directories: [],
		tools: legalEmployeeTools(options),
	};
}
export const LegalServer = function (options: LegalServerOptions = {}) {
	if (!new.target) throw new Error("Legal Server requires constructor invocation");
	const server = new (ServerFactory.createServer(createLegalTemplate(options)))(options);
	const stop = server.stop.bind(server);
	server.stop = async () => {
		try {
			await stop();
		} finally {
			options.close?.();
		}
	};
	return server;
} as unknown as { new (options?: LegalServerOptions): MCPServer };
