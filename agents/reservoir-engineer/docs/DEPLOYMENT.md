# Deployment and packaging

The employee is an independently installable Python wheel with declared helper
dependencies. Its source package can use an independent lock pointing to those
wheels. Curve-smith is a separate tool-server artifact; neither unit requires the
optional coordinator or a particular cloud host.

The [extraction checker](../../../servers/curve-smith/scripts/check-extraction.mjs)
builds source, wheel and production tool archives outside the checkout. The
[container checker](../../../servers/curve-smith/scripts/check-containers.py)
uses separate employee/tool images, explicit configuration, non-root users,
actor-specific mounts and protected review/restart/revocation journeys. Run it
against a fresh extraction bundle and inspect exact artifact/image receipts
before claiming an environment is qualified.

The Dockerfile builds from that bundle without baking source data or secrets
into the image. The production host supplies private context storage, current
identity/source authorities, model configuration and a separately enrolled human
review boundary. No cloud deployment or live vendor connector is provisioned.
See the repository [support guide](../../../docs/deployment-support.md) for
qualification evidence and explicitly deferred targets.
