import type { McpCapabilitySnapshot, JsonSchema } from "../types/snapshot.js";
import { compareStrings, compareCanonicalValues } from "../utils/compare.js";

export class Normalizer {
  static normalize(snapshot: McpCapabilitySnapshot): McpCapabilitySnapshot {
    const clone = JSON.parse(JSON.stringify(snapshot)) as McpCapabilitySnapshot;

    if (clone.capabilities?.tools) {
      for (const tool of clone.capabilities.tools) {
        if (tool.inputSchema) {
          tool.inputSchema =
            this.canonicalizeJsonSchema(tool.inputSchema) as JsonSchema;
        }
      }
    }

    const canonicalBase =
      this.deepSortObjectKeys(clone) as McpCapabilitySnapshot;

    if (Array.isArray(canonicalBase.capabilities?.tools)) {
      canonicalBase.capabilities.tools.sort((a, b) =>
        compareStrings(a.name, b.name)
      );
    }

    if (Array.isArray(canonicalBase.capabilities?.resources)) {
      canonicalBase.capabilities.resources.sort((a, b) =>
        compareStrings(a.uri, b.uri)
      );
    }

    if (Array.isArray(canonicalBase.capabilities?.resourceTemplates)) {
      canonicalBase.capabilities.resourceTemplates.sort((a, b) =>
        compareStrings(a.uriTemplate, b.uriTemplate)
      );
    }

    if (Array.isArray(canonicalBase.capabilities?.prompts)) {
      canonicalBase.capabilities.prompts.sort((a, b) =>
        compareStrings(a.name, b.name)
      );
    }

    return canonicalBase;
  }

  private static canonicalizeJsonSchema(schema: unknown): unknown {
    if (schema === null || typeof schema !== "object") {
      return schema;
    }

    if (Array.isArray(schema)) {
      return schema.map(item => this.canonicalizeJsonSchema(item));
    }

    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(schema)) {
      if (
        (key === "required" || key === "enum") &&
        Array.isArray(value)
      ) {
        result[key] = [...value]
          .map(item => this.canonicalizeJsonSchema(item))
          .sort(compareCanonicalValues);
      } else {
        result[key] = this.canonicalizeJsonSchema(value);
      }
    }

    return result;
  }

  private static deepSortObjectKeys(value: unknown): unknown {
    if (value === null || typeof value !== "object") {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map(item => this.deepSortObjectKeys(item));
    }

    const sortedKeys = Object.keys(value).sort(compareStrings);
    const result: Record<string, unknown> = {};

    for (const key of sortedKeys) {
      result[key] = this.deepSortObjectKeys(
        (value as Record<string, unknown>)[key]
      );
    }

    return result;
  }
}
