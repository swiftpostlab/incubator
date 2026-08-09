---
name: ref-spst-js-next
description: "SwiftPost Site Template Next.js static-export conventions and constraints. Use when: creating pages, working with routing, managing client/server boundaries, or configuring Next.js in this template."
metadata:
  shareable-skills.owner-prefix: "spst"
  shareable-skills.owner: "swiftpostlabs/swiftpost-site-template"
  shareable-skills.domain: "js"
  shareable-skills.visibility: "repo-local"
  shareable-skills.reason: "This skill contains Next.js guidance specific to this template's static-export setup."
---

# SwiftPost Next.js Conventions

## Purpose

Define the Next.js-specific rules and constraints for this static-export project, with an emphasis on simple boundaries and maintainable patterns that fit a static site.

## When to use this skill

- Creating new pages or routes.
- Working with `'use client'` boundaries.
- Configuring Next.js (next.config.ts, metadata, etc.).
- Deciding between server and client components.

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

## Routing & Navigation

- **Never use `next/link` directly.** Use `Link` from `@swiftpost/elysium/ui/Link`, which wraps `next/link` with MUI styling.
- **Never use `next/image` directly.** Use `Image` from `@swiftpost/elysium/ui/Image`.
- Pages and routes live in `packages/main/src/app/`.

## Static Theme Access

To use theme values without `'use client'`, import from `@/styles/staticTheme`:

```tsx
import { staticTheme } from '@/styles/staticTheme';

// Works in Server Components — no hooks needed
const spacing = staticTheme.spacing(2); // '1rem'
```
