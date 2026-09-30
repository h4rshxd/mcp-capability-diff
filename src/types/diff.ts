import type { JsonSchema } from "./snapshot.js";
import type { RiskAssessment, RiskLevel } from "./risk.js";

// =========================================================
// v0.1 LEGACY CONTRACTS (DO NOT MODIFY)
// =========================================================

export type DiffChangeType = "added" | "removed" | "modified";

export interface FieldChange<T> {
  old?: T;
  new?: T;
}

export interface PropertyChange {
  type: DiffChangeType;
  path: string[];
  oldSchema?: JsonSchema;
  newSchema?: JsonSchema;
}

export interface SchemaChange {
  properties: PropertyChange[];
  requiredAdded: string[][];
  requiredRemoved: string[][];
}

export interface UnscoredToolChange {
  name: string;
  type: DiffChangeType;
  description?: FieldChange<string>;
  schema?: SchemaChange;
}

export interface ToolChange extends UnscoredToolChange {
  risk: RiskAssessment;
}

export interface CapabilityDiffResult {
  server: {
    name: string;
    oldVersion?: string;
    newVersion?: string;
  };
  summary: {
    totalToolChanges: number;
    highestRisk: RiskLevel;
  };
  changes: {
    tools: ToolChange[];
  };
}

// =========================================================
// v0.2 EXPANDED CAPABILITY SURFACES
// =========================================================

export interface UnscoredResourceChange {
  uri: string;
  type: DiffChangeType;
  name?: FieldChange<string>;
  description?: FieldChange<string>;
  mimeType?: FieldChange<string>;
}

export interface UnscoredResourceTemplateChange {
  uriTemplate: string;
  type: DiffChangeType;
  name?: FieldChange<string>;
  description?: FieldChange<string>;
  mimeType?: FieldChange<string>;
}

export interface PromptArgumentChange {
  name: string;
  type: DiffChangeType;
  description?: FieldChange<string>;
  required?: FieldChange<boolean>;
}

export interface UnscoredPromptChange {
  name: string;
  type: DiffChangeType;
  description?: FieldChange<string>;
  arguments?: PromptArgumentChange[];
}

export interface UnscoredExpandedChanges {
  tools: UnscoredToolChange[];
  resources: UnscoredResourceChange[];
  resourceTemplates: UnscoredResourceTemplateChange[];
  prompts: UnscoredPromptChange[];
}

export interface ResourceChange extends UnscoredResourceChange {
  risk: RiskAssessment;
}

export interface ResourceTemplateChange extends UnscoredResourceTemplateChange {
  risk: RiskAssessment;
}

export interface PromptChange extends UnscoredPromptChange {
  risk: RiskAssessment;
}

export interface ExpandedCapabilityChanges {
  tools: ToolChange[];
  resources: ResourceChange[];
  resourceTemplates: ResourceTemplateChange[];
  prompts: PromptChange[];
}

// =========================================================
// v0.2 SECURITY GATE CONTRACTS
// =========================================================

export type GateRiskLevel = "NONE" | RiskLevel;

export interface SecurityGateResult {
  server: {
    name: string;
    oldVersion?: string;
    newVersion?: string;
  };
  verdict: "PASS" | "BLOCK";
  summary: {
    totalChanges: number;
    highestRisk: GateRiskLevel;
    policyViolations: number;
  };
  policy: import("./policy.js").PolicyResult;
  changes: ExpandedCapabilityChanges;
}

// Strictly-typed identifier extraction.
// No any. No internal casts.
export const CapabilityIdentifier = {
  tools: (item: UnscoredToolChange): string => item.name,
  resources: (item: UnscoredResourceChange): string => item.uri,
  resourceTemplates: (item: UnscoredResourceTemplateChange): string =>
    item.uriTemplate,
  prompts: (item: UnscoredPromptChange): string => item.name
} as const;
