"use client";

import React, { useState, useMemo, useEffect } from "react";
import { ToolCategory, ToolRecord } from "@/types/tool";
import { CATEGORIES } from "@/config/categories";
import { ToolCard } from "./ToolCard";
import { Search, X, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

interface ToolSearchProps {
  initialTools: ToolRecord[];
  className?: string;
  defaultCategory?: ToolCategory | "all";
  maxResults?: number;
}

export function ToolSearch({
  initialTools,
  className,
  defaultCategory = "all",
  maxResults = 12,
}: ToolSearchProps) {
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<ToolCategory | "all">(defaultCategory);

  useEffect(() => {
    const selectLinkedCategory = () => {
      const category = window.location.hash.slice(1);
      if (Object.hasOwn(CATEGORIES, category)) {
        setSelectedCategory(category as ToolCategory);
        setQuery("");
      } else if (category === "search") {
        setSelectedCategory("all");
        setQuery("");
      }
    };
    selectLinkedCategory();
    window.addEventListener("hashchange", selectLinkedCategory);
    return () => window.removeEventListener("hashchange", selectLinkedCategory);
  }, []);

  const filteredTools = useMemo(() => {
    const q = query.trim().toLowerCase();

    return initialTools.filter((tool) => {
      const matchesCategory =
        selectedCategory === "all" || tool.category === selectedCategory;

      if (!matchesCategory) return false;
      if (!q) return true;

      const slugMatch = tool.slug.toLowerCase().includes(q);
      const titleMatch = tool.title?.toLowerCase().includes(q);
      const descMatch = tool.description?.toLowerCase().includes(q);
      const idMatch = tool.id.toLowerCase().includes(q);
      const catMatch = tool.category.toLowerCase().includes(q);

      return slugMatch || titleMatch || descMatch || idMatch || catMatch;
    });
  }, [initialTools, query, selectedCategory]);

  const displayedTools = filteredTools.slice(0, maxResults);

  const categoryEntries = useMemo(() => {
    return Object.values(CATEGORIES);
  }, []);

  return (
    <section className={cn("w-full", className)} aria-label="Tool search and discovery">
      {/* Search Input Bar */}
      <div className="relative max-w-2xl mx-auto">
        <div className="relative flex items-center">
          <Search
            size={20}
            className="absolute left-4 text-text-muted pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search all 130+ tools (e.g. PDF to Word, compress image, merge PDF)..."
            className="w-full pl-12 pr-11 py-3.5 rounded-2xl bg-surface border border-border-subtle shadow-xs text-text-strong placeholder:text-text-muted text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            aria-label="Search conversion tools"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-3.5 p-1 rounded-full text-text-muted hover:text-text-strong hover:bg-gray-100 transition-colors"
              aria-label="Clear search input"
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Category Filter Chips */}
      <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <div className="flex items-center gap-1.5 px-2 mx-auto">
          <span className="text-xs text-text-muted font-medium flex items-center gap-1 shrink-0 mr-1">
            <Filter size={13} aria-hidden="true" /> Filter:
          </span>
          <button
            type="button"
            aria-pressed={selectedCategory === "all"}
            onClick={() => setSelectedCategory("all")}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium transition-all shrink-0 cursor-pointer",
              selectedCategory === "all"
                ? "bg-primary text-white shadow-xs"
                : "bg-surface text-text-muted hover:text-text-strong border border-border-subtle hover:bg-gray-50"
            )}
          >
            All Categories ({initialTools.length})
          </button>

          {categoryEntries.map((cat) => {
            const count = initialTools.filter((t) => t.category === cat.id).length;

            return (
              <button
                key={cat.id}
                id={cat.id}
                type="button"
                aria-pressed={selectedCategory === cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium transition-all shrink-0 cursor-pointer",
                  selectedCategory === cat.id
                    ? "bg-primary text-white shadow-xs"
                    : "bg-surface text-text-muted hover:text-text-strong border border-border-subtle hover:bg-gray-50"
                )}
              >
                {cat.name} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Results Header */}
      <div className="mt-6 flex items-center justify-between text-xs text-text-muted px-1">
        <span>
          Showing <strong>{displayedTools.length}</strong> of <strong>{filteredTools.length}</strong> tools
          {query && ` matching "${query}"`}
        </span>
        {(query || selectedCategory !== "all") && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setSelectedCategory("all");
            }}
            className="text-primary hover:underline font-medium cursor-pointer"
          >
            Reset filters
          </button>
        )}
      </div>

      {/* Results Grid */}
      {displayedTools.length > 0 ? (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {displayedTools.map((tool) => (
            <ToolCard key={tool.id} tool={tool} />
          ))}
        </div>
      ) : (
        <div className="mt-8 p-12 text-center rounded-2xl bg-surface border border-dashed border-border-subtle">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto text-text-muted">
            <Search size={22} aria-hidden="true" />
          </div>
          <h3 className="mt-3 text-base font-semibold text-text-strong">No tools found</h3>
          <p className="mt-1 text-xs text-text-muted max-w-sm mx-auto">
            We couldn&apos;t find any tools matching &ldquo;{query}&rdquo; in this category. Try searching for a file format like &ldquo;PDF&rdquo;, &ldquo;JPG&rdquo;, or &ldquo;DOCX&rdquo;.
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setSelectedCategory("all");
            }}
            className="mt-4 inline-flex items-center px-4 py-2 rounded-xl text-xs font-medium bg-primary text-white hover:bg-primary-hover transition-colors"
          >
            Show all tools
          </button>
        </div>
      )}
    </section>
  );
}
