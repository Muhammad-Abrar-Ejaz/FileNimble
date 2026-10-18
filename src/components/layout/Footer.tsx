import React from "react";
import Link from "next/link";
import Image from "next/image";
import { siteConfig } from "@/config/site";
import { CATEGORIES } from "@/config/categories";
import { ShieldCheck, Heart, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface FooterProps {
  className?: string;
}

export function Footer({ className }: FooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className={cn("bg-surface border-t border-border-subtle mt-20", className)}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-12">
          {/* Brand Column */}
          <div className="lg:col-span-2 space-y-4">
            <Link href="/" className="flex items-center gap-2.5">
              <Image
                src="/brand/filenimble-logo.png"
                alt="FileNimble Logo"
                width={36}
                height={36}
                className="h-9 w-9 object-contain"
              />
              <span className="font-bold text-xl text-text-strong tracking-tight">
                {siteConfig.name}
              </span>
            </Link>

            <p className="text-sm text-text-muted max-w-sm leading-relaxed">
              <strong>{siteConfig.tagline}</strong> Convert images, PDFs and data with browser tools, or use temporary server processing for the converters available in this release.
            </p>

            <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200 w-fit">
              <ShieldCheck size={16} className="text-emerald-600 shrink-0" aria-hidden="true" />
              <span>Browser processing • Temporary server storage</span>
            </div>
          </div>

          {/* Column 1: Popular Categories */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-text-strong mb-4">
              File Categories
            </h2>
            <ul className="space-y-2.5 text-xs text-text-muted">
              {Object.values(CATEGORIES).slice(0, 6).map((cat) => (
                <li key={cat.id}>
                  <a
                    href={`/#${cat.id}`}
                    className="hover:text-primary transition-colors inline-block"
                  >
                    {cat.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 2: More Categories */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-text-strong mb-4">
              Advanced Tools
            </h2>
            <ul className="space-y-2.5 text-xs text-text-muted">
              {Object.values(CATEGORIES).slice(6).map((cat) => (
                <li key={cat.id}>
                  <a
                    href={`/#${cat.id}`}
                    className="hover:text-primary transition-colors inline-block"
                  >
                    {cat.name}
                  </a>
                </li>
              ))}
              <li>
                <Link
                  href="/tools"
                  className="text-primary font-medium hover:underline inline-flex items-center gap-1"
                >
                  <Sparkles size={11} /> Browse available tools
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Platform & Legal */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-text-strong mb-4">
              Platform
            </h2>
            <ul className="space-y-2.5 text-xs text-text-muted">
              {siteConfig.footerNav.map((item) => (
                <li key={item.title}>
                  {item.href ? <Link
                    href={item.href}
                    className="hover:text-primary transition-colors inline-block"
                  >
                    {item.title}
                  </Link> : <span>{item.title} <span className="text-[10px]">(coming soon)</span></span>}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-border-subtle flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-text-muted">
          <p>© {currentYear} FileNimble. All rights reserved.</p>
          <div className="flex items-center gap-1">
            <span>Engineered for speed, privacy, and simplicity</span>
            <Heart size={12} className="text-red-500 inline fill-red-500 ml-0.5" aria-hidden="true" />
          </div>
        </div>
      </div>
    </footer>
  );
}
