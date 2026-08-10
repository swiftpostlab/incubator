---
name: ref-sp-dev-main-package
description: "SwiftPost main app package overview. Use when: working in packages/main, placing app code, understanding package boundaries, or deciding whether logic belongs in the app package versus another package."
metadata:
  shareable-skills.owner-prefix: "sp"
  shareable-skills.owner: "swiftpostlab/incubator"
  shareable-skills.domain: "dev"
  shareable-skills.visibility: "repo-local"
  shareable-skills.reason: "This skill documents this repo's local packages/main app package."
---

# Incubator Main

## Purpose

Clarify the role of `packages/main` as the deployed Next.js app package that hosts every incubator subproject. Use this skill for package-specific boundaries, entry points, and responsibilities that are specific to this application shell.

## When to use this skill

- Adding or moving code inside `packages/main`.
- Deciding whether logic belongs in the app package or another package.
- Working on route entry points, shared app components, templates, or app-local theme wrappers.

## Package Responsibility

`packages/main` is the deployable Next.js application. It should compose UI and features, not duplicate shared infra that belongs elsewhere.

- Put shared lint and TS config concerns in `@swiftpost/config`.
- Put shared UI primitives and wrappers in `@swiftpost/elysium`.
- Keep app-specific pages, templates, components, and app wiring in `packages/main`.

## Main Entry Points

- `src/app/` for App Router pages and layouts. `src/app/page.tsx` plus `src/app/HomeLinksList.tsx`
  form the index of subprojects; each other folder under `src/app/` is one subproject.
- `src/components/` for shared app-level presentational components.
- `src/features/` for shared or substantial domain modules.
- `src/templates/` for reusable page templates.
- `src/i18n/` for `next-intl` config, the locale provider, and the message catalogs.
- `src/styles/` for app-local theme wrappers like `staticTheme`.
- `next.config.ts` for static export, base path, and the `next-intl` plugin.

## Package-Specific Notes

- The app depends on `@swiftpost/elysium` for UI and `@swiftpost/config` for tooling.
- `next.config.ts` sets `output: 'export'`, a production `basePath` of `/incubator`, and wraps the
  config in the `next-intl` plugin.
- Prefer thin route entry points and keep reusable UI logic out of the route file when possible.
- **Adding a subproject** means adding a folder under `src/app/`, registering it in
  `HomeLinksList.tsx`, and adding its strings to every catalog in `src/i18n/translations/`.
  Removing one should be the exact inverse — keep it that way.
- Subproject-only dependencies still land in `packages/main/package.json`; there is one app package,
  so weigh a new dependency against the whole site, not just the experiment asking for it.

For framework-wide rules that can apply to other Next.js projects, see the shared `ref-sp-js-next` skill. For this repo's static-export and base-path constraints, see `ref-sp-js-next-x`. For this repo's structure, see the `ref-sp-dev-site-architecture` skill.
