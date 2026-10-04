"use client";

import { useEffect, useState } from "react";
import { getAdConfig, isValidCmpScriptUrl } from "@/config/ads";

export type ConsentStatus = "unknown" | "granted" | "denied";

interface TcfData {
  eventStatus?: string;
  gdprApplies?: boolean;
  purpose?: {
    consents?: Record<number, boolean>;
  };
}

declare global {
  interface Window {
    __tcfapi?: (
      command: string,
      version: number,
      callback: (tcData: unknown, success: boolean) => void,
      parameter?: unknown
    ) => void;
  }
}

/**
 * Hook to inspect advertising consent state.
 *
 * FileNimble's conversion engine operates entirely independently of this state:
 * source files, conversion pipelines, and downloads never require ad consent.
 */
export function useAdConsent(): {
  hasConsent: boolean;
  status: ConsentStatus;
} {
  const [status, setStatus] = useState<ConsentStatus>(() => {
    return "unknown";
  });

  useEffect(() => {
    const config = getAdConfig();
    if (!config.cmp.enabled || !isValidCmpScriptUrl(config.cmp.scriptUrl)) {
      return;
    }

    if (typeof window !== "undefined" && typeof window.__tcfapi === "function") {
      window.__tcfapi("addEventListener", 2, (tcData: unknown, success: boolean) => {
        if (success && tcData) {
          const data = tcData as TcfData;
          if (data.eventStatus === "tcloaded" || data.eventStatus === "useractioncomplete") {
            const gdprApplies = data.gdprApplies;
            if (gdprApplies === false) {
              setStatus("granted");
            } else if (gdprApplies === true) {
              // Check Purpose 1 (Store and/or access information on a device)
              const purpose1 = data.purpose?.consents?.[1];
              setStatus(purpose1 ? "granted" : "denied");
            }
          }
        }
      });
    }
  }, []);

  return {
    hasConsent: status === "granted",
    status,
  };
}

/**
 * Visual/operational CMP placeholder component.
 * When an external CMP is configured, this provides container anchoring if needed.
 */
export function ConsentManager() {
  // Production CMP scripts (like Google Funding Choices or Didomi) inject their own modals.
  // This component serves as the lifecycle anchor.
  return null;
}
