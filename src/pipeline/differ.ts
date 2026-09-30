import { SchemaDiffer } from "./schema-differ.js";
import type {
  ExpandedCapabilityChanges,
  UnscoredToolChange,
  UnscoredResourceChange,
  UnscoredResourceTemplateChange,
  UnscoredPromptChange,
  PromptArgumentChange
} from "../types/diff.js";

export interface UnscoredDiffResult {
  server: {
    name: string;
    oldVersion?: string;
    newVersion?: string;
  };
  summary: {
    totalToolChanges: number;
    totalResourceChanges: number;
    totalResourceTemplateChanges: number;
    totalPromptChanges: number;
  };
  changes: ExpandedCapabilityChanges;
}

export class DiffEngine {
  static diff(oldSnap: any, newSnap: any): UnscoredDiffResult {
    const oldToolsMap = new Map((oldSnap.capabilities.tools || []).map((t: any) => [t.name as string, t]));
    const newToolsMap = new Map((newSnap.capabilities.tools || []).map((t: any) => [t.name as string, t]));

    const oldResMap = new Map((oldSnap.capabilities.resources || []).map((r: any) => [r.uri as string, r]));
    const newResMap = new Map((newSnap.capabilities.resources || []).map((r: any) => [r.uri as string, r]));

    const oldTplMap = new Map((oldSnap.capabilities.resourceTemplates || []).map((t: any) => [t.uriTemplate as string, t]));
    const newTplMap = new Map((newSnap.capabilities.resourceTemplates || []).map((t: any) => [t.uriTemplate as string, t]));

    const oldPromptMap = new Map((oldSnap.capabilities.prompts || []).map((p: any) => [p.name as string, p]));
    const newPromptMap = new Map((newSnap.capabilities.prompts || []).map((p: any) => [p.name as string, p]));

    const tools: UnscoredToolChange[] = [];
    const resources: UnscoredResourceChange[] = [];
    const resourceTemplates: UnscoredResourceTemplateChange[] = [];
    const prompts: UnscoredPromptChange[] = [];

    // --- Tools ---
    for (const [name, newTool] of newToolsMap) {
      const oldTool = oldToolsMap.get(name);
      if (!oldTool) {
        tools.push({ name: name as string, type: "added" });
      } else {
        const changes = this.diffTool(oldTool, newTool);
        if (changes) {
          tools.push({
            name: name as string,
            type: "modified",
            description: changes.description,
            schema: changes.schema
          });
        }
      }
    }
    for (const [name] of oldToolsMap) {
      if (!newToolsMap.has(name)) {
        tools.push({ name: name as string, type: "removed" });
      }
    }

    // --- Resources ---
    for (const [uri, newRes] of newResMap) {
      const oldRes = oldResMap.get(uri);
      if (!oldRes) {
        resources.push({ uri: uri as string, type: "added" });
      } else {
        const changes = this.diffResource(oldRes, newRes);
        if (changes) {
          resources.push({
            uri: uri as string,
            type: "modified",
            name: changes.name,
            description: changes.description,
            mimeType: changes.mimeType
          });
        }
      }
    }
    for (const [uri] of oldResMap) {
      if (!newResMap.has(uri)) {
        resources.push({ uri: uri as string, type: "removed" });
      }
    }

    // --- Resource Templates ---
    for (const [uriTemplate, newTpl] of newTplMap) {
      const oldTpl = oldTplMap.get(uriTemplate);
      if (!oldTpl) {
        resourceTemplates.push({ uriTemplate: uriTemplate as string, type: "added" });
      } else {
        const changes = this.diffResourceTemplate(oldTpl, newTpl);
        if (changes) {
          resourceTemplates.push({
            uriTemplate: uriTemplate as string,
            type: "modified",
            name: changes.name,
            description: changes.description,
            mimeType: changes.mimeType
          });
        }
      }
    }
    for (const [uriTemplate] of oldTplMap) {
      if (!newTplMap.has(uriTemplate)) {
        resourceTemplates.push({ uriTemplate: uriTemplate as string, type: "removed" });
      }
    }

    // --- Prompts ---
    for (const [name, newPrompt] of newPromptMap) {
      const oldPrompt = oldPromptMap.get(name);
      if (!oldPrompt) {
        prompts.push({ name: name as string, type: "added" });
      } else {
        const changes = this.diffPrompt(oldPrompt, newPrompt);
        if (changes) {
          prompts.push({
            name: name as string,
            type: "modified",
            description: changes.description,
            arguments: changes.arguments
          });
        }
      }
    }
    for (const [name] of oldPromptMap) {
      if (!newPromptMap.has(name)) {
        prompts.push({ name: name as string, type: "removed" });
      }
    }

    tools.sort((a, b) => compareStrings(a.name, b.name));
    resources.sort((a, b) => compareStrings(a.uri, b.uri));
    resourceTemplates.sort((a, b) => compareStrings(a.uriTemplate, b.uriTemplate));
    prompts.sort((a, b) => compareStrings(a.name, b.name));

    return {
      server: {
        name: newSnap.server.name,
        oldVersion: oldSnap.server.version,
        newVersion: newSnap.server.version
      },
      summary: {
        totalToolChanges: tools.length,
        totalResourceChanges: resources.length,
        totalResourceTemplateChanges: resourceTemplates.length,
        totalPromptChanges: prompts.length
      },
      changes: {
        tools: tools as any,
        resources: resources as any,
        resourceTemplates: resourceTemplates as any,
        prompts: prompts as any
      }
    };
  }

  private static diffTool(oldTool: any, newTool: any) {
    let hasChanges = false;
    const result: any = {};

    if (oldTool.description !== newTool.description) {
      result.description = { old: oldTool.description, new: newTool.description };
      hasChanges = true;
    }

    const schemaDiff = SchemaDiffer.diff(oldTool.inputSchema, newTool.inputSchema);
    if (schemaDiff && Object.keys(schemaDiff).length > 0) {
      const hasActualSchemaChanges =
        (schemaDiff.properties && schemaDiff.properties.length > 0) ||
        (schemaDiff.requiredAdded && schemaDiff.requiredAdded.length > 0) ||
        (schemaDiff.requiredRemoved && schemaDiff.requiredRemoved.length > 0) ||
        (schemaDiff as any).rootType !== undefined ||
        (schemaDiff as any).root !== undefined;

      if (hasActualSchemaChanges) {
        result.schema = schemaDiff;
        hasChanges = true;
      }
    }

    return hasChanges ? result : null;
  }

  private static diffResource(oldRes: any, newRes: any) {
    let hasChanges = false;
    const result: any = {};

    if (oldRes.name !== newRes.name) {
      result.name = { old: oldRes.name, new: newRes.name };
      hasChanges = true;
    }
    if (oldRes.description !== newRes.description) {
      result.description = { old: oldRes.description, new: newRes.description };
      hasChanges = true;
    }
    if (oldRes.mimeType !== newRes.mimeType) {
      result.mimeType = { old: oldRes.mimeType, new: newRes.mimeType };
      hasChanges = true;
    }

    return hasChanges ? result : null;
  }

  private static diffResourceTemplate(oldTpl: any, newTpl: any) {
    let hasChanges = false;
    const result: any = {};

    if (oldTpl.name !== newTpl.name) {
      result.name = { old: oldTpl.name, new: newTpl.name };
      hasChanges = true;
    }
    if (oldTpl.description !== newTpl.description) {
      result.description = { old: oldTpl.description, new: newTpl.description };
      hasChanges = true;
    }
    if (oldTpl.mimeType !== newTpl.mimeType) {
      result.mimeType = { old: oldTpl.mimeType, new: newTpl.mimeType };
      hasChanges = true;
    }

    return hasChanges ? result : null;
  }

  private static diffPrompt(oldPrompt: any, newPrompt: any) {
    let hasChanges = false;
    const result: any = {};

    const oldDesc = oldPrompt.description;
    const newDesc = newPrompt.description;
    if (oldDesc !== newDesc) {
      result.description = { old: oldDesc, new: newDesc };
      hasChanges = true;
    }

    const oldArgs = (oldPrompt.arguments || []) as any[];
    const newArgs = (newPrompt.arguments || []) as any[];

    const argumentChanges: PromptArgumentChange[] = [];
    const oldArgMap = new Map(oldArgs.map((arg: any) => [arg.name as string, arg]));
    const newArgMap = new Map(newArgs.map((arg: any) => [arg.name as string, arg]));

    for (const [argName, newArg] of newArgMap) {
      const oldArg = oldArgMap.get(argName);
      if (!oldArg) {
        argumentChanges.push({ name: argName as string, type: "added" });
        hasChanges = true;
      } else {
        const descDiff = oldArg.description !== newArg.description ? { old: oldArg.description, new: newArg.description } : undefined;
        const reqDiff = oldArg.required !== newArg.required ? { old: oldArg.required, new: newArg.required } : undefined;

        if (descDiff || reqDiff) {
          argumentChanges.push({
            name: argName as string,
            type: "modified",
            description: descDiff,
            required: reqDiff
          });
          hasChanges = true;
        }
      }
    }

    for (const [argName] of oldArgMap) {
      if (!newArgMap.has(argName)) {
        argumentChanges.push({ name: argName as string, type: "removed" });
        hasChanges = true;
      }
    }

    argumentChanges.sort((a, b) => compareStrings(a.name, b.name));
    if (argumentChanges.length > 0) {
      result.arguments = argumentChanges;
    }

    return hasChanges ? result : null;
  }
}

function compareStrings(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}
