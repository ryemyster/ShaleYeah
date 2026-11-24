# Deployment

Build and run the TypeScript MCP server with Node >=22.13. The README shows
repository setup. The standalone check exports the QA package plus its declared
SDK and contract archives, installs a clean source copy, and installs the
production package separately. It does not depend on another employee package.

`QA_CONFIG_FILE` selects an absolute owner-only JSON file. Its
`sourceAuthority: operator-attested-export` explicitly means a local operator
attests upstream task/profile/source rights; it is not a remote authorization
service. The fixture generator shows the supported schema. Sources contain
base64-encoded exact normalized/work-product bytes and their existing SHA-256,
revision, observation time, usage policy and recipient grants. Base64 is only
transport encoding, never encryption or a raw petroleum parser.

The configuration and sensitive files must be owner-only regular files.
The result directory is private; `auditFile` must be a direct child of it.
The configuration fixes the OS user, task scope/revision, storage/audit paths and
correlation context. Start a new binding when those change. Current source,
profile and grant data are reread on access. `current: false`, expiry, denied
sharing or a changed version blocks reuse. An operator controls this local file;
use a trusted hosted authority for stronger separation between identities.

Optional `modelsFile` uses the shared versioned provider configuration. Only its
explicit synthesis profile is used for QA triage. Gemini and Anthropic use the
shared native adapters; credentials are resolved from owner-only file references.
List other sensitive values in `sensitiveFiles`, also as private file paths.
Do not place keys in data, prompts, grants or logs. No provider key is needed for
deterministic checks, reports, or fixture qualification.

Limits are 256 rules, 64 source snapshots, 10,000 rows per source, 8 MB per source,
8 MB for the private configuration/result artifact, 100 defect details per rule,
and 1,000 retained artifacts by default. Result retention defaults to one hour
and cannot exceed a day or the original grant expiry. Expired results are removed
on subsequent store operations; operators own backup/offline retention. The MCP
request timeout defaults to 30 seconds and can be configured by the host up to
120 seconds. Cancellation prevents late source resolution from storing a result.

To export a portable install bundle and metadata report:

```sh
node servers/qa-server/scripts/check-extraction.mjs --bundle /private/tmp/qa-bundle --report /private/tmp/qa-extraction.json
```

The bundle destination must be empty. It includes archives, a production lock,
a clean source check and installed checks. `Dockerfile` builds from that bundle
and runs as user 10001. Container qualification is a separate required CI check;
its report identifies the tested image, runtime and fixture boundaries. The default container launcher uses a privately configured loopback HTTP
endpoint; the public entry still supports stdio. A remote HTTP deployment supplies its own trusted
SDK access adapter and live artifact/source authority; no cloud platform is hardcoded.

The optional `review` object declares `policy`, `dispositionPolicy`,
`localReviewer` and `qualificationConfigFile`. The review policy binds the same
canonical task and requester, allowed source usage/context/retention policies and
separately enrolled reviewers. Disposition policy lists allowed actions, repair
owners, maximum expiry and whether critical exceptions may be reviewed. The
qualification file selects the installed verifier, exact code revision and owned
evidence/policy files. An enrolled operator inspects through
`node examples/review.mjs inspect REVIEW_ID NEW_PRIVATE_PACKET_FILE`, then decides
through `decide REVIEW_ID PACKET_DIGEST approve|reject|request_changes PRIVATE_REASON_JSON`.
A compatible agent can request review and resume a granted disposition, but cannot
make the human decision. Private local files are owner attestations; hosted
authorities may inject separate enterprise identities.
