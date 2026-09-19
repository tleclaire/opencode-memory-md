// OpenCode v1 entrypoint.
//
// The `memory` tool metadata, the handlers and the runtime wiring live in
// src/memoryTool.ts so the v2 entrypoint (src/v2.ts) can reuse them unchanged.
//
// The default export carries both entrypoints, which OpenCode supports from
// 1.18.29 onwards: v1 calls `server()`, v2 calls `setup()`. That lets the fork
// run on v1 today while the v2 half is already in place.

import type { Plugin, PluginInput, PluginModule } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin";
import {
  createMemoryRuntime,
  DAILY_LOG_REMINDER,
  MEMORY_TOOL_DESCRIPTION,
  type MemoryToolArgs,
} from "./memoryTool.js";
import { V2Plugin } from "./v2.js";

export const MemoryPlugin: Plugin = async (ctx: PluginInput) => {
  const runtime = createMemoryRuntime();

  return {
    event: async ({ event }) => {
      const sessionID = (event as any).sessionID || (event as any).session_id;

      if (event.type === "session.created" && sessionID) {
        runtime.noteSessionCreated(sessionID);
      }

      if (event.type === "session.deleted" && sessionID) {
        runtime.noteSessionDeleted(sessionID);
      }

      if (
        event.type === "session.idle" &&
        sessionID &&
        runtime.shouldRemindDailyUpdate(sessionID)
      ) {
        await ctx.client.tui.showToast({
          body: {
            message: DAILY_LOG_REMINDER,
            variant: "info",
          },
        });
      }
    },

    "tool.execute.after": async (input) => {
      if (input.tool !== "memory") return;
      runtime.noteMemoryOperation(
        input.sessionID,
        input.args as MemoryToolArgs,
      );
    },

    "experimental.chat.system.transform": async (_input, output) => {
      const memoryContext = runtime.buildContext();
      if (!memoryContext) return;
      const instructions = runtime.getMemoryInstructions();
      output.system.push(memoryContext + instructions);
    },

    tool: {
      memory: tool({
        description: MEMORY_TOOL_DESCRIPTION,
        args: {
          action: tool.schema
            .enum(["read", "write", "edit", "delete", "search", "list"])
            .describe("Action to perform"),
          target: tool.schema
            .enum(["memory", "identity", "user", "daily"])
            .optional()
            .describe("Target file: memory, identity, user, or daily"),
          content: tool.schema
            .string()
            .optional()
            .describe("Content to write (for write action)"),
          mode: tool.schema
            .enum(["append", "overwrite"])
            .optional()
            .describe("Write mode (default: append)"),
          date: tool.schema
            .string()
            .optional()
            .describe(
              "Date (YYYY-MM-DD) or timestamp (YYYY-MM-DD HH:MM:SS) for daily target",
            ),
          query: tool.schema
            .string()
            .optional()
            .describe("Search query (for search action)"),
          max_results: tool.schema
            .number()
            .optional()
            .describe("Max search results (default: 20)"),
          oldString: tool.schema
            .string()
            .optional()
            .describe(
              "Text to replace (for edit action). Must read file first to get exact text.",
            ),
          newString: tool.schema
            .string()
            .optional()
            .describe("Replacement text (for edit action)"),
          timestamp: tool.schema
            .string()
            .optional()
            .describe(
              "Timestamp to delete (YYYY-MM-DD or YYYY-MM-DD HH:MM:SS). For delete action only.",
            ),
          period: tool.schema
            .string()
            .optional()
            .describe(
              "Filter by period: YYYY-MM (month) or YYYY (year). For list and search actions.",
            ),
        },
        async execute(args) {
          return runtime.execute(args as MemoryToolArgs);
        },
      }),
    },
  };
};

const v1Module: PluginModule = { id: "memory-md", server: MemoryPlugin };

export default { ...V2Plugin, ...v1Module };
