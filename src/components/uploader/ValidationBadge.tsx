import React from "react";
import { CheckCircle2, AlertCircle, AlertTriangle, ShieldAlert, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type FileValidationStatus =
  | "valid"
  | "checking"
  | "too_large"
  | "unsupported_format"
  | "mime_mismatch"
  | "unsafe_filename"
  | "corrupt";

interface ValidationBadgeProps {
  status: FileValidationStatus;
  message?: string;
  className?: string;
}

export function ValidationBadge({ status, message, className }: ValidationBadgeProps) {
  switch (status) {
    case "valid":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200",
            className
          )}
          title={message || "File verified"}
        >
          <CheckCircle2 size={12} className="text-emerald-600 shrink-0" aria-hidden="true" />
          <span>{message || "Ready"}</span>
        </span>
      );

    case "checking":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200",
            className
          )}
        >
          <Loader2 size={12} className="animate-spin text-blue-600 shrink-0" aria-hidden="true" />
          <span>{message || "Validating..."}</span>
        </span>
      );

    case "too_large":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200",
            className
          )}
          title={message || "File exceeds maximum size limit"}
        >
          <AlertCircle size={12} className="text-red-600 shrink-0" aria-hidden="true" />
          <span>{message || "Too large"}</span>
        </span>
      );

    case "unsupported_format":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200",
            className
          )}
          title={message || "File extension not supported for this tool"}
        >
          <AlertTriangle size={12} className="text-amber-600 shrink-0" aria-hidden="true" />
          <span>{message || "Format unsupported"}</span>
        </span>
      );

    case "mime_mismatch":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200",
            className
          )}
          title={message || "MIME type does not match extension"}
        >
          <AlertTriangle size={12} className="text-amber-600 shrink-0" aria-hidden="true" />
          <span>{message || "Type mismatch"}</span>
        </span>
      );

    case "unsafe_filename":
    case "corrupt":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200",
            className
          )}
          title={message || "Unsafe or corrupted file rejected"}
        >
          <ShieldAlert size={12} className="text-red-600 shrink-0" aria-hidden="true" />
          <span>{message || "Rejected"}</span>
        </span>
      );
  }
}
