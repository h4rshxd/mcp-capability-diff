import type { JsonSchema } from "../types/snapshot.js";
import type { SchemaChange, PropertyChange } from "../types/diff.js";
import { compareStrings } from "../utils/compare.js";

interface TraversalResult {
  nodes: Map<string, { path: string[]; schema: JsonSchema }>;
  requiredPaths: Set<string>;
}

export class SchemaDiffer {
  static diff(oldSchema: JsonSchema, newSchema: JsonSchema): SchemaChange {
    const oldData = this.traverse(oldSchema);
    const newData = this.traverse(newSchema);

    const properties: PropertyChange[] = [];

    for (const [pathKey, oldNode] of oldData.nodes.entries()) {
      const newNode = newData.nodes.get(pathKey);

      if (!newNode) {
        properties.push({
          type: "removed",
          path: oldNode.path,
          oldSchema: oldNode.schema
        });
      } else {
        const oldSemantics = JSON.stringify(this.getNodeSemantics(oldNode.schema));
        const newSemantics = JSON.stringify(this.getNodeSemantics(newNode.schema));

        if (oldSemantics !== newSemantics) {
          properties.push({
            type: "modified",
            path: oldNode.path,
            oldSchema: oldNode.schema,
            newSchema: newNode.schema
          });
        }
      }
    }

    for (const [pathKey, newNode] of newData.nodes.entries()) {
      if (!oldData.nodes.has(pathKey)) {
        properties.push({
          type: "added",
          path: newNode.path,
          newSchema: newNode.schema
        });
      }
    }

    const requiredAdded = [...newData.requiredPaths]
      .filter(path => !oldData.requiredPaths.has(path))
      .map(path => JSON.parse(path) as string[]);

    const requiredRemoved = [...oldData.requiredPaths]
      .filter(path => !newData.requiredPaths.has(path))
      .map(path => JSON.parse(path) as string[]);

    properties.sort((a, b) =>
      compareStrings(JSON.stringify(a.path), JSON.stringify(b.path))
    );

    requiredAdded.sort((a, b) =>
      compareStrings(JSON.stringify(a), JSON.stringify(b))
    );

    requiredRemoved.sort((a, b) =>
      compareStrings(JSON.stringify(a), JSON.stringify(b))
    );

    return {
      properties,
      requiredAdded,
      requiredRemoved
    };
  }

  private static traverse(
    schema: JsonSchema,
    currentPath: string[] = [],
    result: TraversalResult = {
      nodes: new Map(),
      requiredPaths: new Set()
    }
  ): TraversalResult {
    if (!schema || typeof schema !== "object") {
      return result;
    }

    const effectivePath =
      currentPath.length === 0 ? ["$root"] : currentPath;

    result.nodes.set(JSON.stringify(effectivePath), {
      path: effectivePath,
      schema
    });

    if (Array.isArray(schema.required)) {
      for (const reqField of schema.required) {
        if (typeof reqField === "string") {
          const absolutePath =
            currentPath.length === 0
              ? [reqField]
              : [...currentPath, reqField];

          result.requiredPaths.add(JSON.stringify(absolutePath));
        }
      }
    }

    if (
      schema.properties &&
      typeof schema.properties === "object"
    ) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        this.traverse(
          propSchema as JsonSchema,
          [...currentPath, key],
          result
        );
      }
    }

    return result;
  }

  private static getNodeSemantics(schema: JsonSchema): JsonSchema {
    const { properties, required, ...semantics } = schema;
    return semantics;
  }
}
