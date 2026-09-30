import type { JsonSchema } from "./snapshot.js";

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

import type { RiskAssessment, RiskLevel } from "./risk.js";

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
