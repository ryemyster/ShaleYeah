import { type MCPServer, ServerFactory, type ServerRuntimeOptions, type ServerTemplate } from "@shaleyeah/sdk";
import { type DrillingEmployeeOptions, drillingEmployeeTools } from "./employee-tools.js";

export type DrillingServerOptions = DrillingEmployeeOptions & ServerRuntimeOptions;
export function createDrillingTemplate(options: DrillingServerOptions = {}): ServerTemplate {
	return {
		name: "drilling",
		description: "Supplied drilling options and evidence packets with exact private engineer review",
		persona: {
			name: "Perforator Maximus",
			role: "Source-backed drilling engineering tooling",
			expertise: [
				"Supplied well/design option evidence",
				"Explicit MD/TVD, units and datums",
				"Exact quoted costs and sequential schedules",
				"Hazard and offset evidence coverage",
				"Private packets for engineer review",
			],
		},
		directories: [],
		tools: drillingEmployeeTools(options),
	};
}
export const DrillingServer = function (options: DrillingServerOptions = {}) {
	if (!new.target) throw new Error("Drilling Server requires constructor invocation");
	const server = new (ServerFactory.createServer(createDrillingTemplate(options)))(options);
	const stop = server.stop.bind(server);
	server.stop = async () => {
		try {
			await stop();
		} finally {
			options.close?.();
		}
	};
	return server;
} as unknown as { new (options?: DrillingServerOptions): MCPServer };
