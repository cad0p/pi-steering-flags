# Changelog

All notable changes to `pi-steering-flags` are documented in this file.

## [Unreleased]

- **Breaking**: removed the `INFO_ONLY` string-level regex export. It wrongly exempted rules when a help token appeared inside a QUOTED VALUE (e.g. `gh pr merge --subject "see --help"` → normalized string matched → real merge wrongly allowed). Replaced by token-level, quote-aware info-only detection: the `isInfoOnly(args, extraFlags?)` helper and the `when.infoOnly` predicate (default set `--help` / `--version` only; `-h` / `-v` deliberately excluded since they are real operations in `docker run -v`, `curl -v`, `kubectl -v 8`, `psql -h host`; additive `extraFlags` only — nothing can remove the safe core). Carve-out idiom: `when: { not: { infoOnly: true } }`.

- Split out of the cad0p/pi-steering monorepo into its own repository (2026-08-10). Pre-publish package (0.0.0-poc.0).
