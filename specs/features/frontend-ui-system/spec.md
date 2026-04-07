# Frontend UI System - Specification

## What This Feature Does

The Frontend UI System provides the complete design system and component library for the LMS platform. It implements a consistent visual language across all user-facing pages, built on top of Tailwind CSS v4 and shadcn/ui patterns using Radix UI primitives.

### Key Responsibilities

1. **Visual Consistency**: Provides a unified color palette, typography, and spacing system used across the entire application
2. **Component Library**: Offers reusable UI components from basic primitives (atoms) to complex page sections (organisms)
3. **Responsive Design**: Ensures all components work across mobile, tablet, and desktop viewports
4. **Loading States**: Provides skeleton loaders and bounce animations for async operations
5. **Form Handling**: Supplies form inputs, validation displays, and field groupings with consistent styling
6. **Toast Notifications**: Displays success/error/info/warning messages via Sonner toast library

---

## Components Overview

### Atoms (Primitive Components)

Located in `front-end/src/components/atoms/`

| Component | File | Purpose | Props/Variants |
|-----------|------|---------|----------------|
| **Button** | `button.tsx` | Clickable actions | `variant`: default, destructive, outline, secondary, ghost, link, darkmint; `size`: default, sm, lg, icon, icon-sm, icon-lg |
| **Input** | `input.tsx` | Text input fields | Standard HTML input props with custom styling |
| **PasswordInput** | `password-input.tsx` | Password field with toggle | Inherits from Input, adds visibility toggle |
| **Avatar** | `avatar.tsx` | User profile images | `Avatar`, `AvatarImage`, `AvatarFallback` subcomponents |
| **Checkbox** | `checkbox.tsx` | Binary selection | Uses Radix Checkbox primitive |
| **Select** | `select.tsx` | Dropdown selection | Full Select/Trigger/Content/Item/Label/Separator composition |
| **Accordion** | `accordion.tsx` | Collapsible sections | `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent` |
| **Slider** | `slider.tsx` | Range selection | Single/double thumb range slider |
| **Skeleton** | `skeleton.tsx` | Loading placeholder | Animated pulse background |
| **Sonner** | `sonner.tsx` | Toast notifications | Configured with custom icons for success/info/warning/error |
| **Label** | `label.tsx` | Form labels | Standard label with styling |
| **Separator** | `separator.tsx` | Visual dividers | Horizontal/vertical dividers |
| **InputOTP** | `input-otp.tsx` | OTP code input | 6-digit code entry with caret animation |
| **DropdownMenu** | `dropdown-menu.tsx` | Context menus | Full Radix menu system |
| **BounceLoader** | `bouncing-loader.tsx` | Loading animation | Three bouncing dots |
| **SearchLoading** | `search-loading.tsx` | Search spinner | Rotating loader icon |
| **ButtonLoading** | `buttonloading.tsx` | Button spinner | Inline loading state |

### Molecules (Composite Components)

Located in `front-end/src/components/molecules/`

| Component | File | Purpose |
|-----------|------|---------|
| **CourseCard** | `CourseCard.tsx` | Course preview card with image, title, price, instructor, rating |
| **Filters** | `Filters.tsx` | Course filtering sidebar with categories, levels, price range, rating |
| **SearchAndSort** | `SearchAndSort.tsx` | Search input + sort dropdown combo |
| **CourseCardSkeleton** | `CourseCardSkeleton.tsx` | Skeleton loader for course cards |
| **CourseSectionItem** | `CourseSectionItem.tsx` | Individual section display in course detail |
| **LogoWithText** | `LogoWithText.tsx` | Brand logo component |
| **RadioGroup** | `radio-group.tsx` | Custom radio button group |
| **ButtonRadioGroup** | `ButtonRadioGroup.tsx` | Radio buttons styled as buttons |
| **HomeRadioGroup** | `HomeRadioGroup.tsx` | Category filter for homepage |
| **ServiceItem** | `ServiceItem.tsx` | Service highlight component |

### Organisms (Page Sections)

Located in `front-end/src/components/organisms/`

| Component | File | Purpose |
|-----------|------|---------|
| **NavBar** | `NavBar.tsx` | Sticky navigation with mobile menu, links, user avatar |
| **Footer** | `Footer.tsx` | Site footer with logo, description, social links, navigation columns |
| **Hero** | `Hero.tsx` | Homepage hero section with CTA, stats, featured course card |
| **ServicesSection** | `ServicesSection.tsx` | Homepage services/features grid |

### Field System Components

Located in `front-end/src/components/atoms/field.tsx` - A comprehensive form field abstraction:

| Component | Purpose |
|-----------|---------|
| **Field** | Container with vertical/horizontal/responsive orientation |
| **FieldSet** | Fieldset wrapper with gap management |
| **FieldLegend** | Legend with legend/label variants |
| **FieldGroup** | Groups multiple fields with consistent spacing |
| **FieldLabel** | Smart label with disabled state handling |
| **FieldTitle** | Title with checked state styling |
| **FieldContent** | Content wrapper for complex fields |
| **FieldDescription** | Helper text with link styling |
| **FieldError** | Error message display with array support |
| **FieldSeparator** | Separator with optional content |

---

## Data Flow

### Component Hierarchy

```
Layout (root layout.tsx)
├── Toaster (global toast notifications)
├── QueryProvider (React Query context)
└── Page Content
    ├── NavBar (organism)
    │   ├── LogoWithText (molecule)
    │   └── UserAvatar (feature component)
    ├── Page-Specific Content
    │   ├── Hero (organism)
    │   │   ├── Button (atom)
    │   │   └── Avatar (atom)
    │   ├── Filters (molecule)
    │   │   ├── Checkbox (atom)
    │   │   ├── Slider (atom)
    │   │   └── RadioGroup (molecule)
    │   └── CourseCard[] (molecule)
    │       ├── Avatar (atom)
    │       └── Button (atom)
    └── Footer (organism)
        └── LogoWithText (molecule)
```

### Styling Flow

1. **CSS Variables** (`globals.css`):
   - Theme colors defined with OKLCH values
   - Custom brand colors: `darkmint`, `lightbg`, `darktext`, etc.
   - Radius and spacing tokens

2. **Tailwind Classes**:
   - Mobile-first responsive prefixes
   - Component-specific styling via `cn()` utility
   - `data-slot` attributes for debugging

3. **Component Composition**:
   - Radix primitives provide functionality
   - Tailwind provides styling
   - `class-variance-authority` (CVA) for variant management

### Toast Notification Flow

```
Action Trigger (API call)
    ↓
Toast Utility (`lib/toast.tsx`)
    ↓
Sonner Toaster Component
    ↓
Visual Notification (top-right position)
```

### Loading State Flow

```
Route/Page Loading
    ↓
loading.tsx (from app directory)
    ↓
BounceLoader or Page Skeleton
    ↓
Content Hydrates
    ↓
Actual Components Render
```

---

## Edge Cases Handled

### Responsive Design

| Edge Case | Handling |
|-----------|----------|
| Mobile navigation overflow | NavBar collapses to hamburger menu with slide-down animation |
| Touch targets | Minimum 44px tap targets on mobile |
| Course card grid | 1 column mobile → 2 columns tablet → 3+ columns desktop |
| Hero text scaling | Fluid typography using `clamp()` via Tailwind classes |

### Form Handling

| Edge Case | Handling |
|-----------|----------|
| Empty states | `data-[placeholder]` styling for select inputs |
| Invalid states | `aria-invalid` with red border and ring |
| Disabled states | Opacity reduction + cursor change |
| Password visibility | Toggle button that prevents focus loss |

### Loading States

| Edge Case | Handling |
|-----------|----------|
| Route transitions | `loading.tsx` files at each route level |
| Data fetching | Skeleton components match final layout dimensions |
| Button submission | Loading spinner replaces content, disabled state |
| Search input | Debounced loading indicator |

### Accessibility

| Edge Case | Handling |
|-----------|----------|
| Keyboard navigation | All Radix primitives provide full keyboard support |
| Focus management | Visible focus rings on interactive elements |
| Screen readers | Proper ARIA labels on icon-only buttons |
| Reduced motion | Respects `prefers-reduced-motion` (via Tailwind) |

---

## Known Limitations / TODOs

### Current Limitations

1. **Dark Mode**: CSS variables defined but not fully implemented across all components
   - Dark mode classes commented out in several atom components
   - No theme toggle implemented

2. **Component Documentation**: No Storybook or visual documentation
   - Components must be discovered by browsing source
   - Props interfaces not externally documented

3. **Test Coverage**: No visual regression tests
   - No snapshot testing for UI components
   - No automated accessibility testing

4. **Browser Support**: Tailwind v4 requires modern browsers
   - No explicit browser compatibility matrix
   - Uses modern CSS features (OKLCH, CSS variables)

### TODOs

1. **Rich Text Editor**: No RTE component for course descriptions
   - Needed for instructor dashboard

2. **Date Picker**: No calendar/date selection component
   - Would need for enrollment date filtering

3. **File Upload**: No drag-and-drop upload component
   - Needed for profile pictures and course thumbnails

4. **Video Player**: No video component
   - Course lectures need video player integration

5. **Charts/Graphs**: No data visualization components
   - Would be needed for progress analytics

6. **Virtual Scrolling**: No virtualized list component
   - Course lists may need virtualization for performance

7. **Theme Toggle**: No dark/light mode switcher
   - All CSS variables prepared but no UI control

### Technical Debt

1. **Type Safety**: Some components use `any` types for flexibility
2. **CSS Organization**: Some component-specific styles in global CSS (e.g., `.hero_right`)
3. **Icon Library**: Mix of Lucide React and React Icons (inconsistent)
4. **Responsive Breakpoints**: Some hardcoded values instead of theme tokens

---

## Integration Points

### Dependencies

| Package | Purpose |
|---------|---------|
| `tailwindcss` v4 | Styling framework |
| `radix-ui/*` | Headless UI primitives |
| `class-variance-authority` | Component variant management |
| `clsx` + `tailwind-merge` | Conditional class merging (`cn()` utility) |
| `sonner` | Toast notifications |
| `lucide-react` | Icon library |
| `react-icons` | Alternative icon library |
| `input-otp` | OTP input component |

### File Locations

- **Config**: `front-end/components.json` (shadcn/ui configuration)
- **Styles**: `front-end/src/assets/styles/globals.css`
- **Utilities**: `front-end/src/lib/utils.ts`
- **Components**: `front-end/src/components/{atoms,molecules,organisms}/`
- **Feature Components**: `front-end/src/featuers/*/components/`
