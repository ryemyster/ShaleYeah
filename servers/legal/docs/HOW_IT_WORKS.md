# How the Legal backend works

The backend loads three authorized exact JSON sources: matter/questions, versioned document provisions and a review checklist with declared conflicts. It preserves document revisions, source kinds, jurisdiction/territory/activity IDs and legal as-of dates. It does not infer jurisdiction hierarchies or treat retrieval time as an effective date.

A provision's effective interval starts inclusively at `effectiveFrom` and ends exclusively at `effectiveUntilExclusive`. Unknown dates, unverified sources and scope/date mismatches make that provision ineligible for an affirmative requirement or exception. Historical text may remain disclosed context for a question/conflict; each required question still needs an eligible required-source anchor.

Quote lookup computes exact UTF-8 byte spans and SHA-256 from selected text. Provision paging counts Unicode code points, which are different from citation byte offsets. The proposed memo must preserve all required questions/document revisions and both sides of declared conflicts. Gaps produce blocked work, not invented completion.

Canonical `work` and `legal` remain unreviewed and preserve `legalClearance: false` and `professionalAcceptance: false`. A separately enrolled human inspects the exact private packet and decides whether to request changes, reject or approve its recording. Installed qualification and current source rights are checked at the executing boundary; restart and native confirmation cannot bypass them.

A valid citation proves source identity, not the correctness or materiality of the proposed legal interpretation. That judgment remains with qualified humans and optional configured semantic rubrics.
