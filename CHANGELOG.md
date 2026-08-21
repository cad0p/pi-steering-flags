# Changelog

All notable changes to `pi-steering-flags` are documented in this file.

## [Unreleased]

Split out of the cad0p/pi-steering monorepo into its own repository (2026-08-10). Pre-publish package (0.0.0-poc.0).

### Added

- `getLastFlagValue(args, flags)` helper — last-flag-wins variant of `getFlagValue` for gh/cobra-style CLIs where the LAST occurrence of a flag (or any alias in a set like `["-t", "--subject"]`) wins (closes #12).
