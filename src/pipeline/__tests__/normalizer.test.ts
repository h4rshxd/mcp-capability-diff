import { describe, it, expect } from "vitest";
import { Normalizer } from "../normalizer.js";
import type { McpCapabilitySnapshot } from "../../types/snapshot.js";

describe("Normalizer", () => {
  const baseSnapshot = (): McpCapabilitySnapshot => ({
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

  it("does not mutate input", () => {
    const input = baseSnapshot();
    const originalString = JSON.stringify(input);

    Normalizer.normalize(input);

    expect(JSON.stringify(input)).toBe(originalString);
  });

  it("sorts object keys deterministically", () => {
    const snapA = baseSnapshot();
    snapA.server = { version: "1", name: "test" };

    const snapB = baseSnapshot();
    snapB.server = { name: "test", version: "1" };

    expect(JSON.stringify(Normalizer.normalize(snapA)))
      .toBe(JSON.stringify(Normalizer.normalize(snapB)));
  });

  it("semantically identical snapshots with different ordering produce identical canonical output", () => {
    const snapA = baseSnapshot();

    snapA.capabilities.tools = [
      {
        name: "zeta",
        inputSchema: {
          type: "object",
          required: ["timeout", "path"]
        }
      },
      {
        name: "alpha",
        inputSchema: {
          type: "object",
          required: ["path", "timeout"]
        }
      }
    ];

    const snapB = baseSnapshot();

    snapB.capabilities.tools = [
      {
        name: "alpha",
        inputSchema: {
          type: "object",
          required: ["timeout", "path"]
        }
      },
      {
        name: "zeta",
        inputSchema: {
          type: "object",
          required: ["path", "timeout"]
        }
      }
    ];

    expect(JSON.stringify(Normalizer.normalize(snapA)))
      .toBe(JSON.stringify(Normalizer.normalize(snapB)));
  });

  it("sorts tools, resources, templates, and prompts by identity keys", () => {
    const snap = baseSnapshot();

    snap.capabilities.tools = [
      { name: "z", inputSchema: {} },
      { name: "a", inputSchema: {} }
    ];

    snap.capabilities.resources = [
      { uri: "z" },
      { uri: "a" }
    ];

    snap.capabilities.resourceTemplates = [
      { uriTemplate: "z" },
      { uriTemplate: "a" }
    ];

    snap.capabilities.prompts = [
      { name: "z" },
      { name: "a" }
    ];

    const normalized = Normalizer.normalize(snap);

    expect(normalized.capabilities.tools[0].name).toBe("a");
    expect(normalized.capabilities.resources[0].uri).toBe("a");
    expect(normalized.capabilities.resourceTemplates[0].uriTemplate)
      .toBe("a");
    expect(normalized.capabilities.prompts[0].name).toBe("a");
  });

  it("sorts JSON Schema enum[] deterministically", () => {
    const snap = baseSnapshot();

    snap.capabilities.tools = [
      {
        name: "t",
        inputSchema: {
          enum: ["c", "a", "b"]
        }
      }
    ];

    const normalized = Normalizer.normalize(snap);

    expect(normalized.capabilities.tools[0].inputSchema.enum)
      .toEqual(["a", "b", "c"]);
  });

  it("preserves items, prefixItems, allOf, anyOf, oneOf arrays", () => {
    const snap = baseSnapshot();

    snap.capabilities.tools = [
      {
        name: "t",
        inputSchema: {
          allOf: [
            { type: "string" },
            { type: "number" }
          ],
          anyOf: [
            { type: "boolean" },
            { type: "null" }
          ],
          items: [
            { type: "integer" },
            { type: "array" }
          ]
        }
      }
    ];

    const normalized = Normalizer.normalize(snap);
    const schema =
      normalized.capabilities.tools[0].inputSchema as any;

    expect(schema.allOf[0].type).toBe("string");
    expect(schema.anyOf[0].type).toBe("boolean");
    expect(schema.items[0].type).toBe("integer");
  });

  it("canonicalizes deeply nested properties", () => {
    const snap = baseSnapshot();

    snap.capabilities.tools = [
      {
        name: "t",
        inputSchema: {
          properties: {
            config: {
              properties: {
                db: {
                  required: ["user", "host"],
                  type: "object"
                }
              }
            }
          }
        }
      }
    ];

    const normalized = Normalizer.normalize(snap);

    const dbSchema =
      (normalized.capabilities.tools[0].inputSchema as any)
        .properties.config.properties.db;

    expect(Object.keys(dbSchema))
      .toEqual(["required", "type"]);

    expect(dbSchema.required)
      .toEqual(["host", "user"]);
  });

  it("is idempotent", () => {
    const snap = baseSnapshot();

    snap.capabilities.tools = [
      {
        name: "zeta",
        inputSchema: {
          required: ["z", "a"]
        }
      }
    ];

    const once = Normalizer.normalize(snap);
    const twice = Normalizer.normalize(once);

    expect(JSON.stringify(once)).toBe(JSON.stringify(twice));
  });
});
