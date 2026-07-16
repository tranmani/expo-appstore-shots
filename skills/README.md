# skills/

One agent-loadable skill ships in this package:

- **[`expo-appstore-shots/SKILL.md`](expo-appstore-shots/SKILL.md)** — the same
  procedure as the repo's [AGENTS.md](../AGENTS.md), distilled into a skill an AI
  coding agent can auto-discover and load. AGENTS.md stays the authority; the skill
  points back to it.

It has YAML frontmatter (`name`, `description`) compatible with Claude Code skills,
so most agents that consume skills or context files can pick it up. Nothing here
adds a dependency or touches the app's runtime.

## Installing it per agent

- **Claude Code** — copy or symlink the skill directory into your project's (or
  user's) skills folder, then restart the session:

  ```bash
  mkdir -p .claude/skills
  ln -s "$(pwd)/node_modules/expo-appstore-shots/skills/expo-appstore-shots" \
        .claude/skills/expo-appstore-shots
  # or copy it: cp -r node_modules/.../skills/expo-appstore-shots .claude/skills/
  ```

  Claude Code loads `.claude/skills/<name>/SKILL.md`.

- **Gemini CLI** — reference the skill from your `GEMINI.md`, e.g. a line pointing
  the agent at `node_modules/expo-appstore-shots/skills/expo-appstore-shots/SKILL.md`
  (or the copied path).

- **OpenAI Codex / GPT and other AGENTS.md-aware agents** — nothing to install: they
  already read [AGENTS.md](../AGENTS.md), which points here. The full procedure is
  right there.

When in doubt, just point the agent at `SKILL.md` (or AGENTS.md) directly — the file
is self-contained.
