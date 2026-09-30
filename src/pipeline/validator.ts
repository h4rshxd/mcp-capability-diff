import Ajv2020Module from "ajv/dist/2020.js";
import type { ErrorObject } from "ajv";
import snapshotSchema from "../../schemas/mcp-capability-snapshot.v1.json" with { type: "json" };
import type { McpCapabilitySnapshot } from "../types/snapshot.js";

const Ajv2020 =
  (Ajv2020Module as typeof Ajv2020Module & { default?: typeof Ajv2020Module }).default ??
  Ajv2020Module;

export class SnapshotValidationError extends Error {
  constructor(message: string) {
    super(`Snapshot Validation Error: ${message}`);
  }
}

const ajv = new Ajv2020({
  allErrors: true,
  strict: true
});

const validateSchema = ajv.compile(snapshotSchema);

export class Validator {
  static validate(
    raw: unknown
  ): asserts raw is McpCapabilitySnapshot {
    if (!validateSchema(raw)) {
      const details = (validateSchema.errors ?? [])
        .map(
          (error: ErrorObject) =>
            `${error.instancePath || "/"} ${error.message ?? "validation error"}`
        )
        .join("; ");

      throw new SnapshotValidationError(
        `Schema validation failed: ${details}`
      );
    }

    const snapshot = raw as unknown as McpCapabilitySnapshot;

    this.checkDuplicates(snapshot.capabilities.tools, "name", "Tool");
    this.checkDuplicates(
      snapshot.capabilities.resources,
      "uri",
      "Resource"
    );
    this.checkDuplicates(
      snapshot.capabilities.resourceTemplates,
      "uriTemplate",
      "Resource Template"
    );
    this.checkDuplicates(
      snapshot.capabilities.prompts,
      "name",
      "Prompt"
    );
  }

  static validateCompatibility(
    oldSnap: McpCapabilitySnapshot,
    newSnap: McpCapabilitySnapshot
  ): void {
    if (oldSnap.format !== newSnap.format) {
      throw new SnapshotValidationError(
        `Format mismatch: Cannot compare '${oldSnap.format}' with '${newSnap.format}'`
      );
    }

    if (oldSnap.formatVersion !== newSnap.formatVersion) {
      throw new SnapshotValidationError(
        `Format version mismatch: Cannot compare v${oldSnap.formatVersion} with v${newSnap.formatVersion}`
      );
    }

    if (oldSnap.server.name !== newSnap.server.name) {
      throw new SnapshotValidationError(
        `Server mismatch: Cannot compare '${oldSnap.server.name}' with '${newSnap.server.name}'`
      );
    }
  }

  private static checkDuplicates<T>(
    items: T[],
    key: keyof T,
    typeName: string
  ): void {
    const seen = new Set<string>();

    for (const item of items) {
      const value = String(item[key]);

      if (seen.has(value)) {
        throw new SnapshotValidationError(
          `Duplicate ${typeName} detected: '${value}'`
        );
      }

      seen.add(value);
    }
  }
}
