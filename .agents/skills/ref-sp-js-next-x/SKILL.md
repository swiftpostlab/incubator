---
name: ref-sp-js-next-x
description: "Incubator Next.js static-export conventions and constraints. Use when: creating pages, working with routing, managing client/server boundaries, or configuring Next.js in this repo."
metadata:
  shareable-skills.owner-prefix: "sp"
  shareable-skills.owner: "swiftpostlab/incubator"
  shareable-skills.domain: "js"
  shareable-skills.visibility: "repo-local"
  shareable-skills.reason: "This skill contains Next.js guidance specific to this repo's static-export setup."
---

# Incubator Next.js Conventions

> **Why the `-x` suffix:** the shared `agentic-tools` catalog already publishes `ref-sp-js-next`, and
> both live in `.agents/skills/`. This repo's local Next skill takes the `-x` suffix so the synced
> symlink and this committed skill cannot collide. The two are complementary, not competing.

## Purpose

Define the Next.js-specific rules and constraints for this static-export project, with an emphasis on simple boundaries and maintainable patterns that fit a static site.

## When to use this skill

- Creating new pages or routes.
- Working with `'use client'` boundaries.
- Configuring Next.js (next.config.ts, metadata, etc.).
- Deciding between server and client components.

## Scope Boundaries

- Use this skill for the constraints that are specific to this repo: static-export limits, the `page.tsx` + `ClientWrapper.tsx` pattern, Elysium routing wrappers, and `staticTheme` access.
- Use `ref-sp-js-next` for portable Next.js guidance — App Router structure, general client/server boundary defaults, and framework integrations. This skill layers on top of it and does not restate it.
- Use `ref-sp-dev-site-architecture` when the question is about package boundaries or where a file belongs rather than a Next.js rule.

## Core Constraint: Static Export Only

This is a **frontend-only** Next.js project exported as a static website. The following server features are **forbidden**:

- Server Actions
- API routes (`app/api/`)
- Dynamic server rendering (`getServerSideProps`, server-only `cookies()`, `headers()`)
- Middleware (runs on server)
- ISR / revalidation

Everything must work as a fully static site (`output: 'export'` in next.config.ts).

## Page Pattern

Pages follow a thin Server Component pattern to minimize the `'use client'` boundary:

1. **`page.tsx`** — Server Component. Exports metadata and renders a Client Wrapper. No hooks, no state, no `'use client'`.
2. **`ClientWrapper.tsx`** — `'use client'` component. Contains or composes the actual interactive UI.

```tsx
// app/my-route/page.tsx
import ClientWrapper from './ClientWrapper';

export const metadata = { title: 'My Route' };

const Page = () => <ClientWrapper />;
export default Page;
```

```tsx
// app/my-route/ClientWrapper.tsx
'use client';

import Dashboard from '@/features/my-feature/components/Dashboard';

const ClientWrapper = () => <Dashboard />;
export default ClientWrapper;
```

## Base Path

The site is deployed to GitHub Pages under a project sub-path, so `next.config.ts` sets:

```ts
const isDev = process.env.NODE_ENV === 'development';

const nextConfig: NextConfig = {
  output: 'export',
  basePath: isDev ? '' : '/incubator',
};
```

Consequences that bite in a static export:

- **Never hard-code a leading-slash site URL** in markup or config. Use the Elysium `Link` and
  `Image` wrappers, which resolve the base path through `next/link` and `next/image`.
- Raw `<a href="/foo">` or `fetch('/data.json')` will 404 in production but work in dev. If you need
  a runtime asset URL, build it from the router's base path rather than assuming the site root.
- Anything under `packages/main/public/` is served beneath the base path too.

## Internationalization

This repo uses **`next-intl`**, wired through the plugin in `next.config.ts`:

```ts
const withNextIntl = createNextIntlPlugin('./src/i18n/config.ts');
export default withNextIntl(nextConfig);
```

- Message catalogs live in `src/i18n/translations/` (`en.json`, `it.json`).
- Configuration and the locale provider live in `src/i18n/`.
- Add a key to **every** catalog when you add one to any of them — a missing key is a runtime error,
  not a type error.
- Keep user-facing strings in the catalogs, not inline in components.

## Routing & Navigation

- **Never use `next/link` directly.** Use `Link` from `@swiftpost/elysium/ui/Link`, which wraps `next/link` with MUI styling.
- **Never use `next/image` directly.** Use `Image` from `@swiftpost/elysium/ui/Image`.
- Pages and routes live in `packages/main/src/app/`, one folder per incubator subproject.

## Static Theme Access

To use theme values without `'use client'`, import from `@/styles/staticTheme`:

```tsx
import { staticTheme } from '@/styles/staticTheme';

// Works in Server Components — no hooks needed
const spacing = staticTheme.spacing(2); // '1rem'
```
