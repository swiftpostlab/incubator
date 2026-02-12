---
name: architecture
description: Component, hook, and page generation for this project.
---

# Frontend Conventions

## When to use this skill

Use this skill whenever generating, refactoring, or reviewing React components, custom hooks, or Next.js pages within the `main` package of the Swiftpost monorepo.

## Next

This is a frontend only Next project, so it is exported as a static website. As such any next server feature is forbidden.

## Directory Strictness & Imports

Do not guess import paths. Adhere strictly to the monorepo structure:

* **Pages & Routing:** Must reside in `packages/main/src/app` (App Router).
* **Reusable Components:** Reside in `packages/main/src/components`.
* **Routing/Links:** Strictly use `import Link from '@/components/Link';`. Do NOT use `next/link`.
* **UI Components:** Must be imported from the Elysium thin wrapper: `import {ComponentName} from '@swiftpost/elysium/ui/base/{ComponentName}';`.
* **MUI Icons:** Standard `@mui/icons-material` imports are permitted.
* **Theme:** Use `packages/main/src/styles/staticTheme.ts` (`import { staticTheme } from '@/styles/staticTheme';`) to read theme values without forcing `"use client"`.
* **Shared Logic:** Features and storage logic must go in `packages/main/src/features`.

## TypeScript & Component Rules

Technical debt will not be tolerated. Enforce the following:

* **No `any`:** `any` is strictly banned. Use proper typing, generics, or `unknown` combined with type guards.
* **Type Inference:** Rely on TS inference where explicit typing is redundant.
* **Component Structure:**
  * Always define an `interface Props` (only omit if empty, or if truly stateless).
  * Use `React.FC<Props>` for component definition.
  * Always export the props type as `{ComponentName}Props` at the bottom of the file.

### Example: Standard Component

```tsx
import Box from '@swiftpost/elysium/ui/base/Box';
import Text from '@swiftpost/elysium/ui/base/Text';

interface Props {
  foo: string;
  children: React.ReactNode;
}

const MyComponent: React.FC<Props> = ({ foo, children }) => {
  return (
    <Box>
      <Text>{`Something ${foo}`}</Text>
      <Box>{children}</Box>
    </Box>
  );
};

export type MyComponentProps = Props;
export default MyComponent;
```

## Custom Hook Rules

Hooks must be resilient, typed, and encapsulate their own side effects (like event listeners or storage sync).

* Return Objects: Return objects (e.g., { value, setValue }) instead of tuples for better extensibility and readability.
* Error Handling: Silent failure via try/catch is required for browser APIs (like sessionStorage) to prevent hydration crashes or SSR errors.
* State Syncing: If interacting with browser APIs (window events, storage), ensure cleanup in useEffect returns (e.g., removeEventListener).

Example: Standard Hook

```tsx
import { useState, useCallback, useEffect } from 'react';

export const useCustomFeature = <TValue>(initialValue: TValue) => {
  const [value, setInternalValue] = useState<TValue>(initialValue);

  // Hook logic, side effects, and try/catch blocks here
  // ...

  const setValue = useCallback((newValue: TValue) => {
    try {
      // Execute setter logic
      setInternalValue(newValue);
    } catch (error) {
      console.error('Feature execution failed:', error);
    }
  }, []);

  // Return object, not tuple
  return { value, setValue };
};    
```

## Modularity & Feature Isolation

Fat components are strictly banned. UI components must be presentation-focused.

* **The `features` Directory:** Domain-specific logic (e.g., `storage`, `auth`, `google-drive`) must be encapsulated within `packages/main/src/features/{feature-name}/`. Expose hooks, types, and constants from here. Do not leak business logic into `src/components`.
* **Client Wrappers:** Keep Next.js Page components (`page.tsx`) as thin Server Components whenever possible. Abstract heavy client-side logic into a separate Client Wrapper (e.g., `AuthClientWrapper.tsx`) to minimize the `"use client"` boundary footprint.
* **Component Splitting:** Extract complex UI states (e.g., Authenticated vs. Unauthenticated views) into private, sibling components within the same file to keep the main render method clean and readable.

## Approved Ecosystem & Dependencies

Avoid dependency bloat. Do not install micro-libraries for trivial logic that can be written in a few lines of standard TypeScript. When external libraries are necessary, strictly use the following approved, well-maintained tools:

* **Data Fetching & Async State:** Use `@tanstack/react-query` for all server state management, caching, and data synchronization.
* **Schema Validation:** Use `zod` for strict runtime type-checking of API payloads, environment variables, and complex form state. Trusting implicit types from external sources is banned.
* **API Requests:** Use `apisauce` for standardized API communication.
* **Date Manipulation:** Prefer native JavaScript `Date` and `Intl.DateTimeFormat` for simple parsing and formatting to avoid bundle bloat. If, and only if, complex date manipulation or timezone math is required, use `date-fns`.

## Reusable Component Architecture (MUI 7 Slots Pattern)

Reusable components must use the **Slots & SlotProps** pattern for maximum flexibility.

* **Imports:** Use `InferSlotsFromSlotProps`, `SxProps` from `@swiftpost/elysium/ui/types` and `spreadSx` from `@swiftpost/elysium/utils/styles/sxProps`.
* **Interface Structure:**
  * Define `SlotProps` interface for internal elements (e.g., `root`, `footer`).
  * Main `Props` must include `slots` (optional overrides), `slotProps` (props for those slots), and `sx` (root style overrides).
* **Style Merging:** Never overwrite `sx`. Always use `spreadSx` within an array to merge styles safely: `sx={[{ ...baseStyles }, ...spreadSx(sx)]}`.
* **Base Name:** Define a `const componentBaseName` (kebab-case) for stable CSS class targeting.
* **Optimization:** Always wrap reusable UI components in `memo`.

### Example: Advanced Slot Pattern

```tsx
import type { InferSlotsFromSlotProps, SxProps } from '@swiftpost/elysium/ui/types';
import { spreadSx } from '@swiftpost/elysium/utils/styles/sxProps';
import Box from '@swiftpost/elysium/ui/base/Box';
import { memo } from 'react';

const componentBaseName = 'custom-layout';

interface SlotProps {
  root: { children: React.ReactNode; sx?: SxProps };
  footer?: { children: React.ReactNode; sx?: SxProps };
}

interface Props {
  slots?: Partial<InferSlotsFromSlotProps<SlotProps>>;
  slotProps: SlotProps;
  sx?: SxProps;
}

const CustomLayout: React.FC<Props> = ({ slots, slotProps, sx }) => {
  const Root = slots?.root ?? Box;
  const Footer = slots?.footer ?? Box;

  return (
    <Root
      className={componentBaseName}
      // Merge styles using array syntax and spreadSx utility
      sx={[{ display: 'flex', flexDirection: 'column' }, ...spreadSx(sx), ...spreadSx(slotProps.root.sx)]}
    >
      {slotProps.root.children}

      {slotProps.footer && (
         <Footer className={`${componentBaseName}-footer`} sx={[...spreadSx(slotProps.footer.sx)]}>
           {slotProps.footer.children}
         </Footer>
      )}
    </Root>
  );
};

export type CustomLayoutProps = Props;
export default memo(CustomLayout);
```

## Styling, Theming & Responsive Design

* Mobile-First Approach: Strictly adhere to mobile-first design. Define base styles for mobile (xs) first, then use breakpoints to override for larger screens.
  * Example: width: { xs: '100%', md: '50%' }

* Static Theme Usage: Use staticTheme for values to avoid hook overhead.
  * Spacing: 0.5rem factor. spacing(2) = 1rem.
  * Breakpoints: xs: 340, sm: 600, md: 900, lg: 1200, xl: 1536.
* Typography: Font family defaults to var(--font-roboto).

## Elysium UI Library Usage

The `elysium` package is the definitive source for all UI elements. It distinguishes between thin MUI wrappers and enhanced custom components.

### Import Strategy

* **Base Components (MUI Wrappers):** Import standard MUI components from `@swiftpost/elysium/ui/base/*`.
  * *Note:* `Typography` is renamed to `Text`. Always import `Text` from `@swiftpost/elysium/ui/base/Text`.
* **Custom & Enhanced Components:** Import specialized components directly from `@swiftpost/elysium/ui/*`.

### Key Enhanced Components

* **Link (`@swiftpost/elysium/ui/Link`):** * Integrates `next/link` with MUI styling.
  * Use `external` prop to bypass `next/link`.
  * Use `blank` for `target="_blank"`.
  * Use `inheritStyle` to inherit font properties from the parent.
* **Image (`@swiftpost/elysium/ui/Image`):** * Smart wrapper around `next/image`.
  * Automatically falls back to a standard `<img>` tag if the source is a simple string (url) without dimensions, preventing Next.js image errors.
* **ContentFittedStack (`@swiftpost/elysium/ui/ContentFittedStack`):** * Use for layout sections that need constrained max-width content centering.

### Hooks

* **`useMediaQuery`:** Import from `@swiftpost/elysium/ui/useMediaQuery`.
* **`useTheme`:** Import from `@swiftpost/elysium/ui/useTheme`.

### Example: Elysium Composition

```tsx
import { staticTheme } from '@/styles/staticTheme';
import Text from '@swiftpost/elysium/ui/base/Text'; // Base wrapper (Typography)
import ContentFittedStack from '@swiftpost/elysium/ui/ContentFittedStack'; // Custom layout
import Link from '@swiftpost/elysium/ui/Link'; // Enhanced Link
import Image from '@swiftpost/elysium/ui/Image'; // Enhanced Image

const MyFooter = () => (
  <ContentFittedStack
    component="footer"
    minHeight={staticTheme.spacing(6)}
    // "container" slot style override pattern
    slotProps={{ 
      container: { sx: { backgroundColor: 'grey.100' } } 
    }}
  >
    <Text>
       Powered by <Link href="[https://example.com](https://example.com)" external blank>SwiftPost</Link>
    </Text>
    <Image source="/logo.png" alt="Logo" width={100} height={50} />
  </ContentFittedStack>
);
