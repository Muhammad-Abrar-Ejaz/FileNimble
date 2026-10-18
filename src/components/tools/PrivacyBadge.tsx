import React from "react";
import { ProcessingMode } from "@/types/tool";
import { ShieldCheck, Server, Sparkles, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface PrivacyBadgeProps {
  mode: ProcessingMode;
  className?: string;
  size?: "sm" | "md";
}

export function PrivacyBadge({ mode, className, size = "sm" }: PrivacyBadgeProps) {
  const sizeClasses = size === "sm" ? "text-xs px-2 py-0.5 gap-1" : "text-sm px-2.5 py-1 gap-1.5";
  const iconSize = size === "sm" ? 12 : 14;

  switch (mode) {
    case "client":
      return (
        <span
          className={cn(
            "inline-flex items-center font-medium rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80",
            sizeClasses,
            className
          )}
          title="This conversion processes file content in your browser and does not upload it to FileNimble."
        >
          <ShieldCheck size={iconSize} className="text-emerald-600 shrink-0" aria-hidden="true" />
          <span>Runs in browser</span>
        </span>
      );

    case "server":
      return (
        <span
          className={cn(
            "inline-flex items-center font-medium rounded-full bg-blue-50 text-blue-700 border border-blue-200/80",
            sizeClasses,
            className
          )}
          title="Files use isolated workers and temporary storage. Expiry and cleanup apply; outages can delay physical deletion."
        >
          <Server size={iconSize} className="text-blue-600 shrink-0" aria-hidden="true" />
          <span>Temporary server processing</span>
        </span>
      );

    case "hybrid":
      return (
        <span
          className={cn(
            "inline-flex items-center font-medium rounded-full bg-purple-50 text-purple-700 border border-purple-200/80",
            sizeClasses,
            className
          )}
          title="Optimized automatically between browser and secure server based on file characteristics."
        >
          <Sparkles size={iconSize} className="text-purple-600 shrink-0" aria-hidden="true" />
          <span>Smart hybrid</span>
        </span>
      );

    case "tbd":
    default:
      return (
        <span
          className={cn(
            "inline-flex items-center font-medium rounded-full bg-gray-50 text-gray-600 border border-gray-200",
            sizeClasses,
            className
          )}
          title="Planned specification"
        >
          <Clock size={iconSize} className="text-gray-400 shrink-0" aria-hidden="true" />
          <span>Planned</span>
        </span>
      );
  }
}
