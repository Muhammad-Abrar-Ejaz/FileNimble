import { readFile } from "node:fs/promises";

const reportPath = process.env.PLAYWRIGHT_JSON_OUTPUT_NAME;

if (!reportPath) {
  console.log("PLAYWRIGHT_DIAGNOSTIC category=report-path-unset");
  process.exit(0);
}

let report;
try {
  report = JSON.parse(await readFile(reportPath, "utf8"));
} catch {
  console.log("PLAYWRIGHT_DIAGNOSTIC category=report-missing-or-invalid");
  process.exit(0);
}

const failures = [];
const visit = (suites = []) => {
  for (const suite of suites) {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        const failedResult = (test.results ?? []).find((result) => result.status === "failed" || result.status === "timedOut");
        if (!failedResult) continue;

        const message = failedResult.error?.message ?? "";
        const category = /timeout|timed out/i.test(message)
          ? "timeout"
          : /expect|expected|received|assert/i.test(message)
            ? "assertion"
            : /navigation|net::|page\.goto/i.test(message)
              ? "navigation"
              : message
                ? "runtime"
                : "unknown";
        const file = String(spec.file ?? "unknown").split(/[\\/]/).slice(-2).join("/");
        failures.push({ file, line: Number(spec.line) || 0, title: String(spec.title ?? "unnamed-test").replace(/[\r\n\t]/g, " "), category });
      }
    }
    visit(suite.suites);
  }
};

visit(report.suites);

if (failures.length === 0) {
  console.log("PLAYWRIGHT_DIAGNOSTIC category=no-failed-test-records");
} else {
  for (const failure of failures) {
    console.log(`PLAYWRIGHT_FAILURE ${failure.file}:${failure.line} ${failure.title} category=${failure.category}`);
  }
}
