/** Capture actual backend output; provisional numeric labels remain independently frozen. */
import fs from "node:fs";
import { drillingFixture, ref, who } from "./drilling.js";

const labels = JSON.parse(fs.readFileSync(new URL("./case-labels.json", import.meta.url), "utf8"));
async function capture(caseId = "control_base") {
	const f = drillingFixture(),
		label = labels.find((v: { id: string }) => v.id === caseId);
	const values = { design: f.design, corpus: f.corpus, policy: f.calculationPolicy };
	for (const change of label.changes) {
		let target: Record<string, unknown> = values;
		for (const part of change.path.slice(0, -1)) target = target[part] as Record<string, unknown>;
		target[change.path.at(-1)] = structuredClone(change.value);
	}
	// The fixture author supplies matching original quote text for each changed synthetic quote.
	// These are inputs; neither expected numeric labels nor observed output is used to write them.
	if (caseId === "edge_explicit_zero_quote")
		f.corpus.documents[2].sections[0].text =
			"Synthetic quotation: rig 12.5 day at USD 20000 per day; casing 10000 ft at explicitly USD 0 per ft. Quoted scope excludes other costs and contingencies.";
	if (caseId === "edge_fractional_quote")
		f.corpus.documents[2].sections[0].text =
			"Synthetic quotation: rig 12.5 day at USD 20000 per day; casing 0.1 ft at USD 0.05 per ft. Operator-selected half-up cents applies to the exact scope total; excludes other costs and contingencies.";
	f.texts.set("design", JSON.stringify(f.design));
	f.texts.set("corpus", JSON.stringify(f.corpus));
	f.texts.set("policy", JSON.stringify(f.calculationPolicy));
	f.bind();
	for (const observation of f.proposal.observations)
		for (let i = 0; i < observation.citations.length; i++) {
			const selected = observation.citations[i],
				doc = f.corpus.documents.find(
					(d: { evidenceRef: { id: string } }) => d.evidenceRef.id === selected.evidenceRef.id,
				),
				section = doc.sections.find((s: { sectionId: string }) => s.sectionId === selected.sectionId);
			observation.citations[i] = (
				await f.service.cite(
					ref,
					{ evidenceRef: selected.evidenceRef, sectionId: selected.sectionId, quote: section.text },
					who,
				)
			).citation;
		}
	const result = await f.service.draft(ref, f.proposal, "r1", who);
	return {
		work: result.work,
		drilling: result.drilling,
		sourceArtifacts: result.sourceArtifacts,
		design: f.design,
		corpus: f.corpus,
		policy: f.calculationPolicy,
		evaluatedAt: "2026-11-23T12:00:00Z",
	};
}
const result = process.argv.includes("--variants")
	? Object.fromEntries(
			await Promise.all(
				["control_metric_equivalent", "edge_explicit_zero_quote", "edge_fractional_quote"].map(async (id) => [
					id,
					await capture(id),
				]),
			),
		)
	: await capture();
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
