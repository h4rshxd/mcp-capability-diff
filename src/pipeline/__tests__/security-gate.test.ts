import { describe, it, expect } from "vitest";
import { SecurityGate } from "../security-gate.js";
import type { McpCapabilitySnapshot } from "../../types/snapshot.js";

describe("Security Gate (v0.2.0)", () => {
  const baseSnap: McpCapabilitySnapshot = {
    server: { name: "test-server", version: "1.0.0" },
    capabilities: { tools: [], resources: [], resourceTemplates: [], prompts: [] }
  };

  it("passes when no risks or policy violations occur", () => {
    const result = SecurityGate.evaluate(baseSnap, baseSnap);
    expect(result.decision).toBe("PASS");
    expect(result.exitCode).toBe(0);
    expect(result.highestRisk).toBe("SAFE");
  });

  it("blocks when highest risk meets or exceeds failOnThreshold", () => {
    const newSnap: McpCapabilitySnapshot = {
      server: { name: "test-server", version: "1.1.0" },
      capabilities: {
        tools: [{ name: "execute_shell", inputSchema: { type: "object" } }],
        resources: [],
        resourceTemplates: [],
        prompts: []
      }
    };

    // execute_shell triggers CRITICAL risk
    const result = SecurityGate.evaluate(baseSnap, newSnap, { failOnThreshold: "HIGH" });
    expect(result.decision).toBe("BLOCK");
    expect(result.exitCode).toBe(1);
    expect(result.highestRisk).toBe("CRITICAL");
  });

  it("blocks when policy violations are present even if risk is low", () => {
    const newSnap: McpCapabilitySnapshot = {
      server: { name: "test-server", version: "1.1.0" },
      capabilities: {
        tools: [{ name: "benign_tool", inputSchema: { type: "object" } }],
        resources: [],
        resourceTemplates: [],
        prompts: []
      }
    };

    const policy = {
      version: 1 as const,
      server: "test-server",
      default_action: "block" as const,
      allowed_capabilities: { tools: [] } // benign_tool not allowed
    };

    const result = SecurityGate.evaluate(baseSnap, newSnap, { policy, failOnThreshold: "CRITICAL" });
    expect(result.decision).toBe("BLOCK");
    expect(result.exitCode).toBe(1);
    expect(result.policyViolationsCount).toBe(1);
  });
});
