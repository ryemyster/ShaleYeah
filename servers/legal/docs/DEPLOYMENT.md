# Deploying the Legal backend

Build this TypeScript unit and its installed shared dependencies independently. Run compiled stdio for a local MCP client, or embed `LegalServer` in a host with explicit HTTP identity/scope, credential and audit configuration. No cloud, gateway or orchestrator is mandatory.

Supply `LEGAL_CONFIG_FILE` for owner-only local operator exports. Keep source files, binding, scanner references, audit state and durable review/qualification data private and persist them across restart. Local enrollment is operator-attested source/reviewer authority; hosted deployments should inject their own current identity, source and policy callbacks.

The backend needs no model key. The paired Legal Analyst configures its own provider credentials separately. Paid source connectors and native vendor mappings are not qualified by a normalized snapshot fixture.

Before deployment, verify the exact built artifact with package tests, native/backend interoperability, installed job qualification, current human review and isolated package/container checks. Revalidate source and reviewer authority on restart and execution. A private advisory record grants no legal clearance, professional acceptance, signature, filing or capital authority.
