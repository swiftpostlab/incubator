---
name: ref-sp-dev-config-package
description: "SwiftPost shared config package overview. Use when: editing packages/config, adjusting shared ESLint or TypeScript config, or deciding whether tooling rules belong in the config package."
metadata:
  shareable-skills.owner-prefix: "sp"
  shareable-skills.owner: "swiftpostlab/incubator"
  shareable-skills.domain: "dev"
  shareable-skills.visibility: "repo-local"
  shareable-skills.reason: "This skill documents this repo's local packages/config workspace."
---

# Incubator Config

## Purpose

Clarify the role of `packages/config` as the shared tooling package for linting and TypeScript configuration. Use this skill when a change affects reusable repo tooling rather than application behavior.

## When to use this skill

- Editing files in `packages/config`.
- Changing shared ESLint or TypeScript defaults.
- Deciding whether a tooling rule belongs in package config or in an app/package implementation.

## Package Responsibility

`packages/config` owns reusable lint and TypeScript configuration for the monorepo.

- Keep shared ESLint config in `eslint.config.mjs` and `eslintBaseConfig.mjs`.
- Keep shared TS defaults in `tsconfig.json` and `tsconfigBase.json`.
- Do not put app logic, UI code, or Next.js page behavior in this package.

## Change Guidelines

- Favor changes that benefit multiple packages rather than one-off app workarounds.
- If a rule is only needed by one package, prefer solving it in that package unless it clearly belongs in the shared baseline.
- Keep config changes explicit and easy to trace because they affect the entire repo.
- For flat ESLint config files, prefer ESLint's `defineConfig` helper from `eslint/config` and consume `typescript-eslint` via named config exports instead of relying on `tseslint.config()`.

## Deliberate Divergence From The Template

This repo is downstream of `swiftpost-site-template` but runs its lint baseline looser on purpose,
so experiments are not blocked by ceremony:

| Setting | Template | Here |
|---------|----------|------|
| `typescript-eslint` preset | `strictTypeChecked` | `recommendedTypeChecked` |
| `@typescript-eslint/no-unused-vars` | `error` | `warn` |

This is an intentional decision (commit `56da8c9`), not drift — do not "fix" it back while syncing
from upstream. `tsconfigBase.json` keeps `"strict": true`; the relaxation is in the lint layer only.
If a subproject matures enough to warrant stricter rules, tighten it in that package rather than
globally.

For general code-style guidance, see the `ref-sp-dev-code-conventions` skill. For repo-wide structure, see the `ref-sp-dev-site-architecture` skill.
