---
name: ref-spst-js-styling
description: "SwiftPost Site Template styling guidance for Elysium/MUI components, sx merging, Slots and SlotProps APIs, responsive layout, and theme-token use. Use when: building UI in packages/main or packages/elysium, creating reusable styled components, shaping slot APIs, or reviewing visual/layout styling."
metadata:
  shareable-skills.owner-prefix: "spst"
  shareable-skills.owner: "swiftpostlabs/swiftpost-site-template"
  shareable-skills.domain: "js"
  shareable-skills.visibility: "repo-local"
  shareable-skills.requires: "ref-spst-js-elysium"
  shareable-skills.reason: "This skill depends on this template's @swiftpost/elysium package, theme structure, and local component conventions."
---

# SwiftPost Styling

## Purpose

Define how styling should be authored in the SwiftPost Site Template so UI remains theme-aware, responsive, override-friendly, and consistent with the local `@swiftpost/elysium` layer. Use this skill for concrete styling decisions in this repository rather than generic CSS or MUI advice.

## When To Use This Skill

- Building or reviewing styled UI in `packages/main` or `packages/elysium`.
- Creating reusable components that expose `slots`, `slotProps`, or `sx`.
- Merging incoming `sx` with component defaults.
- Choosing whether a visual rule belongs in component `sx`, the theme, a slot prop, or global CSS.
- Reviewing responsive layout, stable component sizing, or theme token usage.

## Related Skills

- Load `.agents/skills/ref-spst-js-elysium/SKILL.md` when you need exact component imports, wrapper names, theme exports, or Elysium helper APIs.
- Load `.agents/skills/ref-spst-dev-site-architecture/SKILL.md` when the styling question also affects package boundaries, route structure, feature placement, or reusable component ownership.
- Load `.agents/skills/ref-spst-dev-code-conventions/SKILL.md` when the styling change also needs TypeScript, React, hook, or component-quality guidance.

## Inspect First

Before changing styling, inspect the nearest existing component and its import layer:

1. Confirm whether the file lives in `packages/main` or `packages/elysium`.
2. Check existing Elysium component imports before introducing new base primitives.
3. Check whether the component already exposes `sx`, `slotProps`, `slots`, `className`, or fixed dimensions.
4. Check whether a value already exists in `packages/main/src/styles/staticTheme.ts`, `packages/main/src/styles/theme.ts`, or `packages/elysium/themes/gamut` before adding magic numbers.
5. If changing layout, check mobile and desktop behavior, not only the viewport in front of you.

## Core Workflow

1. Keep styling local to the component that owns the visual behavior.
2. Promote repeated values into the local theme or a shared component only when repetition is real and meaningful.
3. Use Elysium wrappers instead of direct MUI imports, except for MUI icons.
4. Expose `sx` and slot props on reusable components so callers can extend styling without reaching into implementation details.
5. Merge `sx` arrays with `spreadSx`; never replace incoming styles accidentally.
6. Define responsive behavior mobile-first and give fixed-format controls stable dimensions.
7. Validate with lint/type-check, and use browser screenshots or manual viewport checks for layout-sensitive changes.

## Import Rules

In `packages/main`, app UI should go through Elysium:

| Need | Import |
| --- | --- |
| Base MUI primitive | `@swiftpost/elysium/ui/base/{ComponentName}` |
| Enhanced Elysium component | `@swiftpost/elysium/ui/{ComponentName}` |
| Elysium layout primitive | `@swiftpost/elysium/layouts/{ComponentName}` |
| `SxProps`, `Theme`, `InferSlotsFromSlotProps` | `@swiftpost/elysium/ui/types` |
| `spreadSx` | `@swiftpost/elysium/utils/styles/sxProps` |
| Static theme values | `@/styles/staticTheme` |
| MUI icons | `@mui/icons-material` |

Do not import app UI primitives directly from `@mui/material`. If the Elysium layer is missing a wrapper the app genuinely needs, add or expose it in `packages/elysium` first.

## `sx` Rules

- Accept `sx?: SxProps` on reusable visual components unless there is a concrete reason not to.
- Treat incoming `sx` as additive caller intent.
- Use `spreadSx(sx)` when composing arrays because `SxProps` may already be an array.
- Put component defaults first and caller overrides last when the caller should be able to override them.
- Keep `sx` objects readable; extract a named constant only when it removes noise or avoids duplication.
- Prefer theme tokens, responsive objects, and component props over ad hoc CSS strings.

Example default-plus-override merge:

```tsx
<Stack
  sx={[
    { width: '100%', minHeight: 0 },
    ...spreadSx(slotProps.root.sx),
    ...spreadSx(sx),
  ]}
>
  {children}
</Stack>
```

## Slots And SlotProps

Use Slots and SlotProps for reusable components that need overridable internal elements. Do not add slots to one-off page sections where ordinary composition is clearer.

Default pattern:

```tsx
import { memo } from 'react';
import Box from '@swiftpost/elysium/ui/base/Box';
import Stack from '@swiftpost/elysium/ui/base/Stack';
import type { InferSlotsFromSlotProps, SxProps } from '@swiftpost/elysium/ui/types';
import { spreadSx } from '@swiftpost/elysium/utils/styles/sxProps';

const componentBaseName = 'feature-panel';

interface SlotProps {
  root: {
    children: React.ReactNode;
    sx?: SxProps;
  };
  header?: {
    children: React.ReactNode;
    sx?: SxProps;
  };
}

interface Props {
  slots?: Partial<InferSlotsFromSlotProps<SlotProps>>;
  slotProps: SlotProps;
  sx?: SxProps;
}

const FeaturePanel: React.FC<Props> = ({ slots, slotProps, sx }) => {
  const Root = slots?.root ?? Stack;
  const Header = slots?.header ?? Box;

  return (
    <Root
      className={componentBaseName}
      sx={[{ width: '100%' }, ...spreadSx(slotProps.root.sx), ...spreadSx(sx)]}
    >
      {slotProps.header != null && (
        <Header
          className={`${componentBaseName}-header`}
          sx={[{ width: '100%' }, ...spreadSx(slotProps.header.sx)]}
        >
          {slotProps.header.children}
        </Header>
      )}
      {slotProps.root.children}
    </Root>
  );
};

export type FeaturePanelProps = Props;
export default memo(FeaturePanel);
```

Slot rules:

- Name slots after their role in the component, not after the current HTML tag.
- Use `Partial<InferSlotsFromSlotProps<SlotProps>>` for optional slot overrides.
- Keep `slotProps` typed and explicit; avoid loose records of arbitrary props.
- Use a stable kebab-case `componentBaseName` for class names when internal parts need CSS targeting.
- Wrap reusable components in `memo` unless local state, refs, or behavior make that inappropriate.
- Do not expose slots only to work around a poor component boundary. Split or compose the component first.

## Responsive Layout

- Write mobile-first base styles and override at larger breakpoints.
- Prefer MUI responsive objects for simple breakpoint changes.
- Use stable dimensions for controls, grids, tiles, boards, toolbars, and media regions so labels, hover states, and loading text do not shift layout.
- Use `minWidth: 0` on flex/grid children that contain text and need to shrink.
- Use `overflow`, wrapping, or smaller local typography intentionally when content can be long.
- Do not scale font sizes with viewport width. Use component-appropriate typography variants and breakpoint-specific values when needed.

Example:

```tsx
sx={{
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) auto' },
  gap: { xs: 2, md: 3 },
  minWidth: 0,
}}
```

## Theme And Tokens

- Use `staticTheme` from `@/styles/staticTheme` for static app values that need to be available outside client-only theme callbacks.
- Use Elysium theme exports from `@swiftpost/elysium/themes/gamut` or `@swiftpost/elysium/themes/gamut/static` when working inside the Elysium package.
- Use spacing, palette, typography, and breakpoint tokens rather than repeating raw values.
- Keep palette changes coordinated with `packages/main/src/styles/theme.ts` and `packages/elysium/themes/gamut` instead of scattering color literals.
- Add theme tokens only when they represent a reusable product decision, not a single local spacing tweak.

## Global CSS

Use `packages/main/src/app/globals.css` for true global behavior such as resets, base document sizing, or framework-level defaults. Do not put component-specific styling there when `sx`, theme components, or a component-local wrapper can own it.

Global CSS is appropriate for:

- `html`, `body`, and root layout sizing.
- Font smoothing or base rendering behavior.
- Intentional framework/global resets.

Global CSS is not appropriate for:

- Styling a one-off page section.
- Reaching into an Elysium component because it lacks a slot or prop.
- Adding broad selectors that can surprise unrelated routes.

## Review Checklist

- Imports go through Elysium in app code.
- Incoming `sx` and slot `sx` are merged, not overwritten.
- Slot names describe roles and class names use a stable `componentBaseName`.
- Responsive behavior is mobile-first and text cannot overlap adjacent UI.
- Fixed-format UI has stable dimensions.
- Theme values are reused where they already exist.
- Global CSS changes are truly global.
- The change has been validated with `yarn lint:ci && yarn typecheck:ci` when behavior or TypeScript surfaces changed.