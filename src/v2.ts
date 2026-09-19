// OpenCode v2 entrypoint.
//
// Mirrors the behaviour of the v1 entrypoint (src/index.ts) on the v2 plugin
// API. The v1 and v2 implementations share one runtime (src/memoryTool.ts); only
// the hook glue differs:
//
//   v1                                       v2
//   tool map + tool() helper            ->   ctx.tool.transform(editor => editor.add(...))
//   "tool.execute.after"                ->   ctx.tool.hook("execute.after", ...)
//   "experimental.chat.system.transform"->   ctx.session.hook("context", ...)
//   event hook                          ->   ctx.event.subscribe({ signal })
//   ctx.client.tui.showToast            ->   not available in the v2 plugin
//                                            context; logged to stderr instead
//
// Type-only imports: this module must not pull the v2 runtime into a v1 process.

import type { Plugin as V2Api } from "@opencode/plugin";
import {
  createMemoryRuntime,
  DAILY_LOG_REMINDER,
  MEMORY_TOOL_DESCRIPTION,
  MEMORY_TOOL_JSON_SCHEMA,
  type MemoryToolArgs,
} from "./memoryTool.js";

const PLUGIN_ID = "memory-md";

export const V2Plugin: V2Api.Plugin = {
  id: PLUGIN_ID,

  async setup(ctx: V2Api.Context) {
    const runtime = createMemoryRuntime();

    // --- custom tool ---------------------------------------------------------
    await ctx.tool.transform((editor) => {
      editor.add({
        name: "memory",
        description: MEMORY_TOOL_DESCRIPTION,
        input: MEMORY_TOOL_JSON_SCHEMA,
        async execute(input: unknown) {
          return { content: await runtime.execute(input as MemoryToolArgs) };
        },
      });
    });

    // --- system prompt context (replaces experimental.chat.system.transform) --
    await ctx.session.hook("context", (event) => {
      const memoryContext = runtime.buildContext();
      if (!memoryContext) return;
      event.system.push({
        type: "text",
        text: memoryContext + runtime.getMemoryInstructions(),
      });
    });

    // --- observe memory tool calls -------------------------------------------
    await ctx.tool.hook("execute.after", (event) => {
      if (event.tool !== "memory") return;
      runtime.noteMemoryOperation(
        String(event.sessionID),
        event.input as MemoryToolArgs,
      );
    });

    // --- session lifecycle ---------------------------------------------------
    const controller = new AbortController();

    void (async () => {
      try {
        for await (const event of ctx.event.subscribe({
          signal: controller.signal,
        })) {
          const payload = event as unknown as {
            type?: string;
            sessionID?: string;
            session_id?: string;
          };
          const sessionID = payload.sessionID || payload.session_id;

          if (payload.type === "session.created" && sessionID) {
            runtime.noteSessionCreated(sessionID);
          }

          if (payload.type === "session.deleted" && sessionID) {
            runtime.noteSessionDeleted(sessionID);
          }

          if (payload.type === "session.idle" && sessionID) {
            if (runtime.shouldRemindDailyUpdate(sessionID)) {
              // v1 showed a TUI toast here. The v2 plugin context exposes no
              // toast API (TUI extensions are a separate surface), so the nudge
              // goes to the process log instead.
              console.error(`[${PLUGIN_ID}] ${DAILY_LOG_REMINDER}`);
            }
          }
        }
      } catch {
        // Subscription aborted on plugin unload, or the event stream ended.
      }
    })();

    return () => controller.abort();
  },
};

export default V2Plugin;
