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
      className={` font-manrope antialiased bg-lightbg`}
    >
      <NavBar />
      {children}
      <Footer />
    </main>
  );
}
