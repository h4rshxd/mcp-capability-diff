import { describe, it, expect } from "vitest";
import { PolicyParser, PolicyValidationError } from "../../policy/parser.js";

describe("Policy Parser & Validator", () => {
  it("successfully parses valid YAML policy", () => {
    const yamlContent = `
      version: 1
      server: "test-server"
      default_action: "allow"
      allowed_capabilities:
        tools:
          - "safe_tool"
    `;

    const policy = PolicyParser.parse(yamlContent, "test-server");
    expect(policy.version).toBe(1);
    expect(policy.server).toBe("test-server");
    expect(policy.default_action).toBe("allow");
    expect(policy.allowed_capabilities?.tools).toContain("safe_tool");
  });

  it("throws PolicyValidationError on invalid YAML syntax", () => {
    const badYaml = "version: [unclosed bracket";
    expect(() => PolicyParser.parse(badYaml)).toThrow(PolicyValidationError);
  });

  it("throws PolicyValidationError on schema violation (extra keys/missing required)", () => {
    const invalidSchema = `
      version: 1
      server: "test-server"
      default_action: "allow"
      unknown_field: "not allowed"
    `;
    expect(() => PolicyParser.parse(invalidSchema)).toThrow(PolicyValidationError);
  });

  it("throws PolicyValidationError on server name mismatch", () => {
    const yamlContent = `
      version: 1
      server: "wrong-server"
      default_action: "allow"
    `;
    expect(() => PolicyParser.parse(yamlContent, "target-server")).toThrow(PolicyValidationError);
  });
});
