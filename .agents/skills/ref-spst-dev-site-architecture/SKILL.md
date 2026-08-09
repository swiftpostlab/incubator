---
name: ref-spst-dev-site-architecture
description: "SwiftPost Site Template architecture, monorepo layout, package boundaries, import rules, and feature placement. Use when: designing features, structuring components, understanding where code goes, or configuring template-specific tooling."
metadata:
  shareable-skills.owner-prefix: "spst"
  shareable-skills.owner: "swiftpostlabs/swiftpost-site-template"
  shareable-skills.domain: "dev"
  shareable-skills.visibility: "repo-local"
  shareable-skills.reason: "This skill documents this template's local monorepo architecture and package boundaries."
---

# Architecture

## Purpose

Define the high-level architectural rules for the repo: how code is organized, how components are composed, how client/server boundaries work, how features stay isolated, and where files go. Favor structures that keep the codebase simple to navigate and maintain over abstractions that add indirection without clear payoff.

For the SwiftPost Elysium UI library reference (components, props, imports, styling helpers), see the **ref-spst-js-elysium** skill.
For SwiftPost-specific styling guidance, see the **ref-spst-js-styling** skill.
For TypeScript/React coding patterns, see the **ref-spst-dev-code-conventions** skill.
For Next.js-specific constraints and page patterns, see the **ref-spst-js-next** skill.

## When to use this skill

- Designing a new feature or component hierarchy.
- Deciding where business logic vs. presentation belongs.
- Understanding where to place new code.
- Setting up a new feature module.
- Navigating the monorepo layout.
- Reviewing modularity and separation of concerns.

## Monorepo Overview

**Turborepo** with **Yarn workspaces**. Three packages:

| Package | Path | Purpose |
|---------|------|---------|
| `@swiftpost/config` | `packages/config/` | Shared ESLint and TypeScript configs |
| `@swiftpost/elysium` | `packages/elysium/` | Internal UI library — thin MUI 7 wrappers + enhanced components |
| `@swiftpost/main` | `packages/main/` | Next.js 15 app (static export, App Router, Turbopack) |

## Local Agent Workspaces

The root-level `.playground/` and `.tasks/` directories are local-only agent workspaces. They are ignored by Git and excluded from AI context through `.ai-policy.json`.

| Path | Purpose | Rule |
|------|---------|------|
| `.playground/` | Temporary helper scripts, scratch files, generated local artifacts, and other short-lived agent work. | Do not put committed source, durable documentation, or secrets here. Promote anything reusable into the proper package, script, doc, or skill. |
| `.tasks/` | Local task tracking, backlog notes, task briefs, validation notes, and temporary planning artifacts. | Keep it local and current. Promote durable decisions into committed docs or skills instead of relying on ignored notes. |

If a shared skill describes `.agents/playground/` or `.agents/tasks/` as a portable default, use `.playground/` and `.tasks/` in this repository unless the user explicitly asks for the portable layout.

## `packages/main/src/` Directory Map

```
src/
├── app/                          # Next.js App Router pages
│   ├── page.tsx                  # Home page
│   ├── layout.tsx                # Root layout
│   ├── globals.css               # Global styles
│   └── <route>/                  # Additional routes
│       ├── page.tsx              # Thin server component (metadata)
│       └── ClientWrapper.tsx     # 'use client' boundary
├── components/                   # Shared layout/presentational components
│   ├── Footer.tsx
│   ├── Header.tsx
│   ├── Logo.tsx
│   ├── Menu.tsx
│   └── TopBar.tsx
├── features/                     # Domain feature modules (feature-first)
│   └── <feature-name>/
│       ├── index.ts              # Barrel file — re-exports public API
│       ├── types.ts              # Zod schemas + inferred TS types
│       ├── constants.ts          # Default data, config values
│       ├── hooks/                # Feature-specific hooks
│       ├── components/           # Feature-specific UI components
│       ├── services/             # Data access / business logic
│       └── utils/                # Feature-specific helpers
├── styles/                       # Theme configuration
│   ├── theme.ts
│   └── staticTheme.ts
├── templates/                    # Page layout templates
│   ├── SimplePageTemplate.tsx
│   └── BlogPostTemplate.tsx
├── customConfig.ts
└── types.ts                      # Shared types (only if truly cross-feature)
```

## Modularity & Feature Isolation

Fat components are strictly banned. UI components must be presentation-focused.

* **The `features` Directory:** Domain-specific logic (e.g., `storage`, `auth`, `data-processing`) must be encapsulated within `packages/main/src/features/{feature-name}/`. Expose hooks, types, and constants from here. Do not leak business logic into `src/components`.
* **Component Splitting:** Extract complex UI states (e.g., Authenticated vs. Unauthenticated views) into private, sibling components within the same file to keep the main render method clean and readable.
* **No cross-feature imports:** Features must not import from other features. Shared logic goes in `src/components/` (presentation) or a shared utility.

## Feature-First Architecture

Domain logic lives in `packages/main/src/features/<feature-name>/`. Features are self-contained modules that encapsulate their own types, hooks, components, services, and utilities.

### Feature Structure

```
features/<feature-name>/
├── index.ts              # Barrel — re-exports the feature's public API
├── types.ts              # Zod schemas + inferred TS types
├── constants.ts          # Config values, defaults
├── hooks/
│   ├── index.ts          # Barrel for hooks
│   ├── useFeatureData.ts
│   └── useFeatureState.ts
├── components/
│   ├── index.ts          # Barrel for components
│   ├── FeatureDashboard.tsx
│   └── FeatureCard.tsx
├── services/
│   └── featureService.ts # Plain object singletons with async methods
└── utils/
    └── formatters.ts     # Feature-specific helpers
```

### Feature Rules

- **Barrel files:** Every feature root and major subfolder has an `index.ts` that re-exports the public API.
- **Self-contained:** Features must not import from other features. Shared logic goes in `src/components/` or a shared utility.
- **No business logic in components:** `src/components/` is presentation-only. Domain logic stays in `src/features/`.
- **Services are plain objects:** Use object singletons with async methods, not classes.
- **Zod for domain models:** Define schemas in `types.ts`, derive TS types with `z.infer<>`.

## Composition Guidelines

* **Presentation vs. Logic:** Components in `src/components/` are presentation-only shells. They receive data via props and render UI. All data fetching, state management, and business logic belongs in `src/features/`.
* **Hook Encapsulation:** Domain logic exposed to components should be wrapped in custom hooks that live in `src/features/{feature}/hooks/`. Components consume these hooks — they don't implement the logic inline.
* **Barrel Exports:** Every feature root and major subfolder has an `index.ts` that re-exports the public API. Consumers import from the barrel, not from internal files.

## Reusable Component Architecture

Reusable components that are meant to be flexible and overridable must use the Slots & SlotProps pattern. See the **ref-spst-js-styling** skill for the local styling pattern and **ref-spst-js-elysium** for the concrete package implementation used here.

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
| Feature modules | `@/features/{feature-name}` or `@/features/{feature-name}/{subpath}` |
| Theme values (SSR-safe) | `@/styles/staticTheme` |
| Links/Navigation | `@swiftpost/elysium/ui/Link` (never `next/link` directly) |

## File Placement Guide

| Scenario | Where | Why |
|----------|-------|-----|
| New domain feature | `src/features/<name>/` | Feature-first isolation |
| Shared layout component | `src/components/` | Presentation-only, cross-feature |
| New route/page | `src/app/<route>/page.tsx` + `ClientWrapper.tsx` | App Router convention |
| Page template | `src/templates/` | Reusable page layouts |
| Theme config | `src/styles/` | Centralized theming |
| Cross-feature types | `src/types.ts` | Only if genuinely shared |
| Feature-specific types | `src/features/<name>/types.ts` | Keep close to usage |
