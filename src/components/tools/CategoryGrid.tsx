import React from "react";
import { CATEGORIES } from "@/config/categories";
import { ToolCategory, ToolRecord } from "@/types/tool";
import { CategoryFlipCard } from "./CategoryFlipCard";
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
      {categoryList.map((cat) => (
        <CategoryFlipCard
          key={cat.id}
          category={cat}
          tools={tools}
          onSelectCategory={onSelectCategory}
        />
      ))}
    </div>
  );
}

