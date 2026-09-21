"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Table primitive (spec 010).
 *
 * shadcn's table, restyled onto the house palette. Its defaults (`muted`, `border`,
 * `foreground`) are the shadcn neutral scale, which reads as a foreign grey next to the
 * rest of the app; every surface here uses the project's own tokens instead — borders on
 * `graytext/20`, header labels on `graytext2`, body text on `darktext`, hover on `lightbg`
 * and selection on `darkmint` — matching the card and tile idiom established in 009
 * (`featuers/instructor-analytics/components/ChartCard.tsx`).
 *
 * Two deliberate choices, because 012 (reviews) and 013 (earnings) inherit them:
 *
 * - **No background.** The consuming card owns the surface (`bg-white` on the wrapper), so
 *   the table composes into any container without fighting it for a background.
 * - **No `dark:` variants.** The house palette is not redefined under `.dark`, and no other
 *   component in the project carries them; adding them here alone would make this the only
 *   inconsistent primitive. Revisit when the palette itself gains a dark scale.
 *
 * The container keeps `overflow-x-auto`, so a table too wide for its column scrolls
 * *itself* rather than the page — SC-009 forbids horizontal **page** scroll. Views that
 * must show every field at 375px restructure the row instead of relying on this.
 */
function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div data-slot="table-container" className="relative w-full overflow-x-auto">
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm text-darktext", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b [&_tr]:border-graytext/20", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t border-graytext/20 bg-darkbg/60 font-medium text-darktext [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b border-graytext/20 transition-colors hover:bg-lightbg has-aria-expanded:bg-lightbg data-[state=selected]:bg-darkmint/5",
        className
      )}
      {...props}
    />
  )
}

/**
 * Header cells carry the project's label treatment — the same small uppercase
 * `graytext2` used by the analytics tiles and by the wireframe's column headings —
 * rather than shadcn's plain `font-medium text-foreground`.
 */
function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-11 px-3 text-left align-middle text-xs font-semibold tracking-wide whitespace-nowrap text-graytext2 uppercase [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "px-3 py-3 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({ className, ...props }: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-graytext2", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
