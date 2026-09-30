import type { 
  DiffChangeType, 
  UnscoredToolChange, 
  UnscoredResourceChange, 
  UnscoredResourceTemplateChange, 
  UnscoredPromptChange,
  ExpandedCapabilityChanges,
  ToolChange,
  ResourceChange,
  ResourceTemplateChange,
  PromptChange
} from '../src/types/diff.js';
import type { RiskAssessment } from '../src/types/risk.js';

const SAFE_RISK: RiskAssessment = { level: "SAFE", reasons: [] };

export const Fixtures = {
  // Unscored Factories
  tool(name: string, type: DiffChangeType = "added"): UnscoredToolChange {
    return { name, type };
  },
  resource(uri: string, type: DiffChangeType = "added"): UnscoredResourceChange {
    return { uri, type };
  },
  resourceTemplate(uriTemplate: string, type: DiffChangeType = "added"): UnscoredResourceTemplateChange {
    return { uriTemplate, type };
  },
  prompt(name: string, type: DiffChangeType = "added"): UnscoredPromptChange {
    return { name, type };
  },

  // Scored Factories
  scoredTool(name: string, type: DiffChangeType = "added", risk: RiskAssessment = SAFE_RISK): ToolChange {
    return { ...this.tool(name, type), risk };
  },
  scoredResource(uri: string, type: DiffChangeType = "added", risk: RiskAssessment = SAFE_RISK): ResourceChange {
    return { ...this.resource(uri, type), risk };
  },
  scoredTemplate(uriTemplate: string, type: DiffChangeType = "added", risk: RiskAssessment = SAFE_RISK): ResourceTemplateChange {
    return { ...this.resourceTemplate(uriTemplate, type), risk };
  },
  scoredPrompt(name: string, type: DiffChangeType = "added", risk: RiskAssessment = SAFE_RISK): PromptChange {
    return { ...this.prompt(name, type), risk };
  },

  // Aggregate Factories
  emptyExpandedChanges(): ExpandedCapabilityChanges {
    return { tools: [], resources: [], resourceTemplates: [], prompts: [] };
  }
};
