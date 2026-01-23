"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { FiMenu, FiX } from "react-icons/fi";
import { RiGraduationCapFill } from "react-icons/ri";

import { Button } from "../atoms/button";
const NAV_LINKS = [
  { label: "Explore", href: "/" },
  { label: "Pricing", href: "#projects" },
  { label: "Enterprise", href: "#skills" },
  // { label: "Experience", href: "#experience" },
];

const NavBar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b backdrop-blur font-manrope">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 text-darkmint text-lg leading-7 font-extrabold">
            <div className="bg-darkmint w-8 h-8 flex items-center justify-center rounded-[8px]">
              <RiGraduationCapFill color="white" size={22} />
            </div>
            LMS Platform
          </Link>

          {/* Desktop Links */}
          <nav className="hidden md:flex items-center gap-2 me-auto ps-3">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-4 py-2 text-sm font-semibold rounded-lg transition-colors hover:text-darkmint"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="ms-auto hidden md:block">
            <Button className="text-darktext" variant={"ghost"}>
              log in
            </Button>
            <Button className="bg-darkmint shadow-lg w-30 h-9 ms-3 hover:opacity-90 hover:bg-darkmint">
              Join for Free
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 "
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <FiX size={22} className="cursor-pointer" /> : <FiMenu size={22} className="cursor-pointer" />}
          </button>
        </div>

        {/* Mobile Menu */}
        <div
          className={`md:hidden overflow-hidden transition-all duration-300 ${isMenuOpen ? "max-h-60 py-4" : "max-h-0"
            }`}
        >
          <nav className="flex flex-col gap-4">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsMenuOpen(false)}
                className="text-sm font-semibold hover:text-darkmint"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="ms-auto pt-7">
            <Button className="text-darktext" variant={"ghost"}>
              log in
            </Button>
            <Button className="bg-darkmint shadow w-30 h-9 ms-3 hover:opacity-90 hover:bg-darkmint">
              Join for Free
            </Button>
          </div>

        </div>

      </div>
    </header>
  );
};

export default NavBar;
