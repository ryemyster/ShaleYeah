# Changelog — employee runtime

## [Unreleased]

- #757: bind exports to the captured task, raw checkpoint and record metadata;
  finish revision, integrity and deadline checks after the final awaited grant.
  Deny expired, replaced, deleted or corrupt checkpoint content, retain the
  permitted invalidated projection and preserve the existing source-call bounds.
  Add export/restore, final-callback and metadata-rebinding controls.

- #755: bound shared dependency traversal within explicit authorization phases,
  checking every record-to-source binding and current metadata/integrity again
  before delivery. Start fresh after content checks, token counting and at each
  separate delivery/write/export boundary. Reject corrupt transitive bodies and
  source revocation during a content guard; retain source identities and grants.

- #541: extract the verified scoped context, configured model/provider, metadata
  hooks and native session/runner adapters from the Geologist into an installable
  shared helper. Keep role factories and executing authority separate; preserve
  existing stored namespaces and interfaces through thin Geologist facades.
- #541: reject native factories that reintroduce old conversation contents or omit
  context selection, tool capture or sealed dispatch; direct independent role,
  credentials, restart, retention and configuration controls.
