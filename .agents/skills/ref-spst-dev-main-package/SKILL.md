---
name: ref-spst-dev-main-package
description: "SwiftPost main app package overview. Use when: working in packages/main, placing app code, understanding package boundaries, or deciding whether logic belongs in the app package versus another package."
metadata:
  shareable-skills.owner-prefix: "spst"
  shareable-skills.owner: "swiftpostlabs/swiftpost-site-template"
  shareable-skills.domain: "dev"
  shareable-skills.visibility: "repo-local"
  shareable-skills.reason: "This skill documents the template's local packages/main app package."
---

# SwiftPost Main

## Purpose

Clarify the role of `packages/main` as the deployed Next.js app package. Use this skill for package-specific boundaries, entry points, and responsibilities that are specific to SwiftPost's application shell.

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

- `src/app/` for App Router pages and layouts.
- `src/components/` for shared app-level presentational components.
- `src/templates/` for reusable page templates.
- `src/styles/` for app-local theme wrappers like `staticTheme`.
- `next.config.ts` for static export and app deployment settings.

## Package-Specific Notes

- The app depends on `@swiftpost/elysium` for UI and `@swiftpost/config` for tooling.
- `next.config.ts` sets `output: 'export'` and a production `basePath` for deployment.
- Prefer thin route entry points and keep reusable UI logic out of the route file when possible.

For framework-wide rules that can apply to other Next.js projects, see the shared `ref-sp-js-next` skill. For this repo's structure, see the `ref-spst-dev-site-architecture` skill.
