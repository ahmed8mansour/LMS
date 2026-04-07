# Frontend UI System - Architecture Plan

## How This Feature Was Architected

### Design Philosophy

The UI system follows **Atomic Design** methodology, breaking interfaces into composable, reusable pieces. This provides:

1. **Predictable Structure**: Every component has a known location based on complexity
2. **Reusability**: Atoms compose into molecules; molecules into organisms
3. **Maintainability**: Changes to primitives propagate consistently
4. **Testability**: Small, focused components are easier to test

### Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│  ORGANISMS (Page Sections)                                  │
│  NavBar, Footer, Hero, ServicesSection                     │
│  - Complex, self-contained page sections                   │
│  - Compose molecules and atoms                               │
├─────────────────────────────────────────────────────────────┤
│  MOLECULES (Composite Components)                           │
│  CourseCard, Filters, SearchAndSort, RadioGroup            │
│  - Domain-specific combinations of atoms                   │
│  - Business logic begins here                              │
├─────────────────────────────────────────────────────────────┤
│  ATOMS (Primitives)                                         │
│  Button, Input, Avatar, Select, Checkbox, etc.             │
│  - Basic UI building blocks                                  │
│  - No business logic, purely presentational                │
├─────────────────────────────────────────────────────────────┤
│  TOKENS (Design System)                                      │
│  Colors, Typography, Spacing, Radius, Animations            │
│  - Tailwind configuration + CSS variables                    │
│  - Single source of truth for visual language              │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Architectural Decisions

### 1. Tailwind CSS v4 with @theme

**Decision**: Use Tailwind v4's new `@theme inline` directive with CSS custom properties.

**Why**:
- **Runtime theming**: CSS variables allow dynamic theme changes (needed for dark mode)
- **OKLCH colors**: Perceptually uniform color space for better accessibility
- **Type safety**: Tailwind v4 provides better IntelliSense via CSS
- **Performance**: No runtime JavaScript for theming

**Implementation**:
```css
@theme inline {
  --color-darkmint: #2B5869;
  --color-lightbg: #F9FAFB;
  --font-manrope: "Manrope";
  /* ... */
}
```

### 2. shadcn/ui + Radix Primitives

**Decision**: Build components on Radix UI primitives via shadcn/ui patterns.

**Why**:
- **Accessibility**: Radix handles ARIA, focus management, keyboard navigation
- **Customization**: Full control over styling (unlike Material-UI/Chakra)
- **No runtime bundle**: Components are source code, not a library dependency
- **Consistent API**: Radix patterns are familiar across the ecosystem

**Implementation Pattern**:
```tsx
// Radix provides functionality
import * as SelectPrimitive from "@radix-ui/react-select";

// We provide styling
function Select({ ...props }) {
  return <SelectPrimitive.Root data-slot="select" {...props} />;
}
```

### 3. class-variance-authority (CVA) for Variants

**Decision**: Use CVA for component variant management.

**Why**:
- **Type safety**: Variants are fully typed
- **Composition**: Easy to extend and compose variants
- **Tailwind integration**: Merges classes intelligently
- **Developer experience**: Clear API for consumers

**Example** (Button):
```tsx
const buttonVariants = cva(
  "base classes...",
  {
    variants: {
      variant: { default: "...", darkmint: "..." },
      size: { default: "...", sm: "...", lg: "..." },
    },
  }
);
```

### 4. cn() Utility Function

**Decision**: Create a `cn()` utility combining `clsx` and `tailwind-merge`.

**Why**:
- **Conditional classes**: `clsx` handles conditional class names cleanly
- **Conflict resolution**: `tailwind-merge` removes duplicate Tailwind classes
- **Consistency**: Single function for all class name operations

**Implementation**:
```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### 5. data-slot Attributes

**Decision**: Add `data-slot` attributes to all component elements.

**Why**:
- **Debugging**: Easy to identify component boundaries in DevTools
- **Testing**: CSS selectors for component queries
- **Styling hooks**: Target specific component parts

**Example**:
```tsx
<button data-slot="button" data-variant={variant} ... />
```

### 6. Field Component Abstraction

**Decision**: Create a comprehensive Field system for form layouts.

**Why**:
- **Consistency**: All forms have identical spacing and alignment
- **Responsiveness**: Built-in orientation variants (vertical, horizontal, responsive)
- **Accessibility**: Proper fieldset/legend/group relationships
- **Error handling**: Standardized error display across all inputs

**Architecture**:
```
FieldSet (fieldset)
├── FieldLegend (legend)
├── FieldGroup (div)
│   ├── Field (div[role="group"])
│   │   ├── FieldLabel (Label)
│   │   ├── Input (atom)
│   │   └── FieldError (div[role="alert"])
```

### 7. Custom Brand Variant (darkmint)

**Decision**: Add custom `darkmint` variant to Button component.

**Why**:
- **Brand consistency**: Primary CTA uses brand color (#2B5869)
- **Semantic meaning**: `darkmint` is more meaningful than color codes
- **Future flexibility**: Can change color in one place

**Trade-off**: Diverges from shadcn/ui defaults, but necessary for brand identity.

---

## Component Hierarchy Decisions

### Atoms are Headless + Styled

Atoms wrap Radix primitives with Tailwind classes but remain unopinionated about:
- Layout (margin/padding)
- Sizing (width/height)
- Positioning (except where necessary for functionality)

**Example**:
```tsx
// Input provides styling, not layout
<Input className="w-full max-w-md" />  // Layout added by consumer
```

### Molecules are Domain-Specific

Molecules like CourseCard know about:
- Course data structure (via props interface)
- Business domain (courses, instructors, ratings)
- Common patterns (click handlers, navigation)

They don't know about:
- API calls (handled by parent/hooks)
- Global state (receive via props)

### Organisms are Page-Sections

Organisms like Hero are:
- Self-contained sections
- Composed of multiple molecules
- Aware of page-level layout
- Not reusable across different page contexts

---

## State Management Decisions

### Local State in Components

- **Mobile menu toggle**: Managed in NavBar (isMenuOpen)
- **Password visibility**: Managed in PasswordInput (showPassword)
- **Filter panel**: Could be managed in Filters component

### Server State via React Query

- **Course data**: Fetched via TanStack Query
- **User state**: Managed via Zustand store
- **Loading states**: Derived from query status

### No Component-Level Server State

UI components remain presentational:
- Data passed via props
- Callbacks for interactions
- No API calls in component files

---

## What Would Need to Change if Requirements Change

### Adding a New Theme (e.g., High Contrast)

**Changes Needed**:
1. Add new CSS variable definitions in `globals.css`
2. Create theme class (e.g., `.high-contrast`)
3. Update color values to meet contrast ratios
4. Add theme toggle component
5. Persist theme preference

**Scope**: Only CSS and a toggle component. Components remain unchanged.

### Adding a New Component Variant

**Changes Needed**:
1. Add variant to CVA config
2. Update TypeScript types
3. Add Storybook/docs example

**Scope**: Single component file.

### Changing Responsive Breakpoints

**Changes Needed**:
1. Update Tailwind config (if custom breakpoints)
2. Search/replace breakpoint classes in components
3. Test all affected components

**Scope**: Potentially many files. Breakpoints should be finalized early.

### Migrating to Another UI Library

**If switching to Material-UI/Chakra**:
- Replace atom components
- Keep molecule/organism structure
- Update import paths
- Adjust styling to match design

**Effort**: Moderate. The atomic design structure isolates the change to atoms.

### Supporting Right-to-Left (RTL) Languages

**Changes Needed**:
1. Add `dir="rtl"` support to Tailwind config
2. Replace directional classes (`ml-*` → `ms-*`, `mr-*` → `me-*`)
3. Update absolute positioning (left/right → start/end)
4. Test all components

**Current Status**: Already uses logical properties (`ms-*`, `me-*`) in some places.

### Adding Animation Library (Framer Motion)

**Changes Needed**:
1. Install Framer Motion
2. Create motion variants for common animations
3. Wrap components where needed
4. Update loading states

**Scope**: Can be incremental. New features use Framer Motion; existing remain.

---

## Extensibility Points

### Adding New Atoms

1. Create file in `components/atoms/{name}.tsx`
2. Use `cn()` for class merging
3. Add `data-slot` attribute
4. Export from feature index if needed

### Adding New Molecules

1. Identify required atoms
2. Create file in `components/molecules/{Name}.tsx`
3. Define props interface
4. Handle loading/error states

### Adding New Organisms

1. Plan composition (which molecules needed)
2. Create file in `components/organisms/{Name}.tsx`
3. Handle responsive behavior
4. Add to appropriate page layouts

---

## Performance Considerations

### Bundle Size

- **Tree-shaking**: Each component is a separate export
- **No library weight**: Radix primitives are modular
- **CSS**: Tailwind purges unused styles in production

### Runtime Performance

- **Memoization**: Components use `React.memo` where beneficial
- **Re-render boundaries**: Atoms re-render independently
- **No context overhead**: Zustand for global state, not React Context

### Animation Performance

- **CSS animations**: Prefer CSS over JavaScript animations
- **transform/opacity**: Only animate GPU-accelerated properties
- **will-change**: Used sparingly for critical animations

---

## Summary

This architecture prioritizes:

1. **Consistency**: Every component follows the same patterns
2. **Flexibility**: Easy to extend and customize
3. **Maintainability**: Clear file organization and naming
4. **Accessibility**: Built on Radix primitives with ARIA support
5. **Performance**: Minimal runtime overhead, CSS-first approach

The system is designed to scale with the LMS platform, supporting future features like the student dashboard, instructor tools, and admin interfaces without architectural changes.
