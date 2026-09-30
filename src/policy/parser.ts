import * as yaml from "js-yaml";
import AjvPkg from "ajv";
import schemaJson from "./schema.json" with { type: "json" };
import type { McpSecurityPolicy } from "../types/policy.js";

const Ajv = AjvPkg.default || AjvPkg;
const ajv = new (Ajv as any)({ allErrors: true });
const validateSchema = ajv.compile(schemaJson);

export class PolicyValidationError extends Error {
  constructor(message: string, public errors?: unknown[]) {
    super(message);
    this.name = "PolicyValidationError";
  }
}

export class PolicyParser {
  static parse(rawYaml: string, expectedServerName?: string): McpSecurityPolicy {
    let parsed: unknown;
    try {
      parsed = yaml.load(rawYaml);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new PolicyValidationError(`Failed to parse policy YAML: ${message}`);
    }

    if (!parsed || typeof parsed !== "object") {
      throw new PolicyValidationError("Policy must be a valid YAML object.");
    }

    const valid = validateSchema(parsed);
    if (!valid) {
      const errors = validateSchema.errors || [];
      const errorText = errors.map((e: any) => `${e.instancePath} ${e.message}`).join(", ");
      throw new PolicyValidationError(`Policy validation failed: ${errorText}`, errors);
    }

    const policy = parsed as McpSecurityPolicy;

    if (expectedServerName && policy.server !== expectedServerName) {
      throw new PolicyValidationError(
        `Policy target server mismatch: policy specifies '${policy.server}', but snapshot is for '${expectedServerName}'.`
      );
    }

    return policy;
  }
}
