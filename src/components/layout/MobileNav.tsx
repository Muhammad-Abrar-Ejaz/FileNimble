"use client";

import React, { useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { siteConfig } from "@/config/site";
import { CATEGORIES } from "@/config/categories";
import { getCategoryIcon } from "../tools/ToolCard";
import { X, ArrowRight, ShieldCheck } from "lucide-react";

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileNav({ isOpen, onClose }: MobileNavProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      const previousFocus = document.activeElement as HTMLElement | null;
      const previousOverflow = document.body.style.overflow;
      const background = Array.from(document.querySelectorAll<HTMLElement>("body > header, body > main, body > footer"));
      const previousInert = background.map(element => element.inert);
      background.forEach(element => { element.inert = true; });
      document.body.style.overflow = "hidden";
      dialogRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") onClose();
        if (e.key === "Tab") {
          const items = dialogRef.current?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled)');
          if (!items?.length) return;
          const first = items[0];
          const last = items[items.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      };
      const desktop = window.matchMedia("(min-width: 768px)");
      const closeOnDesktop = () => { if (desktop.matches) onClose(); };
      desktop.addEventListener("change", closeOnDesktop);
      window.addEventListener("keydown", handleKeyDown);
      return () => {
        document.body.style.overflow = previousOverflow;
        background.forEach((element, index) => { element.inert = previousInert[index]; });
        previousFocus?.focus();
        desktop.removeEventListener("change", closeOnDesktop);
        window.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 md:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Mobile Navigation Menu"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <div className="fixed inset-y-0 right-0 w-full max-w-xs bg-surface shadow-2xl p-6 flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-border-subtle">
            <Link href="/" onClick={onClose} className="flex items-center gap-2.5">
              <Image
                src="/brand/filenimble-logo.png"
                alt="FileNimble Logo"
                width={32}
                height={32}
                className="h-8 w-8 object-contain"
              />
              <span className="font-bold text-lg text-text-strong tracking-tight">
                {siteConfig.name}
              </span>
            </Link>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-text-muted hover:text-text-strong hover:bg-gray-100 transition-colors"
              aria-label="Close navigation menu"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>

          {/* Main Navigation Links */}
          <nav className="mt-6 space-y-1" aria-label="Mobile Primary Navigation">
            {siteConfig.mainNav.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={onClose}
                className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold text-text-strong hover:bg-primary/5 hover:text-primary transition-colors"
              >
                <span>{item.title}</span>
                <ArrowRight size={14} className="text-text-muted" aria-hidden="true" />
              </a>
            ))}
          </nav>

          {/* Tool Categories Section */}
          <div className="mt-6 pt-4 border-t border-border-subtle">
            <p className="px-3.5 text-xs font-bold uppercase tracking-wider text-text-muted mb-2">
              Browse Categories
            </p>
            <div className="grid grid-cols-1 gap-1">
              {Object.values(CATEGORIES).slice(0, 7).map((cat) => (
                <a
                  key={cat.id}
                  href={`/#${cat.id}`}
                  onClick={onClose}
                  className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-medium text-text-muted hover:text-text-strong hover:bg-gray-50 transition-colors"
                >
                  <div
                    className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                    style={{ backgroundColor: cat.bgLight }}
                  >
                    {getCategoryIcon(cat.id, 14)}
                  </div>
                  <span>{cat.name}</span>
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Footer info in drawer */}
        <div className="mt-8 pt-4 border-t border-border-subtle text-xs text-text-muted space-y-3">
          <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200">
            <ShieldCheck size={16} className="shrink-0 text-emerald-600" aria-hidden="true" />
            <span>100% Client-Side Privacy Guaranteed</span>
          </div>
          <p className="text-[11px] text-center text-text-muted">
            © {new Date().getFullYear()} FileNimble. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
