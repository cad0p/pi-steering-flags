# Changelog

All notable changes to this project will be documented in this file.

## [calver-released]

<!-- USER-EDITABLE SECTION START -->
<!-- Add your curated release notes here. -->
<!-- USER-EDITABLE SECTION END -->

### 🚀 Features

- Opt-in gluedShorts for hasFlag/getFlagValue — glued short-flag values (closes #11)

### ⚙️ Miscellaneous Tasks

- Delete promoted flag primitives, repoint to core root (closes #23)


## [0.1.1] - 2026-08-24

<!-- USER-EDITABLE SECTION START -->
### ⚠️ Breaking Changes

- **`getFlagValue` is now last-flag-wins and alias-aware**: repeated scalar flags resolve to the last occurrence (matching argparse/pflag/clap), and `flags` accepts an array of aliases OR-ed per position. The planned `getLastFlagValue` sibling was dropped — migrate cross-alias lookups to `getFlagValue(args, ["-R", "--repo"])`. (closes #12)
<!-- USER-EDITABLE SECTION END -->

### 🚀 Features

- Token-level info-only detection — isInfoOnly + when.infoOnly (closes #13)
- GetFlagValue goes last-flag-wins and alias-aware (closes #12)
- When.requiresFlagValue — declarative last-flag-value-matches predicate (closes #17)

### 🐛 Bug Fixes

- Approve peer-graph build scripts (@google/genai, protobufjs) in pnpm-workspace.yaml ([#4](https://github.com/cad0p/pi-steering-flags/pull/4))
- Workspace policies + node_modules-based type resolution for registry tests ([#9](https://github.com/cad0p/pi-steering-flags/pull/9))

### 📚 Documentation

- Add PUBLISHING.md (scoped @cad0p publish + semver-calver-release flow) ([#10](https://github.com/cad0p/pi-steering-flags/pull/10))

### 🎨 Styling

- Biome format + organizeImports after scoped-rename edits ([#6](https://github.com/cad0p/pi-steering-flags/pull/6))


## [Unreleased]

- Split out of the cad0p/pi-steering monorepo into its own repository (2026-08-10). Pre-publish package (0.0.0-poc.0).
