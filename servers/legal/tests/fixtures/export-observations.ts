/** Synthetic wire records only; independent expected decisions live in evaluation-cases.json. */
import { legalFixture, ref, who } from "./legal.js";

async function capture(fixture: ReturnType<typeof legalFixture>) {
	fixture.texts.set("matter", JSON.stringify(fixture.matter));
	fixture.texts.set("corpus", JSON.stringify(fixture.corpus));
	fixture.texts.set("policy", JSON.stringify(fixture.scopePolicy));
	fixture.bind();
	const result = await fixture.service.draft(ref, fixture.proposal, "r1", who);
	return {
		work: result.work,
		legal: result.legal,
		sourceArtifacts: result.sourceArtifacts,
		matter: fixture.matter,
		corpus: fixture.corpus,
		policy: fixture.scopePolicy,
	};
}
const fixture = legalFixture();
let output: unknown;
if (process.argv.includes("--variants")) {
	const territorial = legalFixture();
	territorial.matter.territoryId = "indian-country";
	territorial.proposal.issues[3].kind = "exception";
	territorial.proposal.issues[3].statement =
		"The supplied rule retains EPA permitting authority for Indian country; the state-program grant does not cover this declared territory.";
	territorial.proposal.issues[3].citations = [territorial.quotes["indian-exception"]];
	const historical = legalFixture();
	historical.proposal.issues[3].kind = "conflict";
	historical.proposal.issues[3].statement =
		"Counsel should reconcile the expired internal note with the historical primary rule; this memo retains both provisions without deciding legal clearance.";
	historical.proposal.issues[3].citations = [historical.quotes["state-grant"], historical.quotes["prior-counsel"]];
	historical.scopePolicy.conflicts.push({
		conflictRef: { id: "conflict.authority", revision: "r1" },
		questionRef: { id: "question.authority", revision: "r1" },
		provisions: historical.proposal.issues[3].citations.map(({ documentRef, sectionId }) => ({
			documentRef,
			sectionId,
		})),
	});
	output = { "indian-country": await capture(territorial), "historical-context": await capture(historical) };
} else {
	output = await capture(fixture);
}
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
