import type { Metadata } from "next";
import { Toaster } from "@/components/atoms/sonner";
import { InstructorSidebar } from "@/components/organisms/InstructorSidebar";

export const metadata: Metadata = {
    title: "Instructor",
    description: "Instructor workspace",
};

export default function InstructorLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <main className="font-manrope antialiased bg-lightbg flex min-h-screen">
            <InstructorSidebar />
            <main className="min-h-screen flex-1 md:p-8 py-8 px-4 overflow-y-auto">
                {children}
            </main>
            <Toaster />
        </main>
    );
}
