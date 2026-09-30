export interface PolicyCapabilities {
  tools?: string[];
  resources?: string[];
  resourceTemplates?: string[];
  prompts?: string[];
}

export interface McpSecurityPolicy {
  version: 1;
  server: string;
  default_action: "allow" | "block";
  allowed_capabilities?: PolicyCapabilities;
}

export interface PolicyViolation {
  capabilityType: "tool" | "resource" | "resourceTemplate" | "prompt";
  name: string;
  reason: string;
}

export interface PolicyResult {
  action: "allow" | "block";
  violations: PolicyViolation[];
}
