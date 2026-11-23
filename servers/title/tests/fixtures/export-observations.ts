/** Actual synthetic backend observations. Frozen Fraction oracles remain independently authored. */
import { ref, titleFixture, who } from "./title.js";

async function capture(f: ReturnType<typeof titleFixture>) {
	f.texts.set("examination", JSON.stringify(f.examination));
	f.texts.set("corpus", JSON.stringify(f.corpus));
	f.texts.set("policy", JSON.stringify(f.calculationPolicy));
	f.bind();
	for (const observation of f.proposal.observations) {
		for (let index = 0; index < observation.citations.length; index++) {
			const selected = observation.citations[index];
			const document = f.corpus.documents.find(
				(doc: { instrumentRef: { id: string } }) => doc.instrumentRef.id === selected.instrumentRef.id,
			);
			const section = document.sections.find((part: { sectionId: string }) => part.sectionId === selected.sectionId);
			const result = await f.service.cite(
				ref,
				{
					instrumentRef: selected.instrumentRef,
					sectionId: selected.sectionId,
					quote: section.text,
				},
				who,
			);
			observation.citations[index] = result.citation;
		}
	}
	const result = await f.service.draft(ref, f.proposal, "r1", who);
	return {
		work: result.work,
		title: result.title,
		sourceArtifacts: result.sourceArtifacts,
		examination: f.examination,
		corpus: f.corpus,
		policy: f.calculationPolicy,
		evaluatedAt: "2026-11-18T12:00:00Z",
	};
}

function secondTransfer(basis: "fraction-of-grantor" | "fraction-of-whole") {
	const f = titleFixture();
	const first = f.corpus.documents[1];
	const second = structuredClone(first);
	second.instrumentRef = { id: "instrument.second", revision: "r1" };
	second.recordingId = "FICTION-003";
	second.sequence = 2;
	second.predecessorRefs = [structuredClone(first.instrumentRef)];
	second.sections[0].text = `Fictional second conveyance: Élodie 🛢 LLC conveys 1/2 ${basis} of shallow operating rights to the supplied party.c. No title clearance.`;
	second.transfers[0].transferId = "transfer.second";
	second.transfers[0].granteeId = "party.c";
	second.transfers[0].basis = basis;
	f.corpus.documents[2].sequence = 3;
	f.corpus.documents.push(second);
	f.examination.requiredInstrumentRefs.push(structuredClone(second.instrumentRef));
	f.proposal.observations[1].citations.push({ ...f.quotes.transfer, instrumentRef: second.instrumentRef });
	return f;
}

let output: unknown;
if (process.argv.includes("--variants")) {
	const wi = titleFixture(),
		zero = titleFixture();
	wi.corpus.documents[2].burdens[1].basis = "working-interest";
	wi.corpus.documents[2].sections[1].text =
		"Fictional supplied ORRI: 1/16 of Cobalt Example LLC's working interest in the shallow band, explicitly not 1/16 of the whole.";
	zero.corpus.documents[2].burdens[1].share = "0/1";
	zero.corpus.documents[2].sections[1].text =
		"Fictional supplied schedule explicitly states a zero ORRI, 0/1 of the whole, in the shallow band.";
	output = {
		"wi-relative-orri": await capture(wi),
		"second-grantor-transfer": await capture(secondTransfer("fraction-of-grantor")),
		"second-whole-transfer": await capture(secondTransfer("fraction-of-whole")),
		"zero-orri": await capture(zero),
	};
} else {
	output = await capture(titleFixture());
}
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
