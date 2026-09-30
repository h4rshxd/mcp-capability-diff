import { Validator } from "./pipeline/validator.js";
import { Normalizer } from "./pipeline/normalizer.js";
import { DiffEngine } from "./pipeline/differ.js";
import { RiskEngine } from "./pipeline/risk-engine.js";
import { RISK_PRIORITY, type RiskLevel } from "./types/risk.js";
import type { CapabilityDiffResult } from "./types/diff.js";

export class McpCapabilityDiff {
  static compare(oldRaw: unknown, newRaw: unknown): CapabilityDiffResult {
    Validator.validate(oldRaw);
    Validator.validate(newRaw);
    Validator.validateCompatibility(oldRaw, newRaw);

    const oldCanonical = Normalizer.normalize(oldRaw);
    const newCanonical = Normalizer.normalize(newRaw);

    const unscoredDiff = DiffEngine.diff(oldCanonical, newCanonical);
    const scoredTools = RiskEngine.assess(unscoredDiff.changes.tools);

    let highestRisk: RiskLevel = "SAFE";

    for (const tool of scoredTools) {
      if (RISK_PRIORITY[tool.risk.level] > RISK_PRIORITY[highestRisk]) {
        highestRisk = tool.risk.level;
      }
    }

    return {
      server: unscoredDiff.server,
      summary: {
        totalToolChanges: scoredTools.length,
        highestRisk
      },
      changes: { tools: scoredTools }
    };
  }
}
