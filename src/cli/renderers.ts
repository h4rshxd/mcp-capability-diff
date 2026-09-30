import pc from "picocolors";
import { readFileSync } from "fs";
import type { CapabilityDiffResult } from "../types/diff.js";
import type { RiskLevel } from "../types/risk.js";

const pkg = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf-8")
);

export const Renderers = {
  json(diff: CapabilityDiffResult): string {
    return JSON.stringify(diff, null, 2);
  },

  sarif(diff: CapabilityDiffResult): string {
    const SARIF_LEVEL_MAP: Record<
      RiskLevel,
      "error" | "warning" | "note" | "none"
    > = {
      CRITICAL: "error",
      HIGH: "error",
      MEDIUM: "warning",
      LOW: "note",
      SAFE: "none"
    };

    const results = [];

    for (const tool of diff.changes.tools) {
      if (tool.risk.level === "SAFE") continue;

      for (const reason of tool.risk.reasons) {
        results.push({
          ruleId: reason.ruleId,
          level: SARIF_LEVEL_MAP[reason.level],
          message: {
            text: `Tool '${tool.name}': ${reason.message} (Evidence: ${JSON.stringify(reason.evidence)})`
          },
          locations: [
            {
              logicalLocations: [
                {
                  fullyQualifiedName: `tools.${tool.name}`
                }
              ]
            }
          ]
        });
      }
    }

    return JSON.stringify(
      {
        version: "2.1.0",
        $schema: "https://json.schemastore.org/sarif-2.1.0.json",
        runs: [
          {
            tool: {
              driver: {
                name: pkg.name,
                version: pkg.version,
                informationUri:
                  pkg.homepage ||
                  pkg.repository?.url ||
                  "https://github.com/",
                rules: []
              }
            },
            results
          }
        ]
      },
      null,
      2
    );
  },

  text(diff: CapabilityDiffResult, explain: boolean): string {
    if (diff.changes.tools.length === 0) {
      return pc.green("No capability changes detected.");
    }

    let out =
      pc.bold("MCP Capability Diff\n") +
      pc.dim("────────────────────────────────────\n");

    out += `Server: ${pc.cyan(diff.server.name)}\n`;
    out += `Version: ${diff.server.oldVersion || "unknown"} → ${diff.server.newVersion || "unknown"}\n\n`;

    const COLORS: Record<RiskLevel, (s: string) => string> = {
      CRITICAL: pc.red,
      HIGH: pc.red,
      MEDIUM: pc.yellow,
      LOW: pc.blue,
      SAFE: pc.green
    };

    for (const tool of diff.changes.tools) {
      const color = COLORS[tool.risk.level];
      const sign =
        tool.type === "added"
          ? "+"
          : tool.type === "removed"
            ? "-"
            : "~";

      out += `${color(tool.risk.level.padEnd(10))} ${sign} ${pc.bold(tool.name)}\n`;

      if (explain) {
        for (const reason of tool.risk.reasons) {
          out += `  ${pc.dim("└")} ${reason.message}\n`;
          out += `    ${pc.dim(`Evidence [${reason.evidence.kind}]:${JSON.stringify(reason.evidence.value)}`)}\n`;
        }
      }
    }

    out += pc.dim("\n────────────────────────────────────\n");
    out += `Tools changed: ${diff.summary.totalToolChanges}\n`;
    out += `Highest risk:  ${COLORS[diff.summary.highestRisk](diff.summary.highestRisk)}\n`;

    return out;
  }
};
