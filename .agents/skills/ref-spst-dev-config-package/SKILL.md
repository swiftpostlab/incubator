---
name: ref-spst-dev-config-package
description: "SwiftPost shared config package overview. Use when: editing packages/config, adjusting shared ESLint or TypeScript config, or deciding whether tooling rules belong in the config package."
metadata:
  shareable-skills.owner-prefix: "spst"
  shareable-skills.owner: "swiftpostlabs/swiftpost-site-template"
  shareable-skills.domain: "dev"
  shareable-skills.visibility: "repo-local"
  shareable-skills.reason: "This skill documents the template's local packages/config workspace."
---

# SwiftPost Config

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

For general code-style guidance, see the `ref-spst-dev-code-conventions` skill. For repo-wide structure, see the `ref-spst-dev-site-architecture` skill.
