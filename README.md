# @tleclaire/opencode-memory-md

Markdown-based memory plugin for OpenCode — **fork** of
[@zhafron/opencode-memory-md](https://github.com/tickernelz/opencode-memory-md)
(upstream) adding an **OpenCode v2 plugin entrypoint**. The v2 half was written
against `@opencode/plugin` 2.0.9; the same build still runs unchanged on
OpenCode v1.

## Installation

Add to your OpenCode configuration at `~/.config/opencode/opencode.json`.

Upstream package, v1 only:

```json
{
  "plugin": ["@zhafron/opencode-memory-md"]
}
```

This fork from a local checkout (runs on v1 today, on v2 once OpenCode 2.x is in
use). Build it first with `bun install && bun run build`:

```json
{
  "plugin": ["/absolute/path/to/opencode-memory-md/dist/index.js"]
}
```

## OpenCode v2 entrypoint

`dist/index.js` carries both entrypoints in its default export:

```js
export default { ...V2Plugin, ...v1Module }; // { id, setup, server }
```

OpenCode 1.18.29+ calls `server()` (v1 hooks); OpenCode 2.x calls `setup(ctx)`
(v2 domains). Both build the same runtime from `src/memoryTool.ts`, so the tool,
its handlers and the memory files behave identically on either version.

Hook mapping in `src/v2.ts`:

| v1 | v2 |
|----|----|
| `tool` map + `tool()` helper | `ctx.tool.transform(editor => editor.add(...))` |
| `tool.execute.after` | `ctx.tool.hook("execute.after", ...)` |
| `experimental.chat.system.transform` | `ctx.session.hook("context", ...)` |
| `event` hook | `ctx.event.subscribe({ signal })` |
| `ctx.client.tui.showToast` | no equivalent in the v2 plugin context (logged to stderr) |

The v2 module is imported **type-only** so the v2 runtime never loads in a v1
process; `@opencode/plugin` is a devDependency for that reason.

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
