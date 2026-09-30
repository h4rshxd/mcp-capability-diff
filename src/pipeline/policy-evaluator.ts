import type { ExpandedCapabilityChanges } from "../types/diff.js";
import type { McpSecurityPolicy, PolicyResult, PolicyViolation } from "../types/policy.js";

export class PolicyEvaluator {
  static evaluate(changes: ExpandedCapabilityChanges, policy: McpSecurityPolicy): PolicyResult {
    const violations: PolicyViolation[] = [];
    const allowed = policy.allowed_capabilities || {};

    // Helper to check if a capability name/URI matches any allowed pattern (with glob support)
    const isAllowed = (itemKey: string, allowedPatterns?: string[]): boolean => {
      if (!allowedPatterns) return false;
      return allowedPatterns.some(pattern => {
        const regex = new RegExp("^" + pattern.split("*").map(escapeRegExp).join(".*") + "$");
        return regex.test(itemKey);
      });
    };

    // Evaluate Tools
    for (const tool of changes.tools) {
      // Only evaluate added or modified capabilities against policy rules
      if (tool.type === "removed") continue;
      
      const allowedByName = isAllowed(tool.name, allowed.tools);
      if (!allowedByName) {
        if (policy.default_action === "block") {
          violations.push({
            capabilityType: "tool",
            name: tool.name,
            reason: `Tool '${tool.name}' is not explicitly allowed by policy (default_action: block).`
          });
        }
      }
    }

    // Evaluate Resources
    for (const res of changes.resources) {
      if (res.type === "removed") continue;
      
      const allowedByUri = isAllowed(res.uri, allowed.resources);
      if (!allowedByUri && policy.default_action === "block") {
        violations.push({
          capabilityType: "resource",
          name: res.uri,
          reason: `Resource '${res.uri}' is not explicitly allowed by policy (default_action: block).`
        });
      }
    }

    // Evaluate Resource Templates
    for (const tpl of changes.resourceTemplates) {
      if (tpl.type === "removed") continue;
      
      const allowedByTemplate = isAllowed(tpl.uriTemplate, allowed.resourceTemplates);
      if (!allowedByTemplate && policy.default_action === "block") {
        violations.push({
          capabilityType: "resourceTemplate",
          name: tpl.uriTemplate,
          reason: `Resource Template '${tpl.uriTemplate}' is not explicitly allowed by policy (default_action: block).`
        });
      }
    }

    // Evaluate Prompts
    for (const prompt of changes.prompts) {
      if (prompt.type === "removed") continue;
      
      const allowedByName = isAllowed(prompt.name, allowed.prompts);
      if (!allowedByName && policy.default_action === "block") {
        violations.push({
          capabilityType: "prompt",
          name: prompt.name,
          reason: `Prompt '${prompt.name}' is not explicitly allowed by policy (default_action: block).`
        });
      }
    }

    const action = violations.length > 0 ? "block" : "allow";

    return {
      action,
      violations
    };
  }
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
