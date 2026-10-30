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

if (accessibility.score < 1) process.exitCode = 1;
