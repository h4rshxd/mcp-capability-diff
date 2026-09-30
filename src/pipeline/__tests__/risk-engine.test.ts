import { describe, it, expect } from "vitest";
import { RiskEngine } from "../risk-engine.js";
import { Fixtures } from "../../../tests/factories.js";

describe("Risk Engine", () => {
  describe("v0.1 Legacy Tool Assessment", () => {
    it("returns SAFE for removed tools", () => {
      const assessed = RiskEngine.assess([Fixtures.tool("test", "removed")]);
      expect(assessed[0].risk.level).toBe("SAFE");
      expect(assessed[0].risk.reasons).toHaveLength(0);
    });

    it("returns SAFE for added benign tool, but preserves NEW_TOOL reason", () => {
      const assessed = RiskEngine.assess([Fixtures.tool("get_weather", "added")]);
      expect(assessed[0].risk.level).toBe("SAFE");
      expect(assessed[0].risk.reasons[0].ruleId).toBe("RULE_NEW_TOOL_ADDED");
    });

    it("escalates added tools with dangerous names", () => {
      const assessed = RiskEngine.assess([Fixtures.tool("execute_shell", "added")]);
      expect(assessed[0].risk.level).toBe("CRITICAL");
    });
  });

  describe("v0.2 Expanded Assessment", () => {
    it("assesses resources for keyword expansion", () => {
      const changes = Fixtures.emptyExpandedChanges();
      changes.resources = [{
        ...Fixtures.resource("file:///dangerous/path", "modified"),
        description: { old: "reads", new: "executes bash scripts" }
      }] as any; // Allow unscored cast for input

      const assessed = RiskEngine.assessExpanded(changes as any);
      expect(assessed.resources[0].risk.level).toBe("CRITICAL");
      expect(assessed.resources[0].risk.reasons[0].evidence.value).toContain("executes");
    });

    it("assesses prompts for required argument additions", () => {
      const changes = Fixtures.emptyExpandedChanges();
      changes.prompts = [{
        ...Fixtures.prompt("analyze", "modified"),
        arguments: [{ name: "query", type: "modified", required: { old: false, new: true } }]
      }] as any;

      const assessed = RiskEngine.assessExpanded(changes as any);
      expect(assessed.prompts[0].risk.level).toBe("MEDIUM");
      expect(assessed.prompts[0].risk.reasons[0].ruleId).toBe("RULE_NEW_REQUIRED_PARAM");
    });

    it("evaluates removed items across all surfaces as SAFE", () => {
      const changes = {
        tools: [Fixtures.tool("t1", "removed")],
        resources: [Fixtures.resource("r1", "removed")],
        resourceTemplates: [Fixtures.resourceTemplate("rt1", "removed")],
        prompts: [Fixtures.prompt("p1", "removed")]
      };

      const assessed = RiskEngine.assessExpanded(changes as any);

      expect(assessed.tools[0].risk.level).toBe("SAFE");
      expect(assessed.resources[0].risk.level).toBe("SAFE");
      expect(assessed.resourceTemplates[0].risk.level).toBe("SAFE");
      expect(assessed.prompts[0].risk.level).toBe("SAFE");
    });
  });
});
