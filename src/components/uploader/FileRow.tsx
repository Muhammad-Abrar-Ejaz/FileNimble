import React from "react";
import { formatBytes } from "@/lib/utils";
import { ValidationBadge, FileValidationStatus } from "./ValidationBadge";
import {
  FileText,
  FileImage,
  FileCode,
  FileArchive,
  FileAudio,
  FileVideo,
  File,
  X,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface ValidatedFile {
  id: string;
  file: File;
  status: FileValidationStatus;
  statusMessage?: string;
}

interface FileRowProps {
  item: ValidatedFile;
  index: number;
  totalCount: number;
  onRemove: (id: string) => void;
  onMoveUp?: (index: number) => void;
  onMoveDown?: (index: number) => void;
  allowReorder?: boolean;
}

function getFileIcon(filename: string, mimeType: string) {
  const ext = filename.split(".").pop()?.toLowerCase() || "";

  if (["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp"].includes(ext) || mimeType.startsWith("image/")) {
    return <FileImage size={20} className="text-amber-600 shrink-0" aria-hidden="true" />;
  }
  if (["pdf"].includes(ext) || mimeType === "application/pdf") {
    return <FileText size={20} className="text-red-600 shrink-0" aria-hidden="true" />;
  }
  if (["doc", "docx", "txt", "md", "csv", "json", "xml", "yaml", "yml"].includes(ext)) {
    return <FileCode size={20} className="text-blue-600 shrink-0" aria-hidden="true" />;
  }
  if (["zip", "7z", "tar", "gz", "rar"].includes(ext)) {
    return <FileArchive size={20} className="text-gray-600 shrink-0" aria-hidden="true" />;
  }
  if (["mp3", "wav", "m4a", "ogg"].includes(ext) || mimeType.startsWith("audio/")) {
    return <FileAudio size={20} className="text-violet-600 shrink-0" aria-hidden="true" />;
  }
  if (["mp4", "webm", "mov", "mkv"].includes(ext) || mimeType.startsWith("video/")) {
    return <FileVideo size={20} className="text-purple-600 shrink-0" aria-hidden="true" />;
  }
  return <File size={20} className="text-gray-500 shrink-0" aria-hidden="true" />;
}

export function FileRow({
  item,
  index,
  totalCount,
  onRemove,
  onMoveUp,
  onMoveDown,
  allowReorder = false,
}: FileRowProps) {
  const isFirst = index === 0;
  const isLast = index === totalCount - 1;

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 p-3.5 rounded-xl bg-surface border border-border-subtle",
        "transition-all duration-150 hover:border-border-subtle/80 shadow-2xs",
        item.status !== "valid" && item.status !== "checking" && "bg-red-50/20 border-red-200/60"
      )}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-9 h-9 rounded-lg bg-gray-50 border border-border-subtle flex items-center justify-center shrink-0">
          {getFileIcon(item.file.name, item.file.type)}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-text-strong truncate" title={item.file.name}>
            {item.file.name}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-text-muted">{formatBytes(item.file.size)}</span>
            <ValidationBadge status={item.status} message={item.statusMessage} />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {allowReorder && totalCount > 1 && (
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => onMoveUp?.(index)}
              disabled={isFirst}
              className="p-1 rounded-md text-text-muted hover:text-text-strong hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label={`Move ${item.file.name} up`}
            >
              <ChevronUp size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onMoveDown?.(index)}
              disabled={isLast}
              className="p-1 rounded-md text-text-muted hover:text-text-strong hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label={`Move ${item.file.name} down`}
            >
              <ChevronDown size={16} aria-hidden="true" />
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => onRemove(item.id)}
          className="p-1.5 rounded-lg text-text-muted hover:text-red-600 hover:bg-red-50 transition-colors"
          aria-label={`Remove ${item.file.name}`}
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
