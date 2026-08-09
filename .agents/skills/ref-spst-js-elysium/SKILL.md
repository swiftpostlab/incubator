---
name: ref-spst-js-elysium
description: "SwiftPost Elysium UI library reference. Use when: importing components from @swiftpost/elysium, choosing between base and enhanced UI primitives, wiring providers, or using Elysium-specific slots, sx utilities, and theme helpers."
metadata:
  shareable-skills.owner-prefix: "spst"
  shareable-skills.owner: "swiftpostlabs/swiftpost-site-template"
  shareable-skills.domain: "js"
  shareable-skills.visibility: "repo-local"
  shareable-skills.reason: "This skill documents the template's local @swiftpost/elysium package."
---

# SwiftPost Elysium

## Purpose

Document the SwiftPost-specific UI layer built in `@swiftpost/elysium`. Use this skill when the task depends on package-specific imports, wrappers, theme helpers, or conventions that do not generalize to other projects.

## When to use this skill

- Importing or using any component from `@swiftpost/elysium`.
- Choosing between base (MUI wrapper) and enhanced components.
- Wiring Elysium providers or theme objects.
- Using Elysium-specific utilities like `spreadSx`.
- Confirming package-specific import paths or component names.

## Import Strategy

**Never import from `@mui/material` directly in the app package.** App UI goes through Elysium.

| What | Import From |
|------|-------------|
| MUI base components | `@swiftpost/elysium/ui/base/{ComponentName}` |
| Enhanced components | `@swiftpost/elysium/ui/{ComponentName}` |
| Hooks | `@swiftpost/elysium/ui/{hookName}` |
| Types (`SxProps`, `InferSlotsFromSlotProps`, etc.) | `@swiftpost/elysium/ui/types` |
| Style utilities (`spreadSx`) | `@swiftpost/elysium/utils/styles/sxProps` |
| Theme provider | `@swiftpost/elysium/core/ThemeProvider` |
| Cache provider | `@swiftpost/elysium/core/AppRouterCacheProvider` |
| Theme object / font | `@swiftpost/elysium/themes/gamut` |
| Static theme options | `@swiftpost/elysium/themes/gamut/static` |
| Color tokens | `@swiftpost/elysium/colors/material` |
| MUI Icons | `@mui/icons-material` |

## Base Components

Thin re-exports of MUI components. Import from `@swiftpost/elysium/ui/base/*`.

| Component | MUI Source | Notes |
|-----------|-----------|-------|
| `Autocomplete` | `@mui/material/Autocomplete` | |
| `Box` | `@mui/material/Box` | |
| `Button` | `@mui/material/Button` | |
| `Checkbox` | `@mui/material/Checkbox` | |
| `FormControl` | `@mui/material/FormControl` | |
| `FormLabel` | `@mui/material/FormLabel` | |
| `Link` | `@mui/material/Link` | Base link only. For navigation, use the enhanced `Link`. |
| `MenuItem` | `@mui/material/MenuItem` | |
| `Modal` | `@mui/material/Modal` | |
| `Radio` | `@mui/material/Radio` | |
| `RadioGroup` | `@mui/material/RadioGroup` | |
| `Select` | `@mui/material/Select` | |
| `Stack` | `@mui/material/Stack` | |
| `Text` | `@mui/material/Typography` | Always use `Text`, never `Typography`. |
| `TextField` | `@mui/material/TextField` | |

### Text Rename

MUI `Typography` is renamed to `Text` across the package.

```tsx
import Text from '@swiftpost/elysium/ui/base/Text';
import type { TextProps } from '@swiftpost/elysium/ui/base/Text';
```

## Enhanced Components

### Link

`@swiftpost/elysium/ui/Link` integrates `next/link` with MUI styling. Use it for navigation instead of raw `next/link`.

### Image

`@swiftpost/elysium/ui/Image` wraps `next/image` and falls back to plain `<img>` for simple URL sources without dimensions.

### ContentFittedStack

`@swiftpost/elysium/ui/ContentFittedStack` provides constrained centered content inside a full-width stack container.

### StackLayout

`@swiftpost/elysium/layouts/StackLayout` is the package layout primitive for full-height stacks with optional footer slots.

## Providers and Theme

- `@swiftpost/elysium/core/AppRouterCacheProvider` wraps the MUI Emotion cache for App Router.
- `@swiftpost/elysium/core/ThemeProvider` is the client wrapper around the theme.
- `@swiftpost/elysium/themes/gamut` exports the runtime theme and font.
- `@swiftpost/elysium/themes/gamut/static` exports SSR-safe theme values.

## Elysium-Specific Styling Helpers

- Use `spreadSx` from `@swiftpost/elysium/utils/styles/sxProps` when merging `sx` values.
- Use `InferSlotsFromSlotProps` from `@swiftpost/elysium/ui/types` when defining slot-based APIs.
- Wrap reusable UI primitives in `memo` and keep `componentBaseName` stable for CSS targeting.

For SwiftPost-specific styling guidance, see the `ref-spst-js-styling` skill.
