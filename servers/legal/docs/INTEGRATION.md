# Integrating the Legal backend

Import `LegalServer` with explicit service/review/transport options, or run the compiled stdio entry with `LEGAL_CONFIG_FILE` pointing to a private binding. Starting without a binding advertises no analysis tools. The [input contract](INPUTS.md) defines the operator exports and local authority model.

For hosted use, inject current task/source/grant and review-policy callbacks into `LegalMemoService` and `LegalReviewWorkflow`. Configure the installed MCP server's HTTP identity, scopes, credential and required event policies separately. Transport authority cannot come from tool arguments or retrieved text. Use HTTPS for remote endpoints.

The model-facing surface can discover/read/compare sources, draft a memo, prepare review, read review status and execute a valid exact recording grant. Human decisions are separate:

```sh
node examples/review.mjs inspect REVIEW_ID NEW_PRIVATE_PACKET_FILE
node examples/review.mjs decide REVIEW_ID PACKET_DIGEST request_changes PRIVATE_REASON_JSON
node examples/review.mjs decide REVIEW_ID PACKET_DIGEST reject PRIVATE_REASON_JSON
node examples/review.mjs decide REVIEW_ID PACKET_DIGEST approve PRIVATE_REASON_JSON
```

Set `LEGAL_CONFIG_FILE` before running these commands. The current OS account must match the separately enrolled reviewer and its review policy. Inspection writes a new owner-only file and will not overwrite an existing path. The reason JSON contains `reason` and optional nonnegative `humanReviewSeconds`/`corrections`; measurements are supplied observations, not inferred savings.

Approval additionally requires current installed qualification configured by the operator's `review.qualificationConfigFile`. A model's evaluation claims do not replace it. `LegalReviewWorkflow` also exposes prepare/inspect/decide/status/execute for a host-controlled interface. Changes to source/work/context/policy revisions require fresh review; repeated authorized execution returns the same stored private record, and revoked authority is still rejected.

Snapshot hooks accept host-selected normalized public/internal JSON under current rights and separate credential references. Tool callers cannot supply an arbitrary endpoint. Paid vendor access, native PDF interpretation, redistribution rights and legal correctness require separate evidence.
