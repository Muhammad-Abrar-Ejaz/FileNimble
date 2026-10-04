import React from "react";
import { CATEGORIES } from "@/config/categories";
import { ToolCategory, ToolRecord } from "@/types/tool";
import { getCategoryIcon } from "./ToolCard";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface CategoryGridProps {
  tools: ToolRecord[];
  className?: string;
  onSelectCategory?: (category: ToolCategory) => void;
}

export function CategoryGrid({ tools, className, onSelectCategory }: CategoryGridProps) {
  const categoryList = Object.values(CATEGORIES);

  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4", className)}>
      {categoryList.map((cat) => {
        const count = tools.filter((t) => t.category === cat.id).length;

        const content = (
          <div className="flex flex-col justify-between h-full p-5">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{ backgroundColor: cat.bgLight }}
                >
                  {getCategoryIcon(cat.id, 24)}
                </div>
                <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full border", cat.badgeClass)}>
                  {count} {count === 1 ? "tool" : "tools"}
                </span>
              </div>

              <h3 className="text-base font-bold text-text-strong group-hover:text-primary transition-colors">
                {cat.name}
              </h3>
              <p className="mt-1.5 text-xs text-text-muted leading-relaxed line-clamp-2">
                {cat.description}
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-border-subtle/80 flex items-center justify-between text-xs font-medium text-primary">
              <span>Explore category</span>
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" aria-hidden="true" />
            </div>
          </div>
        );

        const cardClasses = cn(
          "group relative rounded-2xl bg-surface border border-border-subtle shadow-xs",
          "hover:border-primary/40 hover:shadow-md transition-all duration-200 text-left",
          "focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 cursor-pointer"
        );

        if (onSelectCategory) {
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelectCategory(cat.id)}
              className={cardClasses}
              aria-label={`Explore ${cat.name} (${count} tools)`}
            >
              {content}
            </button>
          );
        }

        return (
          <article key={cat.id} className={cardClasses}>
            <a
              href={`/#${cat.id}`}
              className="block h-full outline-none focus:outline-none"
              aria-label={`Explore ${cat.name} (${count} tools)`}
            >
              {content}
            </a>
          </article>
        );
      })}
    </div>
  );
}
