import { describe, it, expect } from "vitest";
import { RiskEngine } from "../risk-engine.js";
import type { UnscoredToolChange } from "../../types/diff.js";

describe("Risk Engine", () => {
  describe("Aggregation & Tie Breaking", () => {
    it("returns SAFE for removed tools", () => {
      const assessed = RiskEngine.assess([
        { name: "test", type: "removed" }
      ]);

      expect(assessed[0].risk.level).toBe("SAFE");
      expect(assessed[0].risk.reasons).toHaveLength(0);
    });

    it("returns SAFE for added benign tool, but preserves NEW_TOOL reason", () => {
      const assessed = RiskEngine.assess([
        { name: "get_weather", type: "added" }
      ]);

      expect(assessed[0].risk.level).toBe("SAFE");
      expect(assessed[0].risk.reasons[0].ruleId)
        .toBe("RULE_NEW_TOOL_ADDED");
    });
  });

  describe("Differential Keyword Matching", () => {
    it("does not flag existing keywords in modified tools", () => {
      const assessed = RiskEngine.assess([{
        name: "test",
        type: "modified",
        description: {
          old: "executes stuff",
          new: "executes more stuff"
        }
      }]);

      expect(assessed[0].risk.level).toBe("SAFE");
    });

    it("flags newly introduced keywords", () => {
      const assessed = RiskEngine.assess([{
        name: "test",
        type: "modified",
        description: {
          old: "parses stuff",
          new: "parses and executes stuff"
        }
      }]);

      expect(assessed[0].risk.level).toBe("CRITICAL");
      expect(assessed[0].risk.reasons[0].ruleId)
        .toBe("RULE_EXECUTION_CAPABILITY");
    });

    it("escalates added tools with dangerous names", () => {
      const assessed = RiskEngine.assess([
        { name: "execute_shell", type: "added" }
      ]);

      expect(assessed[0].risk.level).toBe("CRITICAL");
    });
  });

  describe("Schema Constraint Relaxations", () => {
    it("flags required parameter added as MEDIUM", () => {
      const schemaChange = {
        properties: [],
        requiredAdded: [["config", "force"]],
        requiredRemoved: []
      };

      const assessed = RiskEngine.assess([{
        name: "test",
        type: "modified",
        schema: schemaChange
      }]);

      expect(assessed[0].risk.level).toBe("MEDIUM");
      expect(assessed[0].risk.reasons[0].ruleId)
        .toBe("RULE_NEW_REQUIRED_PARAM");
    });

    it("flags required parameter removed as LOW", () => {
      const schemaChange = {
        properties: [],
        requiredAdded: [],
        requiredRemoved: [["config", "force"]]
      };

      const assessed = RiskEngine.assess([{
        name: "test",
        type: "modified",
        schema: schemaChange
      }]);

      expect(assessed[0].risk.level).toBe("LOW");
      expect(assessed[0].risk.reasons[0].ruleId)
        .toBe("RULE_SCHEMA_CONSTRAINT_RELAXED");
    });

    it("flags explicit maximum/pattern removals as MEDIUM constraint relaxations", () => {
      const schemaChange = {
        properties: [{
          type: "removed",
          path: ["config", "timeout", "maximum"]
        } as any],
        requiredAdded: [],
        requiredRemoved: []
      };

      const assessed = RiskEngine.assess([{
        name: "test",
        type: "modified",
        schema: schemaChange
      }]);

      expect(assessed[0].risk.level).toBe("MEDIUM");
      expect(assessed[0].risk.reasons[0].ruleId)
        .toBe("RULE_SCHEMA_CONSTRAINT_RELAXED");

      expect(assessed[0].risk.reasons[0].evidence.value)
        .toEqual(["config.timeout.maximum"]);
    });
  });
});
