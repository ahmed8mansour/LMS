---
name: stitch-to-nextjs
description: Convert Stitch-generated TSX components into production-ready Next.js components. 
Use this skill when the user pastes or references a Stitch-generated component and asks to 
convert it, integrate it, or make it work with the existing project. Triggers: "convert this 
stitch component", "حول هالكومبونانت", "make this work in my project", "fix the icons/tokens".
---

# Stitch → Next.js Converter

## Purpose

Stitch generates visually accurate but project-agnostic TSX. This skill bridges the gap by:
1. Extracting the real design system from the project's source files
2. Reading existing components to understand established patterns
3. Rewriting the Stitch output to be fully native to this codebase

---

## Phase 1 — Project Design System Extraction (ALWAYS run first)

Before touching any Stitch code, read the project's actual design tokens and patterns.

### 1A — Extract CSS Variables from global.css

```bash
# Find global CSS file
find . -name "globals.css" -o -name "global.css" | grep -v node_modules | head -5
```

Then read it and extract:
- All `--variable-name: value` definitions under `:root`
- Any `@layer base` overrides
- Any `@theme inline` overrides
- Dark mode token overrides (`.dark` or `[data-theme="dark"]`)

Build a mental token map:
--primary        → what color / used for what
--background     → page bg
--foreground     → text
--muted          → subtle backgrounds
--border         → borders
--radius         → border-radius value
etc.


### 1b — Sample 2–3 Existing Components for Pattern Recognition

```bash
# Find real UI components in the project
find ./components -name "*.tsx" | grep -v node_modules | head -20
```

Pick 2–3 components that are closest to the Stitch component type:
- If converting a Card → read an existing Card
- If converting a form → read an existing form component
- If converting a dashboard section → read an existing dashboard component

Read them and extract:
- Import patterns (which icon library? `lucide-react`? `heroicons`?)
- How className is constructed (`cn()` util? direct Tailwind?)
- Props interface conventions (named interface? inline type?)
- Data handling pattern (props drilled in? local mock data?)
- Any shared UI primitives used (`<Button>`, `<Badge>`, `<Card>` from shadcn?)

---

## Phase 2 — Icon Mapping

Stitch uses placeholder or generic icon names. Map them using the project's actual icon library.

### Identify the icon library:
```bash
grep -r "from 'lucide-react'\|from '@heroicons'\|from 'react-icons'" \
  ./components --include="*.tsx" -l | head -3
```

### Common Stitch icon → lucide-react mapping:
| Stitch icon concept | lucide-react |
|---|---|
| book, course | `BookOpen` |
| user, profile, avatar | `User`, `UserCircle` |
| settings, gear | `Settings` |
| check, complete, done | `CheckCircle2` |
| play, video, lecture | `PlayCircle` |
| chart, stats, progress | `BarChart3`, `TrendingUp` |
| lock, locked | `Lock` |
| star, rating | `Star` |
| clock, time, duration | `Clock` |
| arrow right/left | `ChevronRight`, `ChevronLeft` |
| home, dashboard | `LayoutDashboard` |
| logout | `LogOut` |
| plus, add | `Plus` |
| search | `Search` |
| edit, pen | `Pencil` |
| trash, delete | `Trash2` |
| upload, image | `Upload`, `ImagePlus` |
| billing, receipt | `Receipt` |
| certificate | `Award` |
| quiz | `ClipboardList` |

If the project uses a different library, map accordingly based on Phase 1C findings.

---

## Phase 3 — Conversion Rules

Apply ALL of the following when rewriting the Stitch component:

### Colors & Tokens
- Replace every hardcoded hex or rgb color with the matching Tailwind class found in Phase 1
- for example:
-- `#6C3FD4` or similar primary → `bg-primary`, `text-primary`
-- `#1E1B2E` or dark bg → `bg-sidebar` or the actual token name
-- `rgba(0,0,0,0.x)` → `bg-black/X` (Tailwind opacity modifier)
-- Never leave a hardcoded color. If unsure of mapping, use the closest semantic token.

### Spacing & Sizing  
- Replace hardcoded `px` values with Tailwind spacing scale equivalents
- `16px` → `p-4`, `24px` → `p-6`, `8px` → `p-2`, etc.
- If the project has custom spacing, use those keys

### Next.js Specifics
- `<img src="...">` → `<Image src="..." alt="..." width={} height={} />` from `next/image`
- `<a href="/path">` → `<Link href="/path">` from `next/link`
- No `document.*` or `window.*` without `'use client'` directive
- Add `'use client'` at top if component uses: useState, useEffect, onClick, onChange, etc.

### Hardcoded Data
- Extract all hardcoded arrays/objects into a `const mockData` block above the component
- Add a comment: `// TODO: replace with real API data`
- Keep the component itself receiving data via props

### className Utilities
- If the project uses `cn()` (clsx/tailwind-merge), use it for conditional classes
- Check Phase 1C to confirm: `grep -r "import.*cn" ./components | head -3`

### Existing UI Primitives
- If the project has shadcn/ui or custom `<Button>`, `<Card>`, `<Badge>` components,
  use them instead of hand-rolled divs
- Check: `ls ./components/ui/`

---

## Phase 4 — Output Format

Produce the converted component with this structure:

```typescript
'use client' // only if needed

// 1. Next.js imports
import Image from 'next/image'
import Link from 'next/link'

// 2. Icon imports (grouped)
import { BookOpen, CheckCircle2 } from 'lucide-react'

// 3. UI primitive imports (if used)
import { Button } from '@/components/ui/button'



// 5. Mock data (if applicable)
const mockData = [
  // TODO: replace with real API data
]

// 6. Component
export default function ComponentName({ ...props }: ComponentNameProps) {
  return (
    // JSX using only project-native classes and tokens
  )
}
```

---

## Phase 5 — Self-Check Before Delivering

Before outputting, verify:
- [ ] Zero hardcoded hex colors remaining
- [ ] All icons imported from the correct library
- [ ] `'use client'` present if using hooks or event handlers
- [ ] All `<img>` replaced with `<Image>`
- [ ] All `<a>` replaced with `<Link>`
- [ ] Props interface defined
- [ ] Hardcoded data extracted to `mockData`
- [ ] `cn()` used for conditional classNames if project uses it
- [ ] No unused imports

If any check fails, fix it before delivering.