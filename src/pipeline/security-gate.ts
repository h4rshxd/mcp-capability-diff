import type { McpCapabilitySnapshot } from "../types/snapshot.js";
import type { McpSecurityPolicy } from "../types/policy.js";
import type { RiskLevel } from "../types/risk.js";
import { RISK_PRIORITY } from "../types/risk.js";
import { DiffEngine, UnscoredDiffResult } from "./differ.js";
import { RiskEngine } from "./risk-engine.js";
import { PolicyEvaluator } from "./policy-evaluator.js";

export interface SecurityGateOptions {
  failOnThreshold?: RiskLevel;
  policy?: McpSecurityPolicy;
}

export interface SecurityGateResult {
  decision: "PASS" | "BLOCK";
  exitCode: number;
  highestRisk: RiskLevel;
  policyViolationsCount: number;
  diff: UnscoredDiffResult;
  scoredChanges: ReturnType<typeof RiskEngine.assessExpanded>;
  violations: ReturnType<typeof PolicyEvaluator.evaluate>["violations"];
}

export class SecurityGate {
  static evaluate(
    oldSnap: McpCapabilitySnapshot,
    newSnap: McpCapabilitySnapshot,
    options: SecurityGateOptions = {}
  ): SecurityGateResult {
    // 1. Generate unscored diff AST
    const unscoredDiff = DiffEngine.diff(oldSnap, newSnap);

    // 2. Map unscored diff into expanded capability changes format for risk assessment
    const unscoredExpanded = {
      tools: unscoredDiff.changes.tools,
      resources: unscoredDiff.changes.resources,
      resourceTemplates: unscoredDiff.changes.resourceTemplates,
      prompts: unscoredDiff.changes.prompts
    };

    // 3. Assess risk across all surfaces
    const scoredChanges = RiskEngine.assessExpanded(unscoredExpanded);

    // 4. Determine highest risk level across all changes
    const allRisks: RiskLevel[] = [];
    const collectRisks = (items: { risk: { level: RiskLevel } }[]) => {
      for (const item of items) {
        allRisks.push(item.risk.level);
      }
    };

    collectRisks(scoredChanges.tools);
    collectRisks(scoredChanges.resources);
    collectRisks(scoredChanges.resourceTemplates);
    collectRisks(scoredChanges.prompts);

    let highestRisk: RiskLevel = "SAFE";
    for (const risk of allRisks) {
      if (RISK_PRIORITY[risk] > RISK_PRIORITY[highestRisk]) {
        highestRisk = risk;
      }
    }

    // 5. Evaluate policy if provided
    let policyViolations: ReturnType<typeof PolicyEvaluator.evaluate>["violations"] = [];
    if (options.policy) {
      const policyResult = PolicyEvaluator.evaluate(scoredChanges, options.policy);
      policyViolations = policyResult.violations;
    }

    // 6. Enforce security invariants
    const failThreshold = options.failOnThreshold || "HIGH";
    const exceedsThreshold = RISK_PRIORITY[highestRisk] >= RISK_PRIORITY[failThreshold];
    const hasPolicyViolations = policyViolations.length > 0;

    const isBlocked = hasPolicyViolations || exceedsThreshold;
    const decision = isBlocked ? "BLOCK" : "PASS";
    const exitCode = isBlocked ? 1 : 0;

    return {
      decision,
      exitCode,
      highestRisk,
      policyViolationsCount: policyViolations.length,
      diff: unscoredDiff,
      scoredChanges,
      violations: policyViolations
    };
  }
}
