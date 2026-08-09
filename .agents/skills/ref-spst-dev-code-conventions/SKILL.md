---
name: ref-spst-dev-code-conventions
description: "SwiftPost Site Template TypeScript and React code quality standards. Use when: creating components, writing hooks, reviewing TypeScript code, or applying template-specific coding patterns."
metadata:
  shareable-skills.owner-prefix: "spst"
  shareable-skills.owner: "swiftpostlabs/swiftpost-site-template"
  shareable-skills.domain: "dev"
  shareable-skills.visibility: "repo-local"
  shareable-skills.reason: "This skill contains SwiftPost Site Template-specific TypeScript and React conventions."
---

# SwiftPost Code Conventions

## Purpose

Enforce consistent TypeScript and React patterns across the monorepo, keeping code simple, strict, readable, and maintainable. Favor obvious code over clever code and prefer structures that stay easy to change.

## When to use this skill

- Creating or modifying React components or hooks.
- Writing TypeScript utility functions or types.
- Reviewing code for type safety and pattern compliance.

## TypeScript Rules

### Strict Typing

- **No `any`:** Strictly banned. Use proper typing, generics, or `unknown` combined with type guards.
- **Strict mode:** The project uses `"strict": true` in tsconfig. Never weaken it.
- **Erasable types:** Prefer erasable syntax. No `enum` (use `as const` objects or union types), no `namespace`, no parameter properties. Use `type` imports (`import type { ... }`) when importing types only.

### Type Inference

- **Let return types be inferred** in most cases. TypeScript's inference is sound — trust it.
- **Explicitly annotate return types** only when defining an API contract (e.g., a service function, a hook's public return shape, or a shared utility that others depend on).
- **Always type function parameters.** Return types can be inferred; input types cannot.

### Type Declarations

- Use `type` over `interface` when the type is not extended. Prefer `type Props = { ... }` for component props that won't be inherited.
- Use `interface` when you need declaration merging or expect extension (e.g., slot prop interfaces).
- Keep types close to usage. Only move to a shared `types.ts` if genuinely reused across multiple files.

## React Component Rules

### Structure

```tsx
import Box from '@swiftpost/elysium/ui/base/Box';
import Text from '@swiftpost/elysium/ui/base/Text';

interface Props {
  title: string;
  children: React.ReactNode;
}

const MyComponent: React.FC<Props> = ({ title, children }) => {
  return (
    <Box>
      <Text>{title}</Text>
      <Box>{children}</Box>
    </Box>
  );
};

export type MyComponentProps = Props;
export default MyComponent;
```

### Rules

- **Const functions:** Always use `const` arrow functions. No `function` declarations for components or utilities.
- **`React.FC<Props>`:** Always use this pattern for component definitions.
- **Props interface:** Always define `interface Props` (omit only if the component takes no props).
- **Export pattern:** Export `type {ComponentName}Props = Props` at the bottom. Default-export the component.
- **Early returns:** Prefer early returns to reduce nesting and keep conditional logic easy to follow.

```tsx
// Good — early return
const UserCard: React.FC<Props> = ({ user }) => {
  if (!user) {
    return null;
  }

  return <Text>{user.name}</Text>;
};

// Bad — nested conditional
const UserCard: React.FC<Props> = ({ user }) => {
  return (
    <Box>
      {user ? <Text>{user.name}</Text> : null}
    </Box>
  );
};
```

## Custom Hook Rules

Hooks must be resilient, typed, and encapsulate their own side effects.

- **Return objects:** Return `{ value, setValue }` instead of tuples for extensibility and readability.
- **Error handling:** Silent failure via `try/catch` is required for browser APIs (e.g., `sessionStorage`, `localStorage`) to prevent hydration crashes.
- **Cleanup:** Always clean up side effects in `useEffect` returns (e.g., `removeEventListener`).
- **Const functions:** Hooks are also const arrow functions.

```tsx
import { useState, useCallback, useEffect } from 'react';

export const useCustomFeature = <TValue,>(initialValue: TValue) => {
  const [value, setInternalValue] = useState<TValue>(initialValue);

  const setValue = useCallback((newValue: TValue) => {
    try {
      setInternalValue(newValue);
    } catch (error) {
      console.error('Feature execution failed:', error);
    }
  }, []);

  return { value, setValue };
};
```

## General Patterns

- **No unnecessary libraries.** Before proposing a new dependency, always ask the user and do a thorough check for alternatives. Write a few lines of TypeScript instead of pulling in a micro-library.
- **Use approved libraries when a dependency is justified.** Prefer `@tanstack/react-query` for async server state, `zod` for schema validation, and `next-intl` for internationalization. Prefer native `Date` and `Intl.DateTimeFormat` for normal date work; use `date-fns` only when the problem genuinely needs more complex date math. Any other dependency still requires explicit user approval after checking for simpler alternatives.
- **Prefer modern APIs.** Use intention-revealing built-ins like `find`, `some`, `every`, `includes`, `Object.hasOwn`, and `at` when they express the behavior directly. Avoid older sentinel-style patterns like `indexOf(...) !== -1` or manual loops when a modern built-in is clearer and equally supported.
- **Curly braces required.** All `if`/`else`/`for`/`while` blocks must use curly braces (enforced by ESLint `curly: ['error', 'all']`).
- **No useless renames.** Destructuring renames must add meaning (enforced by ESLint `no-useless-rename`).
- **Unused variables.** Prefix with `_` if intentionally unused (e.g., `_event`, `_index`).

## Standalone Scripts

Scripts in `scripts/` use `.mts` (TypeScript ES Modules) and run via Node's native type stripping (`node --experimental-strip-types`). This requires **Node >= 22.6**.

### Rules

- All project TypeScript rules apply: no `any`, strict types, `const` arrow functions, `import type` for type-only imports.
- Use `interface` for local type definitions (not `type` — keeps consistency with the rest of the codebase for structured shapes).
- Return type annotations are optional for internal helpers; explicit for exported/public API functions.
- Use `node:` protocol for Node built-in imports (`import fs from 'node:fs'`).
- Do not use `/// <reference types="node" />` in script files. Standalone scripts must live under a tsconfig that provides Node types via `compilerOptions.types`.

### Example

```ts
import type { PathLike } from 'node:fs';
import fs from 'node:fs';

interface Config {
  name: string;
  values?: string[];
}

const readConfig = <T>(filePath: PathLike, fallback: T): T => {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
};
```
