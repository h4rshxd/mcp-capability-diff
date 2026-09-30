#!/usr/bin/env node

import { Command } from "commander";
import { readFileSync } from "fs";
import { McpCapabilityDiff } from "../index.js";
import { Renderers } from "./renderers.js";
import { RISK_PRIORITY, type RiskLevel } from "../types/risk.js";
import { SnapshotValidationError } from "../pipeline/validator.js";

const EXIT_CODES = {
  SUCCESS: 0,
  RISK_THRESHOLD: 1,
  INVALID_INPUT: 2,
  INTERNAL_ERROR: 3
} as const;

const program = new Command();

program
  .name("mcp-capability-diff")
  .description("Capability-change detection and risk-review tool for MCP servers")
  .argument("<old-snapshot>", "Path to the old MCP capability snapshot JSON")
  .argument("<new-snapshot>", "Path to the new MCP capability snapshot JSON")
  .option(
    "-f, --format <format>",
    "Output format (text, json, sarif)",
    "text"
  )
  .option(
    "-t, --fail-on <level>",
    "Exit 1 if risk meets or exceeds level (safe, low, medium, high, critical)",
    "high"
  )
  .option("--explain", "Include rule evidence in text output", false)
  .option("-q, --quiet", "Suppress text output (JSON/SARIF still emit)", false);

program.parse();

const [oldPath, newPath] = program.args;
const opts = program.opts();

try {
  const oldRaw = JSON.parse(readFileSync(oldPath, "utf-8"));
  const newRaw = JSON.parse(readFileSync(newPath, "utf-8"));

  const diffResult = McpCapabilityDiff.compare(oldRaw, newRaw);

  if (!opts.quiet || opts.format !== "text") {
    let output = "";

    if (opts.format === "json") {
      output = Renderers.json(diffResult);
    } else if (opts.format === "sarif") {
      output = Renderers.sarif(diffResult);
    } else if (opts.format === "text") {
      output = Renderers.text(diffResult, opts.explain);
    } else {
      throw new Error(`Invalid output format: ${opts.format}`);
    }

    console.log(output);
  }

  const threshold = opts.failOn.toUpperCase() as RiskLevel;

  if (!(threshold in RISK_PRIORITY)) {
    throw new Error(`Invalid --fail-on threshold: ${opts.failOn}`);
  }

  if (
    diffResult.summary.totalToolChanges > 0 &&
    RISK_PRIORITY[diffResult.summary.highestRisk] >=
      RISK_PRIORITY[threshold]
  ) {
    process.exit(EXIT_CODES.RISK_THRESHOLD);
  }

  process.exit(EXIT_CODES.SUCCESS);
} catch (err) {
  if (err instanceof SnapshotValidationError) {
    console.error(`\nValidation Error: ${err.message}\n`);
    process.exit(EXIT_CODES.INVALID_INPUT);
  }

  console.error(
    "\nInternal Error:",
    err instanceof Error ? err.message : String(err),
    "\n"
  );

  process.exit(EXIT_CODES.INTERNAL_ERROR);
}
