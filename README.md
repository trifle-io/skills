# Trifle Skills

Agent skills for the [Trifle](https://trifle.io) ecosystem. Teach AI coding agents how to use Trifle Stats, Trifle Traces, and Trifle CLI effectively with best practices, payload structure guidelines, and real-world patterns.

Part of the [Trifle](https://trifle.io) ecosystem.

## Skills

| Skill | What it teaches |
|-------|----------------|
| **[trifle-stats](trifle-stats/skills/trifle-stats/SKILL.md)** | Time-series metrics in Ruby, Elixir, and Go. Values payload structure, dimensional tracking, duration with standard deviation, key splitting strategies. |
| **[trifle-traces](trifle-traces/skills/trifle-traces/SKILL.md)** | Structured execution tracing in Ruby. How to trace conditions, API calls, loops, and objects so the full execution flow is readable. |
| **[trifle-cli](trifle-cli/skills/trifle-cli/SKILL.md)** | Command-line metrics with local SQLite storage. Agent analytics workflows, push/query patterns, MCP server mode. |

## Install

### npx (recommended)

Install all Trifle skills with npm/npx:

```sh
npx -y @trifle/skills install codex
```

Project-local agents use the current directory by default:

```sh
npx -y @trifle/skills install claude
npx -y @trifle/skills install cursor
npx -y @trifle/skills install windsurf
npx -y @trifle/skills install cline
```

Install a single skill with `--skill`:

```sh
npx -y @trifle/skills install codex --skill trifle-stats
```

Use `--dir` to install into a different project root. For Codex, `--dir` overrides `$CODEX_HOME`.

```sh
npx -y @trifle/skills install claude --dir /path/to/project
npx -y @trifle/skills install codex --dir /path/to/codex-home
```

The installer refuses to overwrite changed files. Re-run with `--force` when you want to replace an existing install:

```sh
npx -y @trifle/skills install codex --force
```

After installing, restart Codex to pick up new skills.

### Claude Code marketplace

Add this repo as a marketplace source and install skills:

```sh
/plugin marketplace add trifle-io/skills
/plugin install trifle-stats@trifle-io/skills
/plugin install trifle-traces@trifle-io/skills
/plugin install trifle-cli@trifle-io/skills
```

### Manual install

#### Claude Code

Copy skill directories into your project:

```sh
mkdir -p .claude/skills
cp -r trifle-stats/skills/trifle-stats .claude/skills/
cp -r trifle-traces/skills/trifle-traces .claude/skills/
cp -r trifle-cli/skills/trifle-cli .claude/skills/
```

#### OpenAI Codex

Install skills into your Codex skills directory (`$CODEX_HOME/skills`, defaults to `~/.codex/skills`).

```sh
CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
mkdir -p "$CODEX_HOME/skills"
cp -R trifle-stats/skills/trifle-stats "$CODEX_HOME/skills/trifle-stats"
cp -R trifle-traces/skills/trifle-traces "$CODEX_HOME/skills/trifle-traces"
cp -R trifle-cli/skills/trifle-cli "$CODEX_HOME/skills/trifle-cli"
```

Or install from GitHub inside Codex via `$skill-installer`:

```text
$skill-installer install https://github.com/trifle-io/skills/tree/main/skills/trifle-stats
$skill-installer install https://github.com/trifle-io/skills/tree/main/skills/trifle-traces
$skill-installer install https://github.com/trifle-io/skills/tree/main/skills/trifle-cli
```

After installing, restart Codex to pick up new skills.

#### Cursor

Copy skill content into `.cursor/rules/`:

```sh
mkdir -p .cursor/rules
cp trifle-stats/skills/trifle-stats/SKILL.md .cursor/rules/trifle-stats.mdc
cp trifle-traces/skills/trifle-traces/SKILL.md .cursor/rules/trifle-traces.mdc
cp trifle-cli/skills/trifle-cli/SKILL.md .cursor/rules/trifle-cli.mdc
```

#### Windsurf

Copy skill content into `.windsurf/rules/` or append to `.windsurfrules`:

```sh
mkdir -p .windsurf/rules
cp trifle-stats/skills/trifle-stats/SKILL.md .windsurf/rules/trifle-stats.md
cp trifle-traces/skills/trifle-traces/SKILL.md .windsurf/rules/trifle-traces.md
cp trifle-cli/skills/trifle-cli/SKILL.md .windsurf/rules/trifle-cli.md
```

#### Cline

Copy skill directories into `.cline/skills/`:

```sh
mkdir -p .cline/skills
cp -r trifle-stats/skills/trifle-stats .cline/skills/
cp -r trifle-traces/skills/trifle-traces .cline/skills/
cp -r trifle-cli/skills/trifle-cli .cline/skills/
```

#### Any other agent

These skills follow the [Agent Skills](https://agentskills.io) open standard. Each skill is a `SKILL.md` file with YAML frontmatter and markdown instructions. Copy the content into whatever custom instructions mechanism your agent supports.

## Documentation

Full Trifle documentation at **[docs.trifle.io](https://docs.trifle.io)**

## Trifle Ecosystem

| Component | What it does |
|-----------|-------------|
| **[Trifle App](https://trifle.io/product/app)** | Dashboards, alerts, scheduled reports, AI-powered chat. Cloud or self-hosted. |
| **[Trifle CLI](https://github.com/trifle-io/trifle-cli)** | Query and push metrics from the terminal. MCP server mode for AI agents. |
| **[Trifle::Stats (Ruby)](https://github.com/trifle-io/trifle-stats)** | Time-series metrics library for Ruby. |
| **[Trifle.Stats (Elixir)](https://github.com/trifle-io/trifle_stats)** | Time-series metrics library for Elixir. |
| **[Trifle Stats (Go)](https://github.com/trifle-io/trifle_stats_go)** | Time-series metrics library for Go. |
| **[Trifle::Traces](https://github.com/trifle-io/trifle-traces)** | Structured execution tracing for background jobs. |

## Contributing

Bug reports and pull requests are welcome on GitHub at https://github.com/trifle-io/skills.

## License

Available under the [MIT License](https://opensource.org/licenses/MIT).
