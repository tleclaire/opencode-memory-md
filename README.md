# @zhafron/opencode-memory-md

Simple markdown-based memory plugin for OpenCode.

## Installation

Add to your OpenCode configuration at `~/.config/opencode/opencode.json`:

```json
{
  "plugin": ["@zhafron/opencode-memory-md"]
}
```

## OpenCode v2

OpenCode v2 (`2.0.x`) replaces the v1 plugin API, so the default export carries
both entrypoints:

- **v1** (OpenCode >= 1.18.29) calls `server()` — the existing hooks, unchanged.
- **v2** calls `setup()` from `@opencode/plugin`: the `memory` tool is
  registered through `ctx.tool.transform()`, the context injection through
  `ctx.session.hook("context")`, and the daily-log reminder through
  `ctx.tool.hook("execute.after")`.

```ts
// src/index.ts
export default { ...V2Plugin, ...{ id: "memory-md", server: MemoryPlugin } };
```

The install line is the same for both versions. OpenCode older than 1.18.29 does
not understand the object entrypoint — use a release from before the v2
entrypoint landed there.

| v1 hook | v2 equivalent |
|---------|---------------|
| `tool: { memory: tool({ ... }) }` | `ctx.tool.transform(e => e.add({ name, description, input, execute }))` |
| `"tool.execute.after"` | `ctx.tool.hook("execute.after", ...)` |
| `"experimental.chat.system.transform"` | `ctx.session.hook("context", ...)` |
| `event` | `ctx.event.subscribe(...)` |
| `ctx.client.tui.showToast` | not part of the plugin context in v2 (the tui is a separate package) — falls back to the log |

## Memory Files

| File | Purpose |
|------|---------|
| `MEMORY.md` | Long-term memory (crucial facts, decisions, preferences) |
| `IDENTITY.md` | AI identity (name, persona, behavioral rules) |
| `USER.md` | User profile (name, preferences, context) |
| `daily/YYYY-MM-DD.md` | Daily logs (day-to-day activities) |
| `BOOTSTRAP.md` | First run setup instructions (deleted after setup) |

## Storage Location

- **macOS/Linux**: `~/.config/opencode/memory/`
- **Windows**: `%APPDATA%/opencode/memory/`

## Tool: memory

**Actions:**

| Action | Description | Parameters |
|--------|-------------|------------|
| `read` | Read memory file | `target`: memory, identity, user, daily |
| `write` | Write to memory file | `target`, `content`, `mode`: append/overwrite |
| `edit` | Edit specific part of file (not daily) | `target`, `oldString`, `newString` |
| `search` | Search memory files | `query`, `max_results` (optional) |
| `list` | List all files | - |

**Examples:**

```bash
memory --action read --target memory
memory --action write --target memory --content "Remember to use PostgreSQL for all projects"
memory --action write --target identity --content "- **Name**: Jarvis" --mode overwrite
memory --action write --target daily --content "Fixed critical bug in auth module"
memory --action edit --target memory --oldString "Project: Auth Service" --newString "Project: Payment Service"
memory --action search --query "PostgreSQL"
memory --action list
```

## First Run Flow

**Important:** First setup must be done in OpenCode **build mode** (not plan mode). AI cannot write files in plan mode.

1. Plugin detects no MEMORY.md exists
2. Creates BOOTSTRAP.md with setup instructions
3. AI reads BOOTSTRAP.md and asks user questions interactively
4. AI writes to MEMORY.md, IDENTITY.md, USER.md
5. AI deletes BOOTSTRAP.md
6. Setup complete

## Context Injection

MEMORY.md, IDENTITY.md, and USER.md are automatically injected into the system prompt at session start.

Daily logs must be accessed via the `memory` tool.

## License

MIT
