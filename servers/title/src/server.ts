import { type MCPServer, ServerFactory, type ServerRuntimeOptions, type ServerTemplate } from "@shaleyeah/sdk";
import { type TitleEmployeeOptions, titleEmployeeTools } from "./employee-tools.js";

export type TitleServerOptions = TitleEmployeeOptions & ServerRuntimeOptions;
export function createTitleTemplate(options: TitleServerOptions = {}): ServerTemplate {
	return {
		name: "title",
		description: "Supplied-instrument ownership and exception packets with exact private human review",
		persona: {
			name: "Titulus Verificatus",
			role: "Source-backed title diligence tooling",
			expertise: [
				"Exact instrument and tract identity",
				"Explicit rational ownership and burden bases",
				"Depth-scoped interests and source gaps",
				"Private packets for qualified human review",
			],
		},
		directories: [],
		tools: titleEmployeeTools(options),
	};
}
export const TitleServer = function (options: TitleServerOptions = {}) {
	if (!new.target) throw new Error("Title Server requires constructor invocation");
	const server = new (ServerFactory.createServer(createTitleTemplate(options)))(options);
	const stop = server.stop.bind(server);
	server.stop = async () => {
		try {
			await stop();
		} finally {
			options.close?.();
		}
	};
	return server;
} as unknown as { new (options?: TitleServerOptions): MCPServer };
