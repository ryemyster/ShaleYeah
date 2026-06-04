// Standalone demo — proves the geologist agent boots without kernel or orchestrator
import { createGeologistRuntime } from "./agents/geologist/src/agent/index.js";

const runtime = createGeologistRuntime();
await runtime.initialize();

const result = await runtime.execute({
	toolName: "geologist.assess_quality",
	args: { filePath: "demo-placeholder.las", dataType: "las" },
});

console.log("Demo result:", result.status);
console.log("Evals:", result.evals?.map((e) => `${e.check}: ${e.status}`));
await runtime.shutdown();
console.log("✅ Geologist agent demo complete");
