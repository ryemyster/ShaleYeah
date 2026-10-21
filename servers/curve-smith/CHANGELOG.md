# Changelog — @shaleyeah/server-curve-smith

## [Unreleased]

- Replace fixed-tier type curves and fabricated P10/P50/P90 values with versioned
  analog-rate fitting or explicit scenarios. Preserve source/synthetic labels,
  fit diagnostics and unavailable uncertainty. (#712)
- Use one finite Arps volume kernel with declared daily-rate/time units, horizon
  and economic cutoff; cover exponential/harmonic/zero and floating-point limits.
  Delete the wrong cumulative helper, implicit gas/oil conversion and its outer
  file-error tier fallback. Wider file fitting remains assigned to #681.
- Keep optional host-configured model interpretation separate from numerical
  outputs and authority. Replace SDK-only/copied-prompt tests with owning
  numerical, handler and independent stdio controls; use a package-local runner.

## [0.1.0] — 2026-06-04

### Added
- Initial package extraction from monorepo conversion (#385)
- Migrated from `src/servers/curve-smith.ts`
