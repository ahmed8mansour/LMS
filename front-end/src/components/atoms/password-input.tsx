"use client";

import * as React from "react";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { Input } from "./input";
import { Button } from "./button";
import { cn } from "@/lib/utils"; // Your shadcn utility for tailwind-merge

const PasswordInput = React.forwardRef<
    HTMLInputElement,
    React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => {
    const [showPassword, setShowPassword] = React.useState(false);

    return (
        <div className={cn("relative", className)}>
            <Input
                ref={ref}
                // Dynamically change the input type based on showPassword state
                type={showPassword ? "text" : "password"}
                // Add padding to the right to prevent text from overlapping the icon
                className="pr-10"
                {...props}
            />
            <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowPassword((prev) => !prev)}
                // Prevent the button from taking focus when clicked
                onMouseDown={(e) => e.preventDefault()}
            >
                {showPassword ? (
                    <EyeOffIcon className="h-4 w-4" />
                ) : (
                    <EyeIcon className="h-4 w-4" />
                )}
            </Button>
        </div>
    );
});

PasswordInput.displayName = "PasswordInput";

export { PasswordInput };
