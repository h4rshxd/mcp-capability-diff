import type { McpCapabilitySnapshot, McpTool } from "../types/snapshot.js";
import type { UnscoredToolChange } from "../types/diff.js";
import { compareStrings } from "../utils/compare.js";
import { SchemaDiffer } from "./schema-differ.js";

export interface UnscoredDiffResult {
  server: {
    name: string;
    oldVersion?: string;
    newVersion?: string;
  };
  changes: {
    tools: UnscoredToolChange[];
  };
}

export class DiffEngine {
  static diff(
    oldSnap: McpCapabilitySnapshot,
    newSnap: McpCapabilitySnapshot
  ): UnscoredDiffResult {
    const oldTools = new Map(
      oldSnap.capabilities.tools.map(tool => [tool.name, tool])
    );

    const newTools = new Map(
      newSnap.capabilities.tools.map(tool => [tool.name, tool])
    );

    const toolChanges: UnscoredToolChange[] = [];

    for (const [name, oldTool] of oldTools.entries()) {
      const newTool = newTools.get(name);

      if (!newTool) {
        toolChanges.push({
          name,
          type: "removed"
        });
        continue;
      }

      const diff = this.diffTool(oldTool, newTool);

      if (diff) {
        toolChanges.push(diff);
      }
    }

    for (const name of newTools.keys()) {
      if (!oldTools.has(name)) {
        toolChanges.push({
          name,
          type: "added"
        });
      }
    }

    toolChanges.sort((a, b) =>
      compareStrings(a.name, b.name)
    );

    return {
      server: {
        name: newSnap.server.name,
        oldVersion: oldSnap.server.version,
        newVersion: newSnap.server.version
      },
      changes: {
        tools: toolChanges
      }
    };
  }

  private static diffTool(
    oldTool: McpTool,
    newTool: McpTool
  ): UnscoredToolChange | null {
    const change: UnscoredToolChange = {
      name: newTool.name,
      type: "modified"
    };

    let hasChanges = false;

    if (oldTool.description !== newTool.description) {
      change.description = {
        old: oldTool.description,
        new: newTool.description
      };

      hasChanges = true;
    }

    if (
      JSON.stringify(oldTool.inputSchema) !==
      JSON.stringify(newTool.inputSchema)
    ) {
      const schemaDiff = SchemaDiffer.diff(
        oldTool.inputSchema,
        newTool.inputSchema
      );

      if (
        schemaDiff.properties.length > 0 ||
        schemaDiff.requiredAdded.length > 0 ||
        schemaDiff.requiredRemoved.length > 0
      ) {
        change.schema = schemaDiff;
        hasChanges = true;
      }
    }

    return hasChanges ? change : null;
  }
}
