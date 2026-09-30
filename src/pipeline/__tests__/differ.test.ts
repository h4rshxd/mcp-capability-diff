import { describe, it, expect } from "vitest";
import { DiffEngine } from "../differ.js";
import type { McpCapabilitySnapshot } from "../../types/snapshot.js";

describe("Diff Engine", () => {
  const base = (): McpCapabilitySnapshot => ({
    format: "mcp-capability-snapshot",
    formatVersion: 1,
    server: { name: "test", version: "1" },
    capabilities: {
      tools: [],
      resources: [],
      resourceTemplates: [],
      prompts: []
    }
  });

  describe("Tool Level", () => {
    it("returns empty changes when tools are identical", () => {
      const snap = base();

      snap.capabilities.tools = [
        {
          name: "test",
          inputSchema: { type: "object" }
        }
      ];

      const diff = DiffEngine.diff(snap, snap);

      expect(diff.changes.tools).toHaveLength(0);
    });

    it("identifies added, removed, and modified tools", () => {
      const oldSnap = base();

      oldSnap.capabilities.tools = [
        {
          name: "remove_me",
          inputSchema: {}
        },
        {
          name: "modify_me",
          description: "old",
          inputSchema: {}
        }
      ];

      const newSnap = base();

      newSnap.capabilities.tools = [
        {
          name: "modify_me",
          description: "new",
          inputSchema: {}
        },
        {
          name: "add_me",
          inputSchema: {}
        }
      ];

      const diff = DiffEngine.diff(oldSnap, newSnap);
      const tools = diff.changes.tools;

      expect(tools).toHaveLength(3);

      expect(
        tools.find(t => t.name === "add_me")?.type
      ).toBe("added");

      expect(
        tools.find(t => t.name === "remove_me")?.type
      ).toBe("removed");

      const modified = tools.find(
        t => t.name === "modify_me"
      );

      expect(modified?.type).toBe("modified");

      expect(modified?.description).toEqual({
        old: "old",
        new: "new"
      });
    });
  });

  describe("Schema Level ($root and properties)", () => {
    it("detects property additions and modifications unambiguously", () => {
      const oldSnap = base();

      oldSnap.capabilities.tools = [
        {
          name: "test",
          inputSchema: {
            properties: {
              config: {
                type: "string"
              }
            }
          }
        }
      ];

      const newSnap = base();

      newSnap.capabilities.tools = [
        {
          name: "test",
          inputSchema: {
            properties: {
              config: {
                type: "number"
              },
              force: {
                type: "boolean"
              }
            }
          }
        }
      ];

      const diff = DiffEngine.diff(oldSnap, newSnap);
      const schemaDiff = diff.changes.tools[0].schema!;

      expect(schemaDiff.properties).toHaveLength(2);

      expect(
        schemaDiff.properties.find(
          p => p.path[0] === "force"
        )?.type
      ).toBe("added");

      expect(
        schemaDiff.properties.find(
          p => p.path[0] === "config"
        )?.type
      ).toBe("modified");
    });

    it("detects root schema replacement without false parent modification flags", () => {
      const oldSnap = base();

      oldSnap.capabilities.tools = [
        {
          name: "test",
          inputSchema: {
            type: "object",
            properties: {
              a: {
                type: "string"
              }
            }
          }
        }
      ];

      const newSnap = base();

      newSnap.capabilities.tools = [
        {
          name: "test",
          inputSchema: {
            anyOf: [
              {
                type: "string"
              }
            ],
            properties: {
              a: {
                type: "string"
              }
            }
          }
        }
      ];

      const diff = DiffEngine.diff(oldSnap, newSnap);
      const schemaDiff = diff.changes.tools[0].schema!;

      expect(schemaDiff.properties).toHaveLength(1);

      expect(schemaDiff.properties[0].path).toEqual([
        "$root"
      ]);

      expect(schemaDiff.properties[0].type).toBe("modified");
    });
  });

  describe("Recursive Requiredness", () => {
    it("detects nested required additions and removals", () => {
      const oldSnap = base();

      oldSnap.capabilities.tools = [
        {
          name: "test",
          inputSchema: {
            required: ["root_optional"],
            properties: {
              config: {
                type: "object",
                required: ["timeout"]
              }
            }
          }
        }
      ];

      const newSnap = base();

      newSnap.capabilities.tools = [
        {
          name: "test",
          inputSchema: {
            required: ["root_required"],
            properties: {
              config: {
                type: "object",
                required: []
              }
            }
          }
        }
      ];

      const diff = DiffEngine.diff(oldSnap, newSnap);
      const schemaDiff = diff.changes.tools[0].schema!;

      expect(schemaDiff.requiredAdded).toEqual([
        ["root_required"]
      ]);

      expect(schemaDiff.requiredRemoved).toEqual([
        ["config", "timeout"],
        ["root_optional"]
      ]);
    });
  });
});
