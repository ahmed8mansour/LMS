# Frontend UI System - Data Model

## Overview

The Frontend UI System is primarily a **presentational layer** and does not own domain entities in the traditional sense. However, it defines TypeScript interfaces for component props and works closely with entities from other features.

This document covers:
1. Component prop interfaces (owned by UI system)
2. Data structures passed to components (from other features)
3. UI-specific state types

---

## Component Prop Interfaces

### Atom Component Props

#### Button Props
```typescript
interface ButtonProps extends React.ComponentProps<"button"> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | "darkmint";
  size?: "default" | "sm" | "lg" | "icon" | "icon-sm" | "icon-lg";
  asChild?: boolean;  // Uses Radix Slot for composition
}
```

#### Input Props
```typescript
interface InputProps extends React.ComponentProps<"input"> {
  // Inherits all standard input props
  // Custom styling via className
}
```

#### PasswordInput Props
```typescript
interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  // Extends Input with visibility toggle functionality
}
```

#### Avatar Props
```typescript
interface AvatarProps extends React.ComponentProps<typeof AvatarPrimitive.Root> {
  className?: string;
}

interface AvatarImageProps extends React.ComponentProps<typeof AvatarPrimitive.Image> {
  src?: string;
  alt?: string;
}

interface AvatarFallbackProps extends React.ComponentProps<typeof AvatarPrimitive.Fallback> {
  children?: React.ReactNode;
}
```

#### Select Props
```typescript
interface SelectTriggerProps extends React.ComponentProps<typeof SelectPrimitive.Trigger> {
  size?: "sm" | "default";
}

interface SelectContentProps extends React.ComponentProps<typeof SelectPrimitive.Content> {
  position?: "item-aligned" | "popper";
  align?: "center" | "start" | "end";
}
```

#### Slider Props
```typescript
interface SliderProps extends React.ComponentProps<typeof SliderPrimitive.Root> {
  defaultValue?: number[];
  value?: number[];
  min?: number;
  max?: number;
  step?: number;
}
```

#### Checkbox Props
```typescript
interface CheckboxProps extends React.ComponentProps<typeof CheckboxPrimitive.Root> {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}
```

#### Accordion Props
```typescript
interface AccordionProps extends React.ComponentProps<typeof AccordionPrimitive.Root> {
  type?: "single" | "multiple";
  collapsible?: boolean;
}

interface AccordionItemProps extends React.ComponentProps<typeof AccordionPrimitive.Item> {
  value: string;
}

interface AccordionTriggerProps extends React.ComponentProps<typeof AccordionPrimitive.Trigger> {}
interface AccordionContentProps extends React.ComponentProps<typeof AccordionPrimitive.Content> {}
```

#### InputOTP Props
```typescript
interface InputOTPProps extends React.ComponentProps<typeof OTPInput> {
  containerClassName?: string;
  maxLength?: number;
  value?: string;
  onChange?: (value: string) => void;
}

interface InputOTPSlotProps extends React.ComponentProps<"div"> {
  index: number;
}
```

---

### Field System Props

#### Field Props
```typescript
interface FieldProps extends React.ComponentProps<"div"> {
  orientation?: "vertical" | "horizontal" | "responsive";
}

interface FieldLegendProps extends React.ComponentProps<"legend"> {
  variant?: "legend" | "label";
}

interface FieldLabelProps extends React.ComponentProps<typeof Label> {
  // Extends Label with smart field styling
}

interface FieldErrorProps extends React.ComponentProps<"div"> {
  errors?: Array<{ message?: string } | undefined>;
}
```

---

### Molecule Component Props

#### CourseCard Props
```typescript
interface CourseCardProps {
  id: number;
  ImageUrl: string;
  Name: string;
  About: string;
  Price: number;
  AvaterUrl: string;
  Instructor: string;
  Rate: number;
  Subscribers: number;
  Tag?: string;
}
```

#### Filters Props
```typescript
// Uses custom hooks, minimal direct props
interface FiltersProps {
  // Relies on useFilters() hook for state
}

interface RadioGroupProps {
  level: string | null;
  setFilter: (key: string, value: string) => void;
}

interface CheckboxGroupProps {
  categories: string[];
  toggleFilter: (key: string, value: string) => void;
}
```

#### SearchAndSort Props
```typescript
interface SearchAndSortProps {
  searchQuery: string;
  sortOption: string;
  onSearchChange: (query: string) => void;
  onSortChange: (option: string) => void;
}
```

#### CourseCardSkeleton Props
```typescript
// No props - self-contained skeleton
```

---

### Organism Component Props

#### NavBar Props
```typescript
// No props - uses internal state for mobile menu
interface NavBarState {
  isMenuOpen: boolean;
}
```

#### Footer Props
```typescript
// No props - static content
```

#### Hero Props
```typescript
// No props - static marketing content
```

#### ServicesSection Props
```typescript
// No props - static content
```

---

## Relationships to Other Features

### Authentication Feature

**Components that consume auth data:**

| UI Component | Auth Entity | Relationship |
|--------------|-------------|--------------|
| `UserAvater` | `CustomUser` | Displays user profile image/fallback |
| `NavBar` | Auth state | Shows login/register vs user menu |
| `LoginForm` | Login API | Submits credentials, shows errors |
| `RegisterForm` | Register API | Submits registration data |

**Auth Types Used:**
```typescript
// From authentication feature
interface UserData {
  id: number;
  email: string;
  username: string;
  role: "student" | "instructor" | "admin";
  profile_picture: string | null;
  is_email_verified: boolean;
}
```

### Courses Feature

**Components that consume course data:**

| UI Component | Course Entity | Relationship |
|--------------|---------------|--------------|
| `CourseCard` | `Course` | Displays course summary data |
| `Filters` | Filter params | Reads/writes URL filter state |
| `CourseSectionItem` | `Section` | Displays section in accordion |

**Course Types Used:**
```typescript
// From courses feature
interface Course {
  id: number;
  title: string;
  description: string;
  thumbnail: string;
  price: number;
  category: string;
  level: "beginner" | "intermediate" | "advanced";
  language: string;
  rating: number;
  reviews_count: number;
  subscribers_count: number;
  created_at: string;
  instructor: InstructorProfile;
}

interface Section {
  id: number;
  title: string;
  order: number;
  lectures: Lecture[];
  quiz: Quiz | null;
}
```

---

## UI-Specific State Types

### Toast Notification Types

```typescript
// lib/toast.tsx
interface ToastOptions {
  position?: "top-right" | "top-center" | "top-left" | "bottom-right" | "bottom-center" | "bottom-left";
  duration?: number;
  icon?: React.ReactNode;
}

type ToastType = "success" | "error" | "info" | "warning" | "loading";
```

### Loading State Types

```typescript
// Components loading states
interface LoadingState {
  isLoading: boolean;
  isError: boolean;
  error?: Error | null;
}
```

### Filter State Types

```typescript
// hooks/useFilters.ts
interface FilterState {
  categories: string[];
  level: string | null;
  min_price: number;
  max_price: number;
  rating: number;
  search: string;
  sort: "newest" | "popular" | "price_low" | "price_high";
}
```

---

## CSS Variables (Design Tokens)

### Colors

| Variable | Value | Usage |
|----------|-------|-------|
| `--color-darkmint` | `#2B5869` | Primary brand color, CTAs |
| `--color-lightmint` | `#E5E7EB` | Secondary brand, badges |
| `--color-lightbg` | `#F9FAFB` | Page background |
| `--color-darkbg` | `#F3F4F6` | Card backgrounds, borders |
| `--color-darktext` | `#111618` | Primary text |
| `--color-graytext` | `#4B5563` | Secondary text |
| `--color-graytext2` | `#6B7280` | Tertiary text |
| `--color-graylighttext` | `#9CA3AF` | Muted text, placeholders |

### Theme Variables (OKLCH)

| Variable | Light Mode | Dark Mode | Purpose |
|----------|------------|-----------|---------|
| `--background` | `oklch(1 0 0)` | `oklch(0.145 0 0)` | Page background |
| `--foreground` | `oklch(0.145 0 0)` | `oklch(0.985 0 0)` | Primary text |
| `--primary` | `oklch(0.205 0 0)` | `oklch(0.922 0 0)` | Primary actions |
| `--secondary` | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` | Secondary elements |
| `--muted` | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` | Muted backgrounds |
| `--accent` | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` | Accent elements |
| `--destructive` | `oklch(0.577 0.245 27.325)` | `oklch(0.704 0.191 22.216)` | Error states |
| `--border` | `oklch(0.922 0 0)` | `oklch(1 0 0 / 10%)` | Borders |
| `--input` | `oklch(0.922 0 0)` | `oklch(1 0 0 / 15%)` | Input backgrounds |
| `--ring` | `oklch(0.708 0 0)` | `oklch(0.556 0 0)` | Focus rings |

### Spacing Scale

Based on Tailwind defaults (4px = 1 unit):

| Token | Value | Usage |
|-------|-------|-------|
| `spacing-1` | 4px | Tight spacing |
| `spacing-2` | 8px | Default element gaps |
| `spacing-3` | 12px | Form field gaps |
| `spacing-4` | 16px | Section padding |
| `spacing-6` | 24px | Card padding |
| `spacing-8` | 32px | Section gaps |

### Border Radius Scale

| Token | Value | Usage |
|-------|-------|-------|
| `--radius` | 0.625rem (10px) | Base radius |
| `radius-sm` | calc(var(--radius) - 4px) | Small elements |
| `radius-md` | calc(var(--radius) - 2px) | Default |
| `radius-lg` | var(--radius) | Cards, buttons |
| `radius-xl` | calc(var(--radius) + 4px) | Large cards |
| `radius-2xl` | calc(var(--radius) + 8px) | Modals |
| `radius-3xl` | calc(var(--radius) + 12px) | Hero elements |
| `radius-4xl` | calc(var(--radius) + 16px) | Rounded containers |

---

## Component Composition Patterns

### Compound Components

Components designed to work together:

```
Select
├── SelectTrigger
│   └── SelectValue
├── SelectContent
│   ├── SelectGroup
│   │   ├── SelectLabel
│   │   ├── SelectItem[]
│   │   └── SelectSeparator
│   ├── SelectScrollUpButton
│   └── SelectScrollDownButton
```

### Field Composition

```
FieldSet
├── FieldLegend
├── FieldGroup
│   ├── Field (orientation: "horizontal")
│   │   ├── Checkbox
│   │   └── FieldLabel
│   └── Field (orientation: "horizontal")
│       ├── Checkbox
│       └── FieldLabel
```

### Card Composition

```
CourseCard
├── Image Container
│   └── Image
├── Content
│   ├── Header (Name + Price)
│   ├── Description
│   └── Footer
│       ├── Instructor (Avatar + Name)
│       └── Rating (Stars + Count)
```

---

## Summary

The UI System's data model is primarily **prop interfaces** rather than domain entities. It:

1. **Receives data** from feature modules (auth, courses, etc.)
2. **Defines props** for component customization
3. **Maintains state** for UI-specific concerns (loading, open/closed, etc.)
4. **Provides tokens** for consistent styling

**Key Principle**: UI components are presentational and receive data via props. They don't own business entities, only their visual representation.
