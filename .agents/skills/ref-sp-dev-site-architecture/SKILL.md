---
name: ref-sp-dev-site-architecture
description: "Incubator architecture, monorepo layout, subproject boundaries, import rules, and feature placement. Use when: adding a new subproject, designing features, structuring components, understanding where code goes, or configuring repo-specific tooling."
metadata:
  shareable-skills.owner-prefix: "sp"
  shareable-skills.owner: "swiftpostlab/incubator"
  shareable-skills.domain: "dev"
  shareable-skills.visibility: "repo-local"
  shareable-skills.reason: "This skill documents this repo's local monorepo architecture, subproject model, and package boundaries."
---

# Architecture

## Purpose

Define the high-level architectural rules for the incubator: how subprojects are added and kept
apart, how code is organized, how client/server boundaries work, and where files go. Favor
structures that keep each experiment cheap to add and cheap to delete over abstractions that add
indirection without clear payoff.

For the Elysium UI library reference (components, props, imports, styling helpers), see the
**ref-sp-js-elysium** skill.
For styling guidance, see the **ref-sp-js-styling** skill.
For TypeScript/React coding patterns, see the **ref-sp-dev-code-conventions** skill.
For Next.js static-export constraints and page patterns, see the **ref-sp-js-next-x** skill.

## When to use this skill

- Adding a new subproject to the incubator.
- Designing a new feature or component hierarchy.
- Deciding where business logic vs. presentation belongs.
- Deciding whether code is subproject-local or shared.
- Navigating the monorepo layout.
- Reviewing modularity and separation of concerns.

## What this repo is

This is an **incubator**: one deployed Next.js static site that hosts several small, independent
experiments side by side. It is downstream of `swiftpost-site-template`, which supplies the
baseline stack and tooling. Expect subprojects to be added, reshaped, and removed often — optimize
for isolation, not for reuse across them.

Each subproject is a route under `packages/main/src/app/<subproject>/` and is linked from the home
page. A subproject must be deletable by removing its route folder and its entry in the home page
list, plus any of its own feature folders.

## Monorepo Overview

**Turborepo** with **Yarn workspaces**. Three packages:

| Package | Path | Purpose |
|---------|------|---------|
| `@swiftpost/config` | `packages/config/` | Shared ESLint and TypeScript configs |
| `@swiftpost/elysium` | `packages/elysium/` | Internal UI library — thin MUI 7 wrappers + enhanced components |
| `@swiftpost/main` | `packages/main/` | Next.js 15 app (static export, App Router, Turbopack) |

The site is served under a base path (`basePath: '/incubator'` outside development), so never
hard-code absolute site-root URLs. See **ref-sp-js-next-x**.

## Local Agent Workspaces

The `.agents/playground/`, `.agents/tasks/`, and `.agents/retro/` directories are local-only agent
workspaces. They are ignored by Git and excluded from AI context through `.ai-policy.json`. Each
keeps a committed placeholder `.gitignore` so the directory survives a clone.

| Path | Purpose | Rule |
|------|---------|------|
| `.agents/playground/` | Temporary helper scripts, scratch files, generated local artifacts, and other short-lived agent work. | Do not put committed source, durable documentation, or secrets here. Promote anything reusable into the proper package, script, doc, or skill. |
| `.agents/tasks/` | Local task tracking, backlog notes, task briefs, validation notes, and temporary planning artifacts. | Keep it local and current. Promote durable decisions into committed docs or skills instead of relying on ignored notes. See `ref-sp-agents-local-tasks` for the lifecycle. |
| `.agents/retro/` | Retrospectives captured at the end of substantial work. | Read past retros before similar work. See `ref-sp-agents-retro` for the format. |

This repository follows the portable `.agents/` layout directly, so no path translation is needed
when a shared skill refers to it.

## `packages/main/src/` Directory Map

```
src/
├── app/                          # Next.js App Router pages
│   ├── page.tsx                  # Home page — index of subprojects
│   ├── HomeLinksList.tsx         # The subproject link list
│   ├── layout.tsx                # Root layout
│   ├── globals.css               # Global styles
│   └── <subproject>/             # One incubator experiment per folder
│       ├── page.tsx              # Thin server component (metadata)
│       ├── ClientWrapper.tsx     # 'use client' boundary
│       ├── components/           # Subproject-only components
│       ├── features/             # Subproject-only domain logic
│       ├── types/                # Subproject-only types
│       └── customConfig.ts       # Subproject-level config, when it needs one
├── components/                   # Shared layout/presentational components
│   ├── Footer.tsx
│   ├── Header.tsx
│   ├── Logo.tsx
│   ├── Menu.tsx
│   └── TopBar.tsx
├── features/                     # Shared or substantial domain feature modules
│   └── <feature-name>/
│       ├── index.ts              # Barrel file — re-exports public API
│       ├── types.ts              # Zod schemas + inferred TS types
│       ├── constants.ts          # Default data, config values
│       ├── hooks/                # Feature-specific hooks
│       ├── components/           # Feature-specific UI components
│       ├── db/                   # Local persistence (Dexie), when used
│       ├── services/             # Data access / business logic
│       └── utils/                # Feature-specific helpers
├── i18n/                         # next-intl configuration and translations
│   ├── config.ts
│   ├── LocaleProvider.tsx
│   ├── useTranslationsConfig.ts
│   └── translations/             # en.json, it.json
├── styles/                       # Theme configuration
│   ├── theme.ts
│   └── staticTheme.ts
├── templates/                    # Page layout templates
│   ├── BasePageTemplate.tsx
│   ├── SimplePageTemplate.tsx
│   └── BlogPostTemplate.tsx
├── customConfig.ts
└── types.ts                      # Shared types (only if truly cross-subproject)
```

## Subproject placement: co-located vs. shared

Both placements exist in the repo today, and the difference is deliberate:

| Placement | Use when | Example |
|-----------|----------|---------|
| `src/app/<subproject>/features/` | The logic serves exactly one subproject and is expected to live and die with it. | `app/analytics-tools/features/` |
| `src/features/<name>/` | The domain is substantial and self-contained enough to outlive or be reused beyond one route. | `features/expense-tracker/` |

**Default to co-locating under `src/app/<subproject>/`.** Promote to `src/features/` only when the
module is genuinely shared or big enough to stand on its own. Promotion is a deliberate move, not a
default — it costs deletability, which is the property this repo optimizes for.

Do not import across subprojects. If two subprojects need the same thing, promote it to
`src/features/` or `src/components/` first.

## Modularity & Feature Isolation

Fat components are strictly banned. UI components must be presentation-focused.

* **The `features` directory:** Domain-specific logic (e.g., `data-processing`, `statistical-analysis`,
  `expense-tracker`) must be encapsulated in a feature folder. Expose hooks, types, and constants
  from there. Do not leak business logic into `src/components`.
* **Component splitting:** Extract complex UI states into private, sibling components within the same
  file to keep the main render method clean and readable.
* **No cross-feature imports:** Features must not import from other features. Shared logic goes in
  `src/components/` (presentation) or a shared utility.

## Feature-First Architecture

### Feature Structure

```
features/<feature-name>/
├── index.ts              # Barrel — re-exports the feature's public API
├── types.ts              # Zod schemas + inferred TS types
├── constants.ts          # Config values, defaults
├── hooks/
│   ├── index.ts          # Barrel for hooks
│   └── useFeatureData.ts
├── components/
│   ├── index.ts          # Barrel for components
│   └── FeatureDashboard.tsx
├── services/
│   └── featureService.ts # Plain object singletons with async methods
└── utils/
    └── formatters.ts     # Feature-specific helpers
```

### Feature Rules

- **Barrel files:** Every feature root and major subfolder has an `index.ts` that re-exports the
  public API.
- **Self-contained:** Features must not import from other features.
- **No business logic in components:** `src/components/` is presentation-only.
- **Services are plain objects:** Use object singletons with async methods, not classes.
- **Zod for domain models:** Define schemas in `types.ts`, derive TS types with `z.infer<>`.

## Composition Guidelines

* **Presentation vs. logic:** Components in `src/components/` are presentation-only shells. They
  receive data via props and render UI. All data fetching, state management, and business logic
  belongs in a feature folder.
* **Hook encapsulation:** Domain logic exposed to components should be wrapped in custom hooks that
  live in the feature's `hooks/`. Components consume these hooks — they don't implement the logic
  inline.
* **Barrel exports:** Consumers import from the barrel, not from internal files.

## Reusable Component Architecture

Reusable components meant to be flexible and overridable must use the Slots & SlotProps pattern. See
**ref-sp-js-styling** for the pattern and **ref-sp-js-elysium** for the concrete package
implementation.

Key rules:
* Define `SlotProps` for internal elements, `Props` with `slots?`, `slotProps`, and `sx?`.
* Never overwrite `sx` — always merge with `spreadSx`.
* Use `const componentBaseName` (kebab-case) for CSS class targeting.
* Wrap reusable UI components in `memo`.

## Import Rules

Do not guess import paths. Adhere strictly to these conventions:

| What | Import From |
|------|-------------|
| MUI base components | `@swiftpost/elysium/ui/base/{ComponentName}` |
| Enhanced components (Link, Image, etc.) | `@swiftpost/elysium/ui/{ComponentName}` |
| MUI Icons | `@mui/icons-material` |
| Shared layout components | `@/components/{ComponentName}` |
| Shared feature modules | `@/features/{feature-name}` or `@/features/{feature-name}/{subpath}` |
| Subproject-local modules | relative paths within `src/app/<subproject>/` |
| Theme values (SSR-safe) | `@/styles/staticTheme` |
| Links/Navigation | `@swiftpost/elysium/ui/Link` (never `next/link` directly) |
| Translations | `next-intl` via `@/i18n` helpers |

## File Placement Guide

| Scenario | Where | Why |
|----------|-------|-----|
| New subproject | `src/app/<subproject>/page.tsx` + `ClientWrapper.tsx` | App Router convention; keeps the experiment deletable |
| Subproject-only domain logic | `src/app/<subproject>/features/<name>/` | Lives and dies with the subproject |
| Shared domain feature | `src/features/<name>/` | Feature-first isolation, reused across routes |
| Shared layout component | `src/components/` | Presentation-only, cross-subproject |
| Page template | `src/templates/` | Reusable page layouts |
| Theme config | `src/styles/` | Centralized theming |
| Translation strings | `src/i18n/translations/` | next-intl message catalogs |
| Cross-subproject types | `src/types.ts` | Only if genuinely shared |
| Feature-specific types | the feature's own `types.ts` | Keep close to usage |
