# Testing the Legal backend locally

From this directory:

```sh
pnpm build
pnpm type-check
pnpm lint
pnpm test
```

The generic protocol test launches the compiled stdio entry as a separate process. It discovers tools, reads real owner-only operator exports, computes an exact Unicode citation, prepares review, invokes the separate human CLI, restores review state and rejects revoked access. It needs no TCP listener or model key.

Focused source/review tests cover current grants, changed bytes, quote identity, provision scope/effective dates, required question/source/conflict coverage, request changes, rejection, approval, replay and restart. Workflow unit tests use an explicit qualification double; the human CLI test confirms that a missing installed qualification cannot approve.

For the native employee checks, install its locked Python package and follow [Legal Analyst local testing](../../../agents/legal-analyst/docs/LOCAL_TESTING.md). Offline provider fixtures are distinct from live-model quality evaluation. Bind-dependent HTTP and independent packaging/container controls remain required integration checks for the final artifact; a local environment restriction does not turn them into a pass.
