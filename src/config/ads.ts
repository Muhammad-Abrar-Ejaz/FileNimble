import { ToolRecord } from "@/types/tool";

export type AdFormat = "horizontal" | "rectangle" | "fluid";

export interface AdConfig {
  /** AdSense Client / Publisher ID, e.g. ca-pub-XXXXXXXXXXXXXXXX */
  clientId?: string;
  /** Whether ads are enabled globally. Defaults to false. */
  enabled: boolean;
  /**
   * Safe test/preview mode for local development and testing.
   * When true, displays an accessible placeholder box without requesting external scripts.
   */
  testMode: boolean;
  /** Optional slot IDs mapped by placement key */
  slots: {
    toolAfterConverter?: string;
    toolInContent?: string;
    homeAfterHero?: string;
    homeBetweenSections?: string;
    directoryBottom?: string;
    formatsBottom?: string;
    [key: string]: string | undefined;
  };
  /** Consent Management Platform configuration */
  cmp: {
    enabled: boolean;
    scriptUrl?: string;
  };
  /** Custom ads.txt content override if specified */
  adsTxtOverride?: string;
}

/**
 * Extracts normalized publisher ID from client ID string.
 * Example: "ca-pub-1234567890123456" -> "pub-1234567890123456"
 */
export function formatPublisherId(clientId?: string): string | undefined {
  if (!clientId) return undefined;
  const trimmed = clientId.trim();
  const match = trimmed.match(/(?:ca-)?(pub-\d{16})/i);
  return match ? match[1].toLowerCase() : undefined;
}

/**
 * Validates Google AdSense client ID format (ca-pub-XXXXXXXXXXXXXXXX).
 */
export function isValidClientId(clientId?: string): boolean {
  if (!clientId) return false;
  return /^ca-pub-\d{16}$/i.test(clientId.trim());
}

/**
 * Returns current AdSense configuration derived safely from environment variables.
 * Default is disabled unless explicitly enabled and configured.
 */
export function getAdConfig(): AdConfig {
  const clientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID?.trim() || undefined;
  const enabled = process.env.NEXT_PUBLIC_ADSENSE_ENABLED === "true";
  const testMode = process.env.NEXT_PUBLIC_ADSENSE_TEST_MODE === "true";

  const cmpEnabled = process.env.NEXT_PUBLIC_CMP_ENABLED === "true";
  const cmpScriptUrl = process.env.NEXT_PUBLIC_CMP_SCRIPT_URL?.trim() || undefined;
  const adsTxtOverride = process.env.NEXT_PUBLIC_ADS_TXT_CONTENT?.trim() || undefined;

  return {
    clientId,
    enabled,
    testMode,
    slots: {
      toolAfterConverter: process.env.NEXT_PUBLIC_ADSENSE_SLOT_TOOL_AFTER_CONVERTER?.trim() || undefined,
      toolInContent: process.env.NEXT_PUBLIC_ADSENSE_SLOT_TOOL_IN_CONTENT?.trim() || undefined,
      homeAfterHero: process.env.NEXT_PUBLIC_ADSENSE_SLOT_HOME_AFTER_HERO?.trim() || undefined,
      homeBetweenSections: process.env.NEXT_PUBLIC_ADSENSE_SLOT_HOME_BETWEEN_SECTIONS?.trim() || undefined,
      directoryBottom: process.env.NEXT_PUBLIC_ADSENSE_SLOT_DIRECTORY_BOTTOM?.trim() || undefined,
      formatsBottom: process.env.NEXT_PUBLIC_ADSENSE_SLOT_FORMATS_BOTTOM?.trim() || undefined,
    },
    cmp: {
      enabled: cmpEnabled,
      scriptUrl: cmpScriptUrl,
    },
    adsTxtOverride,
  };
}

/**
 * Checks whether live AdSense script loading is active.
 * Requires explicit enablement, a valid publisher ID, production mode, and a
 * configured HTTPS CMP. The script loader still waits for a TCF grant.
 */
export function isAdSenseActive(config: AdConfig = getAdConfig()): boolean {
  return (
    config.enabled &&
    isValidClientId(config.clientId) &&
    !config.testMode &&
    config.cmp.enabled &&
    isValidCmpScriptUrl(config.cmp.scriptUrl)
  );
}

/**
 * Accept only an absolute HTTPS URL for a production CMP script.
 * A CMP is required before the AdSense script can be activated.
 */
export function isValidCmpScriptUrl(scriptUrl?: string): boolean {
  if (!scriptUrl) return false;
  try {
    return new URL(scriptUrl).protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Policy QA check: Determines if a given tool page is eligible for monetization.
 * Rules:
 * - Tool must be defined
 * - Status must be "live" (never "planned", "beta", or "disabled")
 * - indexable must be true
 */
export function isToolMonetizable(tool?: ToolRecord | null): boolean {
  if (!tool) return false;
  return tool.status === "live" && tool.indexable === true;
}

/**
 * Generates the contents of ads.txt.
 * If publisher ID is configured, outputs the standard Google AdSense record.
 * If not configured, outputs a pending notice without inventing dummy IDs.
 */
export function generateAdsTxtContent(config: AdConfig = getAdConfig()): string {
  if (config.adsTxtOverride) {
    return config.adsTxtOverride.trim() + "\n";
  }

  const pubId = formatPublisherId(config.clientId);
  if (pubId) {
    return `google.com, ${pubId}, DIRECT, f08c47fec0942fa0\n`;
  }

  return [
    "# FileNimble ads.txt",
    "# Advertising publisher configuration is pending deployment.",
    "",
  ].join("\n");
}
