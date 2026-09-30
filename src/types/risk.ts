export type RiskLevel = "SAFE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export const RISK_PRIORITY: Record<RiskLevel, number> = {
  SAFE: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4
} as const;

export interface RiskReason {
  ruleId: string;
  level: RiskLevel;
  message: string;
  evidence: {
    kind: "keyword" | "property" | "requiredness" | "tool" | "constraint";
    value: string | string[];
    path?: string[];
  };
}

export interface RiskAssessment {
  level: RiskLevel;
  reasons: RiskReason[];
}
