# Deploy Title Analyst

Run the independently installed Python employee and Title MCP backend as separate units. Python >=3.11,<3.14 is declared; CI uses 3.12. Set explicit model profiles and private credential references, a reachable protected MCP URL, private event configuration and durable context storage. No provider or deployment target is hardcoded in employee reasoning.

The extraction check builds independent source exports, employee/helper wheels and backend/helper npm archives. It installs each unit with its declared dependencies and records artifact and lock hashes. The backend's qualification verifier installs contract/evaluation wheels without the employee implementation.

```sh
node servers/title/scripts/check-extraction.mjs --bundle /absolute/empty/title-bundle --report /absolute/private/extraction.json
```

Run that command from the repository root. It requires dependency access and a host that permits the HTTP integration tests. The independent checks cover both offline provider adapters, source/review/context restart, exact qualified human approval, idempotent recording and source revocation. After a production-only npm install, a plain JavaScript MCP client reads and drafts the synthetic packet against the installed backend archive.

Install the employee wheel and its declared helper wheels in a dedicated Python environment. Install the backend archive and its declared helper archives separately. The employee receives a protected MCP endpoint and private credential references; the backend owns the operator-source bindings and private review/qualification files. Preserve context, review and audit state with their owner permissions and retention settings across restart. A different host, issuer or TLS setup needs its own qualification. Hosting adapters, professional correctness and real operator acceptance remain unverified until separately demonstrated.
