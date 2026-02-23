---
name: trifle-cli
description: Use when running Trifle CLI commands for metrics tracking, querying analytics, or building local analytics pipelines. Helps agents use trifle CLI with SQLite for local metric collection during task execution, and query results for inspection.
user-invocable: true
argument-hint: "[command|topic]"
---

# Trifle CLI - Command-Line Metrics Tool

Trifle CLI lets you push and query time-series metrics from the command line. It works with local databases (SQLite, PostgreSQL, MySQL, Redis, MongoDB) or the Trifle App API. It is especially powerful for AI agents that need to collect and analyze structured metrics during task execution.

## Installation

```bash
# Homebrew
brew install trifle-io/trifle/trifle

# Shell script
curl -sSL https://get.trifle.io | sh

# Go
go install github.com/trifle-io/trifle-cli@latest
```

## Primary Goal

Combine good Stats payload design with fast local iteration:

1. Track consistently.
2. Store locally.
3. Inspect quickly.
4. Refine key and payload structure.

## Quick Start: Local SQLite Setup

The fastest way to start collecting metrics locally:

```bash
# 1. Create the database
trifle metrics setup --driver sqlite --db ./stats.db

# 2. Push a metric
trifle metrics push --driver sqlite --db ./stats.db \
  --key event::signup --values '{"count": 1}'

# 3. Query metrics
trifle metrics get --driver sqlite --db ./stats.db \
  --key event::signup --granularity 1h
```

## Configuration

### Config file (recommended for repeated use)

Default paths:
- macOS: `~/Library/Application Support/trifle/config.yaml`
- Linux: `~/.config/trifle/config.yaml`

```yaml
source: sqlite

sqlite:
  driver: sqlite
  db: ./stats.db
  table: trifle_stats
  joined: full
  separator: "::"
  timezone: GMT
  week_start: monday
  granularities: [1m, 1h, 1d, 1w, 1mo]
  buffer_mode: on
  buffer_duration: 2s
  buffer_size: 500
  buffer_aggregate: true
```

### Environment variables

```bash
export TRIFLE_DRIVER=sqlite
export TRIFLE_DB=./stats.db
export TRIFLE_GRANULARITIES=1h,1d,1w,1mo
export TRIFLE_TIMEZONE=GMT
```

### Precedence

Flags > environment variables > config file > defaults.

## All Commands

### metrics setup

Creates the database table. Required once per database.

```bash
trifle metrics setup --driver sqlite --db ./stats.db
trifle metrics setup --driver postgres --dsn "postgres://user:pass@localhost:5432/myapp"
trifle metrics setup --driver mysql --host 127.0.0.1 --port 3306 --user root --database myapp
trifle metrics setup --driver mongo --dsn mongodb://127.0.0.1:27017 --database myapp
```

### metrics push

Track or assert a metric value.

```bash
# Track (increment) - default mode
trifle metrics push --driver sqlite --db ./stats.db \
  --key event::task_completed --values '{"count": 1, "duration": {"count": 1, "sum": 45, "square": 2025}}'

# Assert (set absolute value)
trifle metrics push --driver sqlite --db ./stats.db \
  --mode assert --key state::queue --values '{"pending": 12, "processing": 3}'

# From file
trifle metrics push --driver sqlite --db ./stats.db \
  --key event::analysis --values-file ./payload.json

# With timestamp
trifle metrics push --driver sqlite --db ./stats.db \
  --key event::deploy --at 2026-02-21T14:30:00Z --values '{"count": 1}'
```

### metrics get

Fetch raw time-series data.

```bash
trifle metrics get --driver sqlite --db ./stats.db \
  --key event::task_completed \
  --from 2026-02-20T00:00:00Z --to 2026-02-21T00:00:00Z \
  --granularity 1h

# Skip empty time buckets
trifle metrics get --driver sqlite --db ./stats.db \
  --key event::task_completed --granularity 1h --skip-blanks
```

If `--from` and `--to` are omitted, defaults to last 24 hours.

### metrics keys

List all tracked metric keys.

```bash
trifle metrics keys --driver sqlite --db ./stats.db --granularity 1h
trifle metrics keys --driver sqlite --db ./stats.db --format table
```

### metrics aggregate

Aggregate values over a time range.

```bash
# Sum of counts
trifle metrics aggregate --driver sqlite --db ./stats.db \
  --key event::task_completed --value-path count --aggregator sum \
  --from 2026-02-20T00:00:00Z --to 2026-02-21T00:00:00Z --granularity 1h

# Available aggregators: sum, mean, min, max
```

### metrics timeline

Format data for time-series visualization.

```bash
trifle metrics timeline --driver sqlite --db ./stats.db \
  --key event::task_completed --value-path duration.sum \
  --from 2026-02-20T00:00:00Z --to 2026-02-21T00:00:00Z --granularity 1h
```

### metrics category

Format data for categorical breakdown.

```bash
trifle metrics category --driver sqlite --db ./stats.db \
  --key event::task_completed --value-path status \
  --from 2026-02-20T00:00:00Z --to 2026-02-21T00:00:00Z --granularity 1h
```

### Output formats

All query commands support `--format json` (default), `--format table`, and `--format csv`.

---

## Agent Analytics Workflow

This is the primary use case for agents: collect structured metrics during task execution, then query them for analysis. Combine Trifle Stats methodology (structured value payloads) with CLI execution and SQLite storage.

### Step 1: Set up the database

```bash
trifle metrics setup --driver sqlite --db ./analytics.db
```

### Step 2: Design your metric keys and payloads

Follow the Trifle Stats payload best practices:

**Keep keys hierarchical and descriptive:**
```
agent::task::file_processing
agent::task::api_calls
agent::errors
```

**Track counts at every level:**
```json
{"count": 1, "status": {"success": 1, "failure": 0}}
```

**Track durations with standard deviation support:**
```json
{
  "count": 1,
  "duration": {"count": 1, "sum": 45, "square": 2025}
}
```

**Use two-dimensional grouping (not three):**
```json
{
  "total": {"count": 1, "tokens": 1500},
  "by_model": {"gpt4": {"count": 1, "tokens": 1500}},
  "by_task": {"summarize": {"count": 1, "tokens": 1500}}
}
```

### Step 3: Track metrics during execution

```bash
# Track a completed task
trifle metrics push --driver sqlite --db ./analytics.db \
  --key agent::task::analysis \
  --values '{"count": 1, "duration": {"count": 1, "sum": 120, "square": 14400}, "status": {"success": 1}}'

# Track an API call with token usage
trifle metrics push --driver sqlite --db ./analytics.db \
  --key agent::api_calls \
  --values '{"count": 1, "tokens": {"count": 1, "sum": 1500, "square": 2250000}, "by_model": {"claude": {"count": 1, "tokens": 1500}}}'

# Track an error
trifle metrics push --driver sqlite --db ./analytics.db \
  --key agent::errors \
  --values '{"count": 1, "by_type": {"timeout": 1}}'

# Snapshot current state
trifle metrics push --driver sqlite --db ./analytics.db \
  --mode assert --key agent::state::queue \
  --values '{"pending": 5, "in_progress": 2, "completed": 42}'
```

### Step 4: Query and analyze results

```bash
# See all tracked metrics
trifle metrics keys --driver sqlite --db ./analytics.db --format table

# Get task completion data (last 24h by hour)
trifle metrics get --driver sqlite --db ./analytics.db \
  --key agent::task::analysis --granularity 1h --skip-blanks

# Get total task count
trifle metrics aggregate --driver sqlite --db ./analytics.db \
  --key agent::task::analysis --value-path count --aggregator sum \
  --granularity 1h

# Get average duration
trifle metrics aggregate --driver sqlite --db ./analytics.db \
  --key agent::task::analysis --value-path duration.sum --aggregator sum \
  --granularity 1h
# Divide duration.sum by duration.count for average

# See error breakdown by category
trifle metrics category --driver sqlite --db ./analytics.db \
  --key agent::errors --value-path by_type --granularity 1h

# Timeline of API token usage
trifle metrics timeline --driver sqlite --db ./analytics.db \
  --key agent::api_calls --value-path tokens.sum --granularity 1h
```

### Step 5: Iterate on structure

The analytics loop is iterative:

1. Define key plan before writing data.
2. Push events with numeric-only payload leaves.
3. Inspect keys and series.
4. Run aggregate and formatter commands.
5. Adjust key split and payload shape; repeat.

Create deterministic sample payloads (`--values` or `--values-file`), push from scripts and jobs under test, read back with `metrics get`, summarize with `aggregate`/`timeline`/`category`, and keep outputs in JSON for diff-based iteration.

### Step 6: Compute derived metrics

Standard deviation from tracked data:
```
mean = duration.sum / duration.count
variance = (duration.square / duration.count) - mean^2
stddev = sqrt(variance)
```

Success rate:
```
success_rate = status.success / count
```

---

## Practical Examples

### Track file processing pipeline

```bash
# Each file processed
trifle metrics push --driver sqlite --db ./analytics.db \
  --key pipeline::files \
  --values '{"count": 1, "lines": {"count": 1, "sum": 450, "square": 202500}, "by_type": {"ruby": 1}}'

# Query results
trifle metrics category --driver sqlite --db ./analytics.db \
  --key pipeline::files --value-path by_type --granularity 1d
```

### Track test execution

```bash
# Each test run
trifle metrics push --driver sqlite --db ./analytics.db \
  --key tests::run \
  --values '{"count": 1, "passed": 42, "failed": 2, "duration": {"count": 1, "sum": 15, "square": 225}}'

# Aggregate pass/fail over time
trifle metrics aggregate --driver sqlite --db ./analytics.db \
  --key tests::run --value-path passed --aggregator sum --granularity 1d
```

### Track multi-step workflow

```bash
# Step 1
trifle metrics push --driver sqlite --db ./analytics.db \
  --key workflow::step \
  --values '{"count": 1, "by_step": {"fetch_data": {"count": 1, "duration": {"count": 1, "sum": 5, "square": 25}}}}'

# Step 2
trifle metrics push --driver sqlite --db ./analytics.db \
  --key workflow::step \
  --values '{"count": 1, "by_step": {"transform": {"count": 1, "duration": {"count": 1, "sum": 12, "square": 144}}}}'

# See time spent per step
trifle metrics category --driver sqlite --db ./analytics.db \
  --key workflow::step --value-path by_step --granularity 1h
```

---

## MCP Server Mode

For AI agents that support MCP (Model Context Protocol):

```bash
# Start MCP server with local SQLite
TRIFLE_DRIVER=sqlite TRIFLE_DB=./analytics.db trifle mcp

# Start MCP server with Trifle App API
TRIFLE_URL=https://app.trifle.io TRIFLE_TOKEN=<TOKEN> trifle mcp
```

**Claude Desktop config:**
```json
{
  "mcpServers": {
    "trifle": {
      "command": "trifle",
      "args": ["mcp"],
      "env": {
        "TRIFLE_DRIVER": "sqlite",
        "TRIFLE_DB": "./analytics.db"
      }
    }
  }
}
```

**Available MCP tools:** `list_metrics`, `fetch_series`, `aggregate_series`, `format_timeline`, `format_category`, `write_metric`.

---

## Key Payload Rules (from Trifle Stats methodology)

1. **Under 500 keys per metric** - split into separate metric keys if approaching this
2. **Counts in every leaf** - always include `count: 1` so you can compute rates and averages
3. **Duration/numeric distributions** - use `{count: 1, sum: N, square: N*N}` for stddev support
4. **Two dimensions max** - `by_store` + `by_provider` is OK; adding `by_category` inside is not
5. **All leaf values must be numeric** - no strings in the values payload
6. **Use assert for state snapshots** - `--mode assert` replaces values instead of incrementing

---

## Operational Notes

- If `--from` and `--to` are omitted, CLI defaults to last 24 hours.
- Local drivers support: `metrics push/get/keys/aggregate/timeline/category/setup`.
- Buffering defaults to on for `sqlite`/`postgres`/`mysql` when using `--buffer-mode auto`.
- Use `--buffer-mode off` for strict write-through behavior in deterministic tests.
- `--from` and `--to` must be RFC3339 format and provided together.
- Value paths (`--value-path`) must be single dot-separated paths (no wildcards).

---

## Read Deeper Docs on Demand

For the full reference, visit https://docs.trifle.io or, if this repository is available locally, read:

- `docs-trifle-io/docs/trifle-cli/`
- `docs-trifle-io/docs/trifle-cli/configuration.md`
- `docs-trifle-io/docs/trifle-cli/usage.md`
- `docs-trifle-io/docs/trifle-cli/mcp.md`
