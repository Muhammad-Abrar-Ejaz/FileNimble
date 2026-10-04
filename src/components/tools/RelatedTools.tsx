import React from "react";
import { ToolRecord } from "@/types/tool";
import { getRelatedTools } from "@/lib/registry";
import { ToolCard } from "./ToolCard";
import { cn } from "@/lib/utils";

interface RelatedToolsProps {
  tool: ToolRecord;
  className?: string;
  limit?: number;
  title?: string;
}

export function RelatedTools({
  tool,
  className,
  limit = 4,
  title = "Related Tools",
}: RelatedToolsProps) {
  const related = getRelatedTools(tool, limit);

  if (!related || related.length === 0) {
    return null;
  }

  return (
    <section className={cn("w-full my-8", className)} aria-label={title}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg sm:text-xl font-bold text-text-strong">{title}</h2>
        <span className="text-xs text-text-muted">{related.length} suggestions</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {related.map((t) => (
          <ToolCard key={t.id} tool={t} />
        ))}
      </div>
    </section>
  );
}
