#!/usr/bin/env node
import { Command } from "commander";
import { readFileSync } from "fs";
import { McpCapabilityDiff, SecurityGate } from "../index.js";
import { PolicyParser, PolicyValidationError } from "../policy/parser.js";
import { Renderers } from "./renderers.js";
import { RISK_PRIORITY, type RiskLevel } from "../types/risk.js";
import { SnapshotValidationError, Validator } from "../pipeline/validator.js";

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
  .option("--policy <path>", "Path to security policy YAML file")
  .option("--explain", "Include rule evidence in text output", false)
  .option("-q, --quiet", "Suppress text output (JSON/SARIF still emit)", false);

program.parse();

const [oldPath, newPath] = program.args;
const opts = program.opts();

try {
  let oldRaw, newRaw;
  try {
    oldRaw = JSON.parse(readFileSync(oldPath, "utf-8"));
    newRaw = JSON.parse(readFileSync(newPath, "utf-8"));

    // Validate snapshots upfront to catch schema errors immediately
    Validator.validate(oldRaw);
    Validator.validate(newRaw);
    Validator.validateCompatibility(oldRaw, newRaw);
  } catch (err: any) {
    if (err.code === "ENOENT") {
      console.error(`\nInternal Error: ${err.message}\n`);
      process.exit(EXIT_CODES.INTERNAL_ERROR);
    }
    if (err instanceof SnapshotValidationError) {
      throw err;
    }
    throw new SnapshotValidationError(`Failed to parse or validate snapshot JSON files: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Parse policy if provided
  let policy;
  if (opts.policy) {
    try {
      const policyYaml = readFileSync(opts.policy, "utf-8");
      policy = PolicyParser.parse(policyYaml, newRaw.server?.name);
    } catch (err) {
      if (err instanceof PolicyValidationError) {
        console.error(`\nPolicy Validation Error: ${err.message}\n`);
      } else {
        console.error(`\nError reading policy file: ${err instanceof Error ? err.message : String(err)}\n`);
      }
      process.exit(EXIT_CODES.INVALID_INPUT);
    }
  }

  const threshold = opts.failOn.toUpperCase() as RiskLevel;
  if (!(threshold in RISK_PRIORITY)) {
    throw new Error(`Invalid --fail-on threshold: ${opts.failOn}`);
  }

  // Run full security gate evaluation
  const gateResult = SecurityGate.evaluate(oldRaw, newRaw, {
    policy,
    failOnThreshold: threshold
  });

  // For compatibility with renderers, construct standard diff result
  const diffResult = McpCapabilityDiff.compare(oldRaw, newRaw);

  if (!opts.quiet || opts.format !== "text") {
    let output = "";
    if (opts.format === "json") {
      output = Renderers.json(diffResult);
    } else if (opts.format === "sarif") {
      output = Renderers.sarif(diffResult);
    } else if (opts.format === "text") {
      output = Renderers.text(diffResult, opts.explain);
      if (policy && gateResult.violations.length > 0) {
        console.log("\nPolicy Violations:");
        for (const v of gateResult.violations) {
          console.log(`  - [${v.capabilityType}] ${v.name}: ${v.reason}`);
        }
      }
    } else {
      throw new Error(`Invalid output format: ${opts.format}`);
    }
    console.log(output);
  }

  // Enforce Exit Code
  if (gateResult.exitCode !== 0) {
    process.exit(EXIT_CODES.RISK_THRESHOLD);
  }

  process.exit(EXIT_CODES.SUCCESS);
} catch (err) {
  if (err instanceof SnapshotValidationError || err instanceof SyntaxError || (err instanceof Error && err.message.includes("JSON"))) {
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
