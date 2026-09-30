import { describe, it, expect } from "vitest";
import { PolicyEvaluator } from "../policy-evaluator.js";
import { Fixtures } from "../../../tests/factories.js";

describe("Policy Evaluator", () => {
  it("allows capabilities that match explicit allowed list", () => {
    const changes = Fixtures.emptyExpandedChanges();
    changes.tools = [Fixtures.scoredTool("safe_tool", "added")];

    const policy = {
      version: 1 as const,
      server: "test-server",
      default_action: "block" as const,
      allowed_capabilities: {
        tools: ["safe_tool"]
      }
    };

    const result = PolicyEvaluator.evaluate(changes, policy);
    expect(result.action).toBe("allow");
    expect(result.violations).toHaveLength(0);
  });

  it("blocks unlisted capabilities when default_action is block", () => {
    const changes = Fixtures.emptyExpandedChanges();
    changes.tools = [Fixtures.scoredTool("dangerous_tool", "added")];

    const policy = {
      version: 1 as const,
      server: "test-server",
      default_action: "block" as const,
      allowed_capabilities: {
        tools: ["safe_tool"]
      }
    };

    const result = PolicyEvaluator.evaluate(changes, policy);
    expect(result.action).toBe("block");
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].name).toBe("dangerous_tool");
  });

  it("supports wildcard glob matching in allowed capabilities", () => {
    const changes = Fixtures.emptyExpandedChanges();
    changes.resources = [Fixtures.scoredResource("file:///app/logs/error.log", "added")];

    const policy = {
      version: 1 as const,
      server: "test-server",
      default_action: "block" as const,
      allowed_capabilities: {
        resources: ["file:///app/logs/*"]
      }
    };

    const result = PolicyEvaluator.evaluate(changes, policy);
    expect(result.action).toBe("allow");
    expect(result.violations).toHaveLength(0);
  });
});
