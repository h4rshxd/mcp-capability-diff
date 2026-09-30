import { Validator } from "./pipeline/validator.js";
import { Normalizer } from "./pipeline/normalizer.js";
import { DiffEngine } from "./pipeline/differ.js";
import { RiskEngine } from "./pipeline/risk-engine.js";
import { SecurityGate } from "./pipeline/security-gate.js";
import { PolicyParser } from "./policy/parser.js";
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

    // Map to expanded changes for v0.2 risk assessment
    const expandedChanges = {
      tools: unscoredDiff.changes.tools,
      resources: unscoredDiff.changes.resources,
      resourceTemplates: unscoredDiff.changes.resourceTemplates,
      prompts: unscoredDiff.changes.prompts
    };

    const assessed = RiskEngine.assessExpanded(expandedChanges);

    let highestRisk: RiskLevel = "SAFE";
    const collectRisks = (items: { risk: { level: RiskLevel } }[]) => {
      for (const item of items) {
        if (RISK_PRIORITY[item.risk.level] > RISK_PRIORITY[highestRisk]) {
          highestRisk = item.risk.level;
        }
      }
    };

    collectRisks(assessed.tools);
    collectRisks(assessed.resources);
    collectRisks(assessed.resourceTemplates);
    collectRisks(assessed.prompts);

    // Keep backwards compatible CapabilityDiffResult structure for tools, plus new surfaces if needed
    return {
      server: unscoredDiff.server,
      summary: {
        totalToolChanges: assessed.tools.length + assessed.resources.length + assessed.resourceTemplates.length + assessed.prompts.length,
        highestRisk
      },
      changes: { tools: assessed.tools }
    };
  }
}

export { SecurityGate, PolicyParser };
