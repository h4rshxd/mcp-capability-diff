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

  describe("Resource Level", () => {
    it("identifies added and removed resources", () => {
      const oldSnap = base();

      oldSnap.capabilities.resources = [
        { uri: "file:///remove.txt" }
      ];

      const newSnap = base();

      newSnap.capabilities.resources = [
        { uri: "file:///add.txt" }
      ];

      const diff = DiffEngine.diff(oldSnap, newSnap);
      const resources = diff.changes.resources;

      expect(resources).toHaveLength(2);

      expect(
        resources.find(r => r.uri === "file:///add.txt")?.type
      ).toBe("added");

      expect(
        resources.find(r => r.uri === "file:///remove.txt")?.type
      ).toBe("removed");
    });

    it("detects resource metadata modifications", () => {
      const oldSnap = base();

      oldSnap.capabilities.resources = [
        {
          uri: "file:///docs/readme.md",
          name: "Readme",
          description: "Old description",
          mimeType: "text/plain"
        }
      ];

      const newSnap = base();

      newSnap.capabilities.resources = [
        {
          uri: "file:///docs/readme.md",
          name: "README",
          description: "New description",
          mimeType: "text/markdown"
        }
      ];

      const diff = DiffEngine.diff(oldSnap, newSnap);
      const resource = diff.changes.resources[0];

      expect(resource.type).toBe("modified");
      expect(resource.name).toEqual({
        old: "Readme",
        new: "README"
      });
      expect(resource.description).toEqual({
        old: "Old description",
        new: "New description"
      });
      expect(resource.mimeType).toEqual({
        old: "text/plain",
        new: "text/markdown"
      });
    });

    it("returns no resource change when resources are identical", () => {
      const snap = base();

      snap.capabilities.resources = [
        {
          uri: "file:///docs/readme.md",
          name: "README",
          description: "Documentation",
          mimeType: "text/markdown"
        }
      ];

      const diff = DiffEngine.diff(snap, snap);

      expect(diff.changes.resources).toHaveLength(0);
    });

    it("sorts resource changes deterministically by URI", () => {
      const oldSnap = base();
      const newSnap = base();

      newSnap.capabilities.resources = [
        { uri: "file:///z.txt" },
        { uri: "file:///a.txt" },
        { uri: "file:///m.txt" }
      ];

      const diff = DiffEngine.diff(oldSnap, newSnap);

      expect(diff.changes.resources.map(r => r.uri)).toEqual([
        "file:///a.txt",
        "file:///m.txt",
        "file:///z.txt"
      ]);
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

  describe("Resource Template Level", () => {
    it("identifies added and removed resource templates", () => {
      const oldSnap = base();

      oldSnap.capabilities.resourceTemplates = [
        { uriTemplate: "file:///old/{path}" }
      ];

      const newSnap = base();

      newSnap.capabilities.resourceTemplates = [
        { uriTemplate: "file:///new/{path}" }
      ];

      const diff = DiffEngine.diff(oldSnap, newSnap);
      const templates = diff.changes.resourceTemplates;

      expect(templates).toHaveLength(2);

      expect(
        templates.find(
          t => t.uriTemplate === "file:///new/{path}"
        )?.type
      ).toBe("added");

      expect(
        templates.find(
          t => t.uriTemplate === "file:///old/{path}"
        )?.type
      ).toBe("removed");
    });

    it("detects resource template metadata modifications", () => {
      const oldSnap = base();

      oldSnap.capabilities.resourceTemplates = [
        {
          uriTemplate: "file:///docs/{path}",
          name: "Old",
          description: "Old description",
          mimeType: "text/plain"
        }
      ];

      const newSnap = base();

      newSnap.capabilities.resourceTemplates = [
        {
          uriTemplate: "file:///docs/{path}",
          name: "New",
          description: "New description",
          mimeType: "text/markdown"
        }
      ];

      const diff = DiffEngine.diff(oldSnap, newSnap);
      const template = diff.changes.resourceTemplates[0];

      expect(template.type).toBe("modified");
      expect(template.name).toEqual({
        old: "Old",
        new: "New"
      });
      expect(template.description).toEqual({
        old: "Old description",
        new: "New description"
      });
      expect(template.mimeType).toEqual({
        old: "text/plain",
        new: "text/markdown"
      });
    });

    it("returns no resource template change when identical", () => {
      const snap = base();

      snap.capabilities.resourceTemplates = [
        {
          uriTemplate: "file:///docs/{path}",
          name: "Docs"
        }
      ];

      const diff = DiffEngine.diff(snap, snap);

      expect(diff.changes.resourceTemplates).toHaveLength(0);
    });

    it("sorts resource template changes deterministically", () => {
      const oldSnap = base();
      const newSnap = base();

      newSnap.capabilities.resourceTemplates = [
        { uriTemplate: "file:///z/{path}" },
        { uriTemplate: "file:///a/{path}" },
        { uriTemplate: "file:///m/{path}" }
      ];

      const diff = DiffEngine.diff(oldSnap, newSnap);

      expect(
        diff.changes.resourceTemplates.map(t => t.uriTemplate)
      ).toEqual([
        "file:///a/{path}",
        "file:///m/{path}",
        "file:///z/{path}"
      ]);
    });
  });

  describe("Prompt Level", () => {
    it("identifies added and removed prompts", () => {
      const oldSnap = base();

      oldSnap.capabilities.prompts = [
        { name: "old_prompt" }
      ];

      const newSnap = base();

      newSnap.capabilities.prompts = [
        { name: "new_prompt" }
      ];

      const diff = DiffEngine.diff(oldSnap, newSnap);
      const prompts = diff.changes.prompts;

      expect(prompts).toHaveLength(2);

      expect(
        prompts.find(p => p.name === "new_prompt")?.type
      ).toBe("added");

      expect(
        prompts.find(p => p.name === "old_prompt")?.type
      ).toBe("removed");
    });

    it("detects prompt metadata modifications", () => {
      const oldSnap = base();

      oldSnap.capabilities.prompts = [
        {
          name: "search",
          description: "Old description",
          arguments: [
            {
              name: "query",
              description: "Old query",
              required: false
            }
          ]
        }
      ];

      const newSnap = base();

      newSnap.capabilities.prompts = [
        {
          name: "search",
          description: "New description",
          arguments: [
            {
              name: "query",
              description: "New query",
              required: true
            }
          ]
        }
      ];

      const diff = DiffEngine.diff(oldSnap, newSnap);
      const prompt = diff.changes.prompts[0];

      expect(prompt.type).toBe("modified");
      expect(prompt.description).toEqual({
        old: "Old description",
        new: "New description"
      });

      expect(prompt.arguments).toEqual([
        {
          name: "query",
          type: "modified",
          description: {
            old: "Old query",
            new: "New query"
          },
          required: {
            old: false,
            new: true
          }
        }
      ]);
    });

    it("returns no prompt change when identical", () => {
      const snap = base();

      snap.capabilities.prompts = [
        {
          name: "search",
          description: "Search"
        }
      ];

      const diff = DiffEngine.diff(snap, snap);

      expect(diff.changes.prompts).toHaveLength(0);
    });

    it("sorts prompt changes deterministically by name", () => {
      const oldSnap = base();
      const newSnap = base();

      newSnap.capabilities.prompts = [
        { name: "z_prompt" },
        { name: "a_prompt" },
        { name: "m_prompt" }
      ];

      const diff = DiffEngine.diff(oldSnap, newSnap);

      expect(diff.changes.prompts.map(p => p.name)).toEqual([
        "a_prompt",
        "m_prompt",
        "z_prompt"
      ]);
    });
  });
});
