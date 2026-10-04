"use client";

import { useCallback, useState } from "react";
import Script from "next/script";
import { getAdConfig, isAdSenseActive } from "@/config/ads";

interface TcfData {
  eventStatus?: string;
  gdprApplies?: boolean;
  purpose?: { consents?: Record<number, boolean> };
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
 * Loads AdSense only after a configured TCF CMP reports a usable consent state.
 * Missing, denied, unsupported, or failed CMP states all fail closed. Conversion
 * functionality does not depend on this component or the resulting consent.
 */
export function AdSenseScript() {
  const config = getAdConfig();
  const [consentGranted, setConsentGranted] = useState(false);
  const isActive = isAdSenseActive(config);

  const handleCmpReady = useCallback(() => {
    if (typeof window.__tcfapi !== "function") return;

    window.__tcfapi("addEventListener", 2, (tcData: unknown, success: boolean) => {
      if (!success || !tcData) return;

      const data = tcData as TcfData;
      if (data.eventStatus !== "tcloaded" && data.eventStatus !== "useractioncomplete") return;

      // When GDPR does not apply, TCF says no GDPR consent decision is required.
      // When it does apply (or is unspecified), require an explicit Purpose 1 grant.
      const granted =
        data.gdprApplies === false ||
        (data.gdprApplies === true && data.purpose?.consents?.[1] === true);
      setConsentGranted(granted);
    });
  }, [setConsentGranted]);

  if (!isActive) return null;

  return (
    <>
      <Script
        id="filenimble-cmp-script"
        src={config.cmp.scriptUrl}
        strategy="afterInteractive"
        onReady={handleCmpReady}
        onError={() => setConsentGranted(false)}
      />
      {consentGranted && (
        <Script
          id="filenimble-adsense-script"
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${config.clientId}`}
          strategy="afterInteractive"
          crossOrigin="anonymous"
        />
      )}
    </>
  );
}
