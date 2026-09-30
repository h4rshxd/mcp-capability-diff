import { McpCapabilityDiff } from "./index.js";
import { readFileSync } from "fs";
import { Renderers } from "./cli/renderers.js";
import { RISK_PRIORITY, type RiskLevel } from "./types/risk.js";
import { SnapshotValidationError } from "./pipeline/validator.js";

const oldPath = process.env["INPUT_OLD-SNAPSHOT"];
const newPath = process.env["INPUT_NEW-SNAPSHOT"];
const format = process.env["INPUT_FORMAT"] || "sarif";
const failOn = (process.env["INPUT_FAIL-ON"] || "high").toUpperCase() as RiskLevel;
const explain = process.env["INPUT_EXPLAIN"] === "true";
const quiet = process.env["INPUT_QUIET"] === "true";

if (!oldPath || !newPath) {
  console.error("Missing required GitHub Action inputs: old-snapshot and new-snapshot");
  process.exit(2);
}

try {
  const oldRaw = JSON.parse(readFileSync(oldPath, "utf-8"));
  const newRaw = JSON.parse(readFileSync(newPath, "utf-8"));

  const diffResult = McpCapabilityDiff.compare(oldRaw, newRaw);

  if (!quiet || format !== "text") {
    let output: string;

    if (format === "json") {
      output = Renderers.json(diffResult);
    } else if (format === "sarif") {
      output = Renderers.sarif(diffResult);
    } else if (format === "text") {
      output = Renderers.text(diffResult, explain);
    } else {
      throw new Error(`Invalid output format: ${format}`);
    }

    console.log(output);
  }

  if (!(failOn in RISK_PRIORITY)) {
    throw new Error(`Invalid fail-on threshold: ${failOn}`);
  }

  if (
    diffResult.summary.totalToolChanges > 0 &&
    RISK_PRIORITY[diffResult.summary.highestRisk] >= RISK_PRIORITY[failOn]
  ) {
    process.exit(1);
  }

  process.exit(0);
} catch (err) {
  if (err instanceof SnapshotValidationError) {
    console.error(`Validation Error: ${err.message}`);
    process.exit(2);
  }

  console.error(
    "Internal Error:",
    err instanceof Error ? err.message : String(err)
  );
  process.exit(3);
}
