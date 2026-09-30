export interface JsonSchema {
  [key: string]: unknown;
}

export interface McpTool {
  name: string;
  description?: string;
  inputSchema: JsonSchema;
  [key: string]: unknown;
}

export interface McpResource {
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
  [key: string]: unknown;
}

export interface McpResourceTemplate {
  uriTemplate: string;
  name?: string;
  description?: string;
  mimeType?: string;
  [key: string]: unknown;
}

export interface McpPrompt {
  name: string;
  [key: string]: unknown;
}

export interface McpCapabilitySnapshot {
  format: "mcp-capability-snapshot";
  formatVersion: 1;
  server: {
    name: string;
    version?: string;
  };
  source?: {
    type: "static" | "introspection";
    capturedAt?: string;
    transport?: string;
  };
  capabilities: {
    tools: McpTool[];
    resources: McpResource[];
    resourceTemplates: McpResourceTemplate[];
    prompts: McpPrompt[];
  };
}
