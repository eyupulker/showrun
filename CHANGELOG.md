# Changelog

All notable changes are logged here. New entries go at the top of the `Unreleased` section.
When a version is released, rename `Unreleased` to the version number and date, then add a fresh `Unreleased` heading.

Entry format: `- [tag] Description of change`
Tags: `added`, `fixed`, `changed`, `removed`

---

## Unreleased

- [added] `agent.debug` config option (`SHOWRUN_DEBUG` env var) — debug flag can now be set via config.json in addition to `--debug` CLI flag
- [added] CHANGELOG.md and CLAUDE.md rule requiring changelog entries for every change
- [added] `--debug` flag for dashboard — gates failed tool call logging behind a flag instead of always writing to disk
- [changed] Dashboard UI restyled to match brand guidelines (colors, typography, CSS variables)
