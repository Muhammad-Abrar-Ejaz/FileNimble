/**
 * Job state model for server-backed conversions.
 */
export type JobState =
  | "CREATED"
  | "UPLOADING"
  | "VALIDATING"
  | "QUEUED"
  | "PROCESSING"
  | "COMPLETED"
  | "EXPIRED"
  | "FAILED"
  | "CANCELLED";

export interface JobRecord {
  jobId: string;
  toolId: string;
  state: JobState;
  progress: number | null;
  message: string | null;
  errorCode: string | null;
  expiresAt: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}
