import { describe, it, expect } from "vitest";
import { Validator, SnapshotValidationError } from "../validator.js";
import type { McpCapabilitySnapshot } from "../../types/snapshot.js";

function createBaseSnapshot(): McpCapabilitySnapshot {
  return {
    format: "mcp-capability-snapshot",
    formatVersion: 1,
    server: {
      name: "test-server",
      version: "1.0.0"
    },
    capabilities: {
      tools: [],
      resources: [],
      resourceTemplates: [],
      prompts: []
    }
  };
}

describe("Validator", () => {
  describe("Structural Validation", () => {
    it("accepts valid v1 snapshot", () => {
      expect(() => Validator.validate(createBaseSnapshot())).not.toThrow();
    });

    it("rejects invalid format identifier", () => {
      const invalid = {
        format: "wrong-format",
        formatVersion: 99,
        capabilities: {}
      };

      expect(() => Validator.validate(invalid))
        .toThrow(/Schema validation failed/);
    });
  });

  describe("Semantic Validation", () => {
    it("accepts unique capabilities", () => {
      const snap = createBaseSnapshot();

      snap.capabilities.tools = [
        { name: "tool1", inputSchema: {} },
        { name: "tool2", inputSchema: {} }
      ];

      snap.capabilities.resources = [
        { uri: "file:///1" }
      ];

      snap.capabilities.resourceTemplates = [
        { uriTemplate: "file:///{id}" }
      ];

      snap.capabilities.prompts = [
        { name: "prompt1" }
      ];

      expect(() => Validator.validate(snap)).not.toThrow();
    });

    it("rejects duplicate tools", () => {
      const snap = createBaseSnapshot();

      snap.capabilities.tools = [
        { name: "read_file", inputSchema: {} },
        { name: "read_file", inputSchema: {} }
      ];

      expect(() => Validator.validate(snap))
        .toThrow(SnapshotValidationError);

      expect(() => Validator.validate(snap))
        .toThrow(/Duplicate Tool detected: 'read_file'/);
    });

    it("rejects duplicate resources", () => {
      const snap = createBaseSnapshot();

      snap.capabilities.resources = [
        { uri: "file:///config" },
        { uri: "file:///config" }
      ];

      expect(() => Validator.validate(snap))
        .toThrow(/Duplicate Resource detected: 'file:\/\/\/config'/);
    });

    it("rejects duplicate resource templates", () => {
      const snap = createBaseSnapshot();

      snap.capabilities.resourceTemplates = [
        { uriTemplate: "file:///{path}" },
        { uriTemplate: "file:///{path}" }
      ];

      expect(() => Validator.validate(snap))
        .toThrow(/Duplicate Resource Template detected: 'file:\/\/\/{path}'/);
    });

    it("rejects duplicate prompts", () => {
      const snap = createBaseSnapshot();

      snap.capabilities.prompts = [
        { name: "analyze_code" },
        { name: "analyze_code" }
      ];

      expect(() => Validator.validate(snap))
        .toThrow(/Duplicate Prompt detected: 'analyze_code'/);
    });
  });

  describe("Compatibility Validation", () => {
    it("accepts compatible snapshots", () => {
      const oldSnap = createBaseSnapshot();
      const newSnap = createBaseSnapshot();

      newSnap.server.version = "1.1.0";

      expect(() =>
        Validator.validateCompatibility(oldSnap, newSnap)
      ).not.toThrow();
    });

    it("rejects format mismatch", () => {
      const oldSnap = createBaseSnapshot();
      const newSnap = createBaseSnapshot();

      newSnap.format = "mcp-unsupported-snapshot" as never;

      expect(() =>
        Validator.validateCompatibility(oldSnap, newSnap)
      ).toThrow(/Format mismatch/);
    });

    it("rejects format version mismatch", () => {
      const oldSnap = createBaseSnapshot();
      const newSnap = createBaseSnapshot();

      newSnap.formatVersion = 2 as never;

      expect(() =>
        Validator.validateCompatibility(oldSnap, newSnap)
      ).toThrow(/Format version mismatch: Cannot compare v1 with v2/);
    });

    it("rejects server mismatch", () => {
      const oldSnap = createBaseSnapshot();
      const newSnap = createBaseSnapshot();

      newSnap.server.name = "different-server";

      expect(() =>
        Validator.validateCompatibility(oldSnap, newSnap)
      ).toThrow(
        /Server mismatch: Cannot compare 'test-server' with 'different-server'/
      );
    });
  });
});
