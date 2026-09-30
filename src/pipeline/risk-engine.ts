import type {
  UnscoredToolChange,
  ToolChange,
  UnscoredResourceChange,
  ResourceChange,
  UnscoredResourceTemplateChange,
  ResourceTemplateChange,
  UnscoredPromptChange,
  PromptChange,
  UnscoredExpandedChanges,
  ExpandedCapabilityChanges
} from "../types/diff.js";
import type { RiskAssessment, RiskReason, RiskLevel } from "../types/risk.js";
import { RISK_PRIORITY } from "../types/risk.js";
import rulesCatalog from "../risk/catalog.json" with { type: "json" };

const KEYWORD_RULES = rulesCatalog.rules
  .filter(r => r.type === "KEYWORD_EXPANSION")
  .map(r => ({
    ...r,
    regexes: r.patterns.map(p => new RegExp(p, "gi"))
  }));

export class RiskEngine {
  // =========================================================
  // v0.1 LEGACY CONTRACT (DO NOT MODIFY)
  // =========================================================
  static assess(changes: UnscoredToolChange[]): ToolChange[] {
    return this.assessTools(changes);
  }

  // =========================================================
  // v0.2 EXPANDED CONTRACT
  // =========================================================
  static assessExpanded(changes: UnscoredExpandedChanges): ExpandedCapabilityChanges {
    return {
      tools: this.assessTools(changes.tools),
      resources: this.assessResources(changes.resources),
      resourceTemplates: this.assessResourceTemplates(changes.resourceTemplates),
      prompts: this.assessPrompts(changes.prompts)
    };
  }

  private static assessTools(changes: UnscoredToolChange[]): ToolChange[] {
    return changes.map(change => {
      const reasons: RiskReason[] = [];

      if (change.type === "removed") {
        // Removing a capability decreases attack surface.
      } else if (change.type === "added") {
        reasons.push(this.getNewToolReason(change.name));
        const newText = `${change.name} ${change.description?.new || ""}`;
        reasons.push(...this.assessKeywordExpansion("", newText));
      } else if (change.type === "modified") {
        const oldText = change.description?.old || "";
        const newText = change.description?.new || "";
        reasons.push(...this.assessKeywordExpansion(oldText, newText));

        if (change.schema) {
          reasons.push(...this.assessSchemaExpansion(change.schema));
        }
      }

      return {
        ...change,
        risk: this.aggregateRisk(reasons)
      };
    });
  }

  private static assessResources(changes: UnscoredResourceChange[]): ResourceChange[] {
    return changes.map(change => {
      const reasons: RiskReason[] = [];

      if (change.type === "added") {
        const newText = `${change.uri} ${change.name?.new || ""} ${change.description?.new || ""}`;
        reasons.push(...this.assessKeywordExpansion("", newText));
      } else if (change.type === "modified") {
        const oldText = `${change.name?.old || ""} ${change.description?.old || ""}`;
        const newText = `${change.name?.new || ""} ${change.description?.new || ""}`;
        reasons.push(...this.assessKeywordExpansion(oldText, newText));
      }

      return {
        ...change,
        risk: this.aggregateRisk(reasons)
      };
    });
  }

  private static assessResourceTemplates(changes: UnscoredResourceTemplateChange[]): ResourceTemplateChange[] {
    return changes.map(change => {
      const reasons: RiskReason[] = [];

      if (change.type === "added") {
        const newText = `${change.uriTemplate} ${change.name?.new || ""} ${change.description?.new || ""}`;
        reasons.push(...this.assessKeywordExpansion("", newText));
      } else if (change.type === "modified") {
        const oldText = `${change.name?.old || ""} ${change.description?.old || ""}`;
        const newText = `${change.name?.new || ""} ${change.description?.new || ""}`;
        reasons.push(...this.assessKeywordExpansion(oldText, newText));
      }

      return {
        ...change,
        risk: this.aggregateRisk(reasons)
      };
    });
  }

  private static assessPrompts(changes: UnscoredPromptChange[]): PromptChange[] {
    return changes.map(change => {
      const reasons: RiskReason[] = [];

      if (change.type === "added") {
        const newText = `${change.name} ${change.description?.new || ""}`;
        reasons.push(...this.assessKeywordExpansion("", newText));
      } else if (change.type === "modified") {
        const oldText = change.description?.old || "";
        const newText = change.description?.new || "";
        reasons.push(...this.assessKeywordExpansion(oldText, newText));

        if (change.arguments) {
          for (const arg of change.arguments) {
            const becameRequired =
              (arg.type === "added" && arg.required?.new === true) ||
              (arg.type === "modified" && arg.required?.old === false && arg.required?.new === true);

            if (becameRequired) {
              reasons.push({
                ruleId: "RULE_NEW_REQUIRED_PARAM",
                level: "MEDIUM",
                message: "Prompt parameter changed from optional to required.",
                evidence: { kind: "requiredness", value: [arg.name] }
              });
            }
          }
        }
      }

      return {
        ...change,
        risk: this.aggregateRisk(reasons)
      };
    });
  }

  // =========================================================
  // HEURISTICS & HELPERS
  // =========================================================

  private static assessKeywordExpansion(oldText: string, newText: string): RiskReason[] {
    const reasons: RiskReason[] = [];
    for (const rule of KEYWORD_RULES) {
      const oldMatches = this.extractMatches(oldText, rule.regexes);
      const newMatches = this.extractMatches(newText, rule.regexes);

      const introduced = [...newMatches].filter(match => !oldMatches.has(match));

      if (introduced.length > 0) {
        reasons.push({
          ruleId: rule.id,
          level: rule.level as RiskLevel,
          message: rule.message,
          evidence: { kind: "keyword", value: introduced }
        });
      }
    }
    return reasons;
  }

  private static assessSchemaExpansion(schemaDiff: NonNullable<UnscoredToolChange["schema"]>): RiskReason[] {
    const reasons: RiskReason[] = [];

    if (schemaDiff.requiredAdded.length > 0) {
      reasons.push({
        ruleId: "RULE_NEW_REQUIRED_PARAM",
        level: "MEDIUM",
        message: "Parameter(s) changed from optional to required.",
        evidence: { kind: "requiredness", value: schemaDiff.requiredAdded.map(path => path.join(".")) }
      });
    }

    if (schemaDiff.requiredRemoved.length > 0) {
      reasons.push({
        ruleId: "RULE_SCHEMA_CONSTRAINT_RELAXED",
        level: "LOW",
        message: "Parameter(s) changed from required to optional, relaxing constraints.",
        evidence: { kind: "constraint", value: schemaDiff.requiredRemoved.map(path => path.join(".")) }
      });
    }

    const addedProps = schemaDiff.properties.filter(property => property.type === "added");
    if (addedProps.length > 0) {
      reasons.push({
        ruleId: "RULE_NEW_PARAM_ADDED",
        level: "LOW",
        message: "New parameter(s) added, expanding tool flexibility.",
        evidence: { kind: "property", value: addedProps.map(property => property.path.join(".")) }
      });
    }

    const removedConstraints = schemaDiff.properties.filter(
      property => property.type === "removed" &&
        ["maximum", "minimum", "maxLength", "pattern", "const", "enum", "readOnly"].includes(property.path[property.path.length - 1])
    );

    if (removedConstraints.length > 0) {
      reasons.push({
        ruleId: "RULE_SCHEMA_CONSTRAINT_RELAXED",
        level: "MEDIUM",
        message: "Schema constraints were removed, broadening allowed input.",
        evidence: { kind: "constraint", value: removedConstraints.map(property => property.path.join(".")) }
      });
    }

    return reasons;
  }

  private static getNewToolReason(name: string): RiskReason {
    return {
      ruleId: "RULE_NEW_TOOL_ADDED",
      level: "SAFE",
      message: "A new tool was added to the server.",
      evidence: { kind: "tool", value: name }
    };
  }

  private static aggregateRisk(reasons: RiskReason[]): RiskAssessment {
    if (reasons.length === 0) return { level: "SAFE", reasons: [] };

    const highest = reasons.reduce((max, reason) =>
      RISK_PRIORITY[reason.level] > RISK_PRIORITY[max.level] ? reason : max
    );

    reasons.sort((a, b) => RISK_PRIORITY[b.level] - RISK_PRIORITY[a.level]);

    return { level: highest.level, reasons };
  }

  private static extractMatches(text: string, regexes: RegExp[]): Set<string> {
    const matches = new Set<string>();
    if (!text) return matches;

    for (const regex of regexes) {
      regex.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(text)) !== null) {
        matches.add(match[0].toLowerCase());
      }
    }
    return matches;
  }
}
