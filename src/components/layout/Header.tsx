"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { siteConfig } from "@/config/site";
import { MobileNav } from "./MobileNav";
import { Menu, Search, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface HeaderProps {
  className?: string;
}

export function Header({ className }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-40 w-full bg-surface/90 backdrop-blur-md border-b border-border-subtle/80 transition-all",
          className
        )}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Brand Logo & Wordmark */}
          <Link
            href="/"
            className="flex items-center gap-2.5 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl p-1"
            aria-label={`${siteConfig.name} Home`}
          >
            <Image
              src="/brand/filenimble-logo.png"
              alt="FileNimble Logo"
              width={36}
              height={36}
              priority
              className="h-8 w-8 sm:h-9 sm:w-9 object-contain"
            />
            <div className="flex flex-col">
              <span className="text-lg font-black tracking-tight text-text-strong">
                {siteConfig.name}
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav
            className="hidden md:flex items-center gap-1 text-sm font-semibold text-text-muted"
            aria-label="Desktop Primary Navigation"
          >
            {siteConfig.mainNav.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="px-3.5 py-2 rounded-xl hover:text-primary hover:bg-gray-50/80 transition-colors focus-visible:ring-2 focus-visible:ring-primary focus:outline-none"
              >
                {item.title}
              </a>
            ))}
          </nav>

          {/* Right Action Bar */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/#search"
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gray-100/80 hover:bg-gray-200/70 text-text-muted hover:text-text-strong text-xs font-semibold border border-border-subtle/60 transition-all"
              aria-label="Search all tools"
            >
              <Search size={14} aria-hidden="true" />
              <span className="hidden sm:inline">Search tools</span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-surface rounded border border-border-subtle text-text-muted">
                /
              </kbd>
            </Link>

            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-200">
              <ShieldCheck size={14} className="text-emerald-600" aria-hidden="true" />
              <span>100% Privacy</span>
            </div>

            {/* Mobile Menu Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 rounded-xl text-text-muted hover:text-text-strong hover:bg-gray-100 md:hidden transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-expanded={mobileMenuOpen}
              aria-label="Open mobile navigation menu"
            >
              <Menu size={22} aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      {/* Slide-over Mobile Navigation */}
      <MobileNav isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
    </>
  );
}
