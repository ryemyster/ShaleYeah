# Changelog — employee runtime

## [Unreleased]

- #541: extract the verified scoped context, configured model/provider, metadata
  hooks and native session/runner adapters from the Geologist into an installable
  shared helper. Keep role factories and executing authority separate; preserve
  existing stored namespaces and interfaces through thin Geologist facades.
- #541: reject native factories that reintroduce old conversation contents or omit
  context selection, tool capture or sealed dispatch; direct independent role,
  credentials, restart, retention and configuration controls.
