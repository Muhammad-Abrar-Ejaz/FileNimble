import { readFile } from "node:fs/promises";

const reportPath = process.argv[2];
if (!reportPath) {
  console.error("LIGHTHOUSE_RESULT category=report-path-missing");
  process.exit(1);
}

let report;
try {
  report = JSON.parse(await readFile(reportPath, "utf8"));
} catch {
  console.error("LIGHTHOUSE_RESULT category=report-missing-or-invalid");
  process.exit(1);
}

const accessibility = report.categories?.accessibility;
if (typeof accessibility?.score !== "number") {
  console.error("LIGHTHOUSE_RESULT category=accessibility-score-missing");
  process.exit(1);
}

const failedAudits = (accessibility.auditRefs ?? [])
  .filter(({ weight, id }) => weight > 0 && report.audits?.[id]?.score !== 1)
  .map(({ id }) => id);

console.log(`LIGHTHOUSE_ACCESSIBILITY_SCORE ${Math.round(accessibility.score * 100)}`);
console.log(`LIGHTHOUSE_FAILED_SCORED_AUDITS ${failedAudits.length ? failedAudits.join(",") : "none"}`);

const contrastAudit = report.audits?.["color-contrast"];
const contrastItems = contrastAudit?.details?.items ?? [];
for (const item of contrastItems.slice(0, 20)) {
  const selector = String(item.node?.selector ?? "unknown")
    .replace(/[\r\n\t]/g, " ")
    .slice(0, 180);
  const ratio = Number.isFinite(item.contrastRatio) ? item.contrastRatio : "unknown";
  const required = Number.isFinite(item.expectedContrastRatio) ? item.expectedContrastRatio : "unknown";
  console.log(`LIGHTHOUSE_CONTRAST_FAILURE selector=${JSON.stringify(selector)} ratio=${ratio} required=${required}`);
}
if (contrastItems.length > 20) {
  console.log(`LIGHTHOUSE_CONTRAST_FAILURES_TRUNCATED count=${contrastItems.length}`);
}

if (accessibility.score < 1) process.exitCode = 1;
