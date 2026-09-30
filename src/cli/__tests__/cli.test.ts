import { describe, expect, it } from "vitest";
import { McpCapabilityDiff } from "../../index.js";
import { Renderers } from "../renderers.js";

const base = {
  format: "mcp-capability-snapshot",
  formatVersion: 1,
  server: { name: "test-server", version: "1.0.0" },
  capabilities: {
    tools: [],
    resources: [],
    resourceTemplates: [],
    prompts: []
  }
};

const expanded = {
  ...base,
  server: { name: "test-server", version: "2.0.0" },
  capabilities: {
    ...base.capabilities,
    tools: [
      {
        name: "execute_shell",
        description: "Runs a command",
        inputSchema: { type: "object" }
      }
    ]
  }
};

describe("CLI integration", () => {
  it("returns SAFE for identical snapshots", () => {
    const result = McpCapabilityDiff.compare(base, base);

    expect(result.summary.totalToolChanges).toBe(0);
    expect(result.summary.highestRisk).toBe("SAFE");
    expect(Renderers.text(result, false)).toContain(
      "No capability changes detected."
    );
  });

  it("detects critical capability expansion", () => {
    const result = McpCapabilityDiff.compare(base, expanded);

    expect(result.summary.totalToolChanges).toBe(1);
    expect(result.summary.highestRisk).toBe("CRITICAL");
    expect(result.changes.tools[0].name).toBe("execute_shell");
    expect(result.changes.tools[0].risk.level).toBe("CRITICAL");
  });

  it("renders valid JSON", () => {
    const result = McpCapabilityDiff.compare(base, expanded);
    const parsed = JSON.parse(Renderers.json(result));

    expect(parsed.summary.highestRisk).toBe("CRITICAL");
    expect(parsed.changes.tools).toHaveLength(1);
  });

  it("renders valid SARIF", () => {
    const result = McpCapabilityDiff.compare(base, expanded);
    const parsed = JSON.parse(Renderers.sarif(result));

    expect(parsed.version).toBe("2.1.0");
    expect(parsed.runs).toHaveLength(1);
    expect(parsed.runs[0].results).toHaveLength(2);
    expect(parsed.runs[0].results[0].ruleId).toBe(
      "RULE_EXECUTION_CAPABILITY"
    );
  });
});
