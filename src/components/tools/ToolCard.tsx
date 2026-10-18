import React from "react";
import Link from "next/link";
import { ToolRecord } from "@/types/tool";
import { CATEGORIES } from "@/config/categories";
import { PrivacyBadge } from "./PrivacyBadge";
import {
  FileText,
  FileImage,
  FileCode,
  FileArchive,
  FileAudio,
  FileVideo,
  BookOpen,
  ScanText,
  Bot,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ToolCardProps {
  tool: ToolRecord;
  className?: string;
  showCategory?: boolean;
}

export function getCategoryIcon(category: string, size = 20) {
  switch (category) {
    case "pdf":
    case "to_pdf":
    case "from_pdf":
      return <FileText size={size} className="text-red-600" aria-hidden="true" />;
    case "image":
      return <FileImage size={size} className="text-amber-600" aria-hidden="true" />;
    case "document_data":
      return <FileCode size={size} className="text-blue-600" aria-hidden="true" />;
    case "ebook":
      return <BookOpen size={size} className="text-indigo-600" aria-hidden="true" />;
    case "audio":
      return <FileAudio size={size} className="text-violet-600" aria-hidden="true" />;
    case "video":
      return <FileVideo size={size} className="text-purple-600" aria-hidden="true" />;
    case "archive":
      return <FileArchive size={size} className="text-gray-600" aria-hidden="true" />;
    case "ocr":
      return <ScanText size={size} className="text-emerald-600" aria-hidden="true" />;
    case "ai":
      return <Bot size={size} className="text-indigo-600" aria-hidden="true" />;
    default:
      return <Sparkles size={size} className="text-primary" aria-hidden="true" />;
  }
}

export function ToolCard({ tool, className, showCategory = true }: ToolCardProps) {
  const categoryMeta = CATEGORIES[tool.category];
  const isLive = tool.status === "live" || tool.status === "beta";

  const cardContent = (
    <div className="flex flex-col h-full justify-between p-5">
      <div>
        <div className="flex items-start justify-between gap-2 mb-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: categoryMeta?.bgLight || "#F3F4F6" }}
          >
            {getCategoryIcon(tool.category)}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {isLive ? (
              <PrivacyBadge mode={tool.processingMode} />
            ) : (
              <span className="inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                Coming Soon
              </span>
            )}
          </div>
        </div>

        <h3 className="text-base font-semibold text-text-strong group-hover:text-primary transition-colors line-clamp-1">
          {tool.title || tool.slug}
        </h3>

        <p className="mt-1.5 text-xs sm:text-sm text-text-muted leading-relaxed line-clamp-2">
          {tool.description || `Convert and manipulate ${tool.slug} files with ease.`}
        </p>
      </div>

      <div className="mt-4 pt-3 border-t border-border-subtle/80 flex items-center justify-between text-xs">
        {showCategory && categoryMeta ? (
          <span className={cn("px-2 py-0.5 rounded-md font-medium border text-[11px]", categoryMeta.badgeClass)}>
            {categoryMeta.name}
          </span>
        ) : (
          <span className="text-text-muted font-mono text-[11px]">{tool.slug}</span>
        )}

        <span className="inline-flex items-center gap-1 font-medium text-primary group-hover:translate-x-0.5 transition-transform">
          {isLive ? "Open tool" : "Browse categories"}
          <ArrowRight size={13} aria-hidden="true" />
        </span>
      </div>
    </div>
  );

  const containerClasses = cn(
    "group relative rounded-2xl bg-surface border border-border-subtle shadow-xs",
    "hover:border-primary/40 hover:shadow-md transition-all duration-200",
    "focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2",
    className
  );

  return (
    <article className={containerClasses}>
      <Link
        href={isLive ? `/${tool.slug}` : `/#categories`}
        className="block h-full outline-none focus:outline-none"
        aria-label={`${tool.title || tool.slug} — ${categoryMeta?.name || tool.category} (${isLive ? "Ready" : "Coming Soon"})`}
      >
        {cardContent}
      </Link>
    </article>
  );
}
