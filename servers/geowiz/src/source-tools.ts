import { type ConnectorRuntime, SourceAccessError, type SourcePrincipal } from "@shaleyeah/connectors";
import { type MCPExecutionContext, ModelProviderError, ServerFactory } from "@shaleyeah/sdk";
import { LASInputError } from "./tools/las-parse.js";

interface SourceBinding {
	sourceRuntime?: ConnectorRuntime;
	localSourcePrincipal?: SourcePrincipal;
}

export async function withSourceErrors<T>(run: () => Promise<T>) {
	try {
		return await run();
	} catch (error) {
		if (error instanceof LASInputError)
			return {
				success: false,
				error: error.message,
				inputError: { code: error.code, ...(error.line === undefined ? {} : { line: error.line }) },
				error_type: "permanent",
			};
		if (!(error instanceof SourceAccessError)) throw error;
		return {
			success: false,
			error: error.message,
			sourceError: { code: error.code },
			error_type:
				error.code === "access_denied" || error.code === "authority_denied" || error.code === "scope_mismatch"
					? "auth_required"
					: error.code === "source_unavailable"
						? "retryable"
						: "permanent",
		};
	}
}

export function createSourceAnalysisTool(
	options: SourceBinding,
	beforeQuery?: (name: string, context?: MCPExecutionContext) => void,
): typeof ServerFactory.createAnalysisTool {
	return (name, description, schema, analyze, toolOptions) =>
		ServerFactory.createAnalysisTool(
			name,
			description,
			schema,
			async (args, context, signal) =>
				withSourceErrors(async () => {
					beforeQuery?.(name, context);
					const sources = options.sourceRuntime;
					const principal = context?.principal ?? options.localSourcePrincipal;
					if (!sources || !principal) throw new SourceAccessError("access_denied");
					if (args.outputPath !== undefined) throw new SourceAccessError("unsupported_capability");
					if (
						!["analyze_formation", "process_well_logs", "assess_quality"].includes(name) ||
						(name === "assess_quality" && args.dataType !== "las") ||
						(name === "process_well_logs" && !["auto", "las"].includes(args.format))
					)
						throw new SourceAccessError("unsupported_capability");
					const result = await sources.fetch(sources.requestForPath(args.filePath), principal, signal);
					if (result.artifact.format !== "las") throw new SourceAccessError("unsupported_capability");
					return sources.withSnapshot(
						result,
						principal,
						async (filePath) => {
							try {
								const {
									fileInfo: _fileInfo,
									fileMetadata: _fileMetadata,
									...analysis
								} = await analyze({ ...args, filePath }, context, signal);
								return { ...analysis, sourceArtifact: result.artifact };
							} catch (error) {
								if (error instanceof LASInputError)
									return {
										success: false,
										error: error.message,
										inputError: { code: error.code, ...(error.line === undefined ? {} : { line: error.line }) },
										error_type: "permanent",
										sourceArtifact: result.artifact,
									};
								if (error instanceof ModelProviderError) throw error;
								throw new SourceAccessError("source_unavailable");
							}
						},
						signal,
					);
				}),
			toolOptions,
		);
}
