import * as React from "react"
import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // Base
        "h-12 w-full rounded-md px-3 py-1 text-base md:text-sm outline-none transition-all duration-300",

        // Light mode (default)
        "bg-lightbg text-darktext border border-graylighttext/40 placeholder:text-[#94A3B8]",

        // Focus
        "focus:border-graylighttext ",

        // Dark mode
        // "dark:bg-darkbg2 dark:text-darkgray dark:border-input dark:placeholder:text-muted-foreground",
        // "dark:focus:border-ring dark:focus:ring-ring/50",

        // States
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",

        className
      )}
      {...props}
    />
  )
}

export { Input }

