/** Stable API error codes. Never expose raw shell stderr to clients. */
export type ApiErrorCode =
  | "UNSUPPORTED_FORMAT"
  | "FILE_TOO_LARGE"
  | "TOO_MANY_FILES"
  | "CORRUPT_FILE"
  | "PASSWORD_REQUIRED"
  | "INVALID_PASSWORD"
  | "UNSUPPORTED_DOCUMENT_FEATURE"
  | "CONVERSION_TIMEOUT"
  | "RESOURCE_LIMIT"
  | "RATE_LIMITED"
  | "SERVICE_UNAVAILABLE"
  | "JOB_EXPIRED"
  | "NOT_AUTHORIZED";

export interface ApiErrorResponse {
  error: ApiErrorCode;
  message: string;
}

export interface CreateJobRequest {
  tool: string;
  files: Array<{
    name: string;
    size: number;
    type: string;
  }>;
  options?: Record<string, unknown>;
}

export interface CreateJobResponse {
  jobId: string;
  state: string;
  expiresAt: string;
  uploads: Array<{
    fileId: string;
    method: string;
    url: string;
    headers: Record<string, string>;
  }>;
}
