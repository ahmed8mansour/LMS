import type { Metadata } from "next";

import NavBar from "@/components/organisms/NavBar";
import Footer from "@/components/organisms/Footer";


export default function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main
      className={` font-manrope antialiased bg-lightbg flex flex-col min-h-screen`}
    >
      <NavBar />
      <main className="flex flex-col flex-1">

        {children}
      </main>
      <Footer />
    </main>
  );
}
