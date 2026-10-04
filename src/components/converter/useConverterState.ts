"use client";

import { useReducer, useCallback } from "react";
import { ValidatedFile } from "../uploader/FileRow";
import { ApiErrorCode } from "@/types/api";

export type ConverterStatus =
  | "idle"
  | "validating"
  | "ready"
  | "processing"
  | "complete"
  | "failed"
  | "cancelled"
  | "expired";

export interface ConvertedResultFile {
  name: string;
  size: number;
  blobUrl?: string;
  downloadUrl?: string;
  mimeType?: string;
}

export interface ConverterState {
  status: ConverterStatus;
  files: ValidatedFile[];
  resultFiles: ConvertedResultFile[];
  errorCode: ApiErrorCode | null;
  errorMessage: string | null;
  processingMessage: string | null;
}

type ConverterAction =
  | { type: "SET_FILES"; payload: ValidatedFile[] }
  | { type: "START_VALIDATING" }
  | { type: "SET_READY" }
  | { type: "START_PROCESSING"; message?: string }
  | { type: "SET_COMPLETE"; payload: ConvertedResultFile[] }
  | { type: "SET_FAILED"; errorCode: ApiErrorCode; message: string }
  | { type: "CANCEL" }
  | { type: "SET_EXPIRED" }
  | { type: "RESET" };

const initialState: ConverterState = {
  status: "idle",
  files: [],
  resultFiles: [],
  errorCode: null,
  errorMessage: null,
  processingMessage: null,
};

function converterReducer(state: ConverterState, action: ConverterAction): ConverterState {
  switch (action.type) {
    case "SET_FILES": {
      const validFiles = action.payload.filter((f) => f.status === "valid");
      return {
        ...state,
        files: action.payload,
        status: action.payload.length === 0 ? "idle" : validFiles.length > 0 ? "ready" : "idle",
        errorCode: null,
        errorMessage: null,
        resultFiles: [],
      };
    }

    case "START_VALIDATING":
      return {
        ...state,
        status: "validating",
        errorCode: null,
        errorMessage: null,
      };

    case "SET_READY":
      return {
        ...state,
        status: "ready",
        errorCode: null,
        errorMessage: null,
      };

    case "START_PROCESSING":
      return {
        ...state,
        status: "processing",
        processingMessage: action.message || "Processing files...",
        errorCode: null,
        errorMessage: null,
      };

    case "SET_COMPLETE":
      return {
        ...state,
        status: "complete",
        resultFiles: action.payload,
        processingMessage: null,
        errorCode: null,
        errorMessage: null,
      };

    case "SET_FAILED":
      return {
        ...state,
        status: "failed",
        errorCode: action.errorCode,
        errorMessage: action.message,
        processingMessage: null,
      };

    case "CANCEL":
      return {
        ...state,
        status: "cancelled",
        processingMessage: null,
      };

    case "SET_EXPIRED":
      return {
        ...state,
        status: "expired",
        resultFiles: [],
        processingMessage: null,
      };

    case "RESET":
      return initialState;

    default:
      return state;
  }
}

export function useConverterState(initial?: Partial<ConverterState>) {
  const [state, dispatch] = useReducer(converterReducer, {
    ...initialState,
    ...initial,
  });

  const setFiles = useCallback((files: ValidatedFile[]) => {
    dispatch({ type: "SET_FILES", payload: files });
  }, []);

  const startValidating = useCallback(() => {
    dispatch({ type: "START_VALIDATING" });
  }, []);

  const setReady = useCallback(() => {
    dispatch({ type: "SET_READY" });
  }, []);

  const startProcessing = useCallback((message?: string) => {
    dispatch({ type: "START_PROCESSING", message });
  }, []);

  const setComplete = useCallback((results: ConvertedResultFile[]) => {
    dispatch({ type: "SET_COMPLETE", payload: results });
  }, []);

  const setFailed = useCallback((errorCode: ApiErrorCode, message: string) => {
    dispatch({ type: "SET_FAILED", errorCode, message });
  }, []);

  const cancel = useCallback(() => {
    dispatch({ type: "CANCEL" });
  }, []);

  const setExpired = useCallback(() => {
    dispatch({ type: "SET_EXPIRED" });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: "RESET" });
  }, []);

  return {
    state,
    setFiles,
    startValidating,
    setReady,
    startProcessing,
    setComplete,
    setFailed,
    cancel,
    setExpired,
    reset,
  };
}
