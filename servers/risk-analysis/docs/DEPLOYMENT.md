# Running Risk Analysis
Compile this independent backend with `pnpm build`. The package-local TypeScript config and declared archives allow a clean exported-source build.

Stdio uses `RISK_ANALYSIS_CONFIG_FILE=/absolute/private/binding.json pnpm start`. The binding supplies source/task authority and the local operator; an unconfigured process exposes no analysis tools.

For explicit local HTTP, set `RISK_ANALYSIS_HTTP_CONFIG_FILE` and run `node examples/local-http.mjs`. That private JSON names `riskConfigFile`, `accessTokenFile`, `eventConfigFile` and `dataPath`. The access credential must be included in the source scanner's private sensitive-file references. HTTP binds loopback and requires identity/scopes plus audit; a port is not authorization. Remote hosts inject their own trusted ingress/source/review authorities and TLS policy.

The Dockerfile builds from the [extraction bundle](../scripts/check-extraction.mjs), using a Node tool image with an installed Python verifier and a separate employee image. Images declare non-root user 10001. Qualification uses owner-specific mounts, no new privileges, read-only roots and separate credential visibility. Required hosted CI validates the full source/review/restart journey before merge.

Public/internal normalized snapshot hooks are available for host integrations. Vendor-native API access and redistribution rights remain unverified. Paid sources, a specific cloud, a warehouse, vector storage and the coordinator are optional. Hosted-platform certification needs its own evidence; these container recipes do not establish it.
