---
name: trifle-stats
description: Use when implementing time-series metrics, analytics tracking, or event counting with Trifle Stats. Covers Ruby (trifle-stats gem), Elixir (trifle_stats hex), and Go (trifle_stats_go module). Helps structure values payloads, configure drivers, and follow best practices for dimensional tracking.
user-invocable: true
argument-hint: "[ruby|elixir|go] [topic]"
---

# Trifle Stats - Time-Series Metrics Library

Trifle Stats tracks anything over time using your existing database. Available in Ruby, Elixir, and Go with identical storage format and cross-language data compatibility.

## Quick workflow

1. Choose runtime (Ruby, Elixir, Go) and driver.
2. Configure timezone, week start, and granularities.
3. Design metric keys before payload shape.
4. Track with numeric leaf values only.
5. Query values or series and validate paths.
6. Split keys when cardinality grows too high.

## Installation

**Ruby:**
```ruby
gem 'trifle-stats'
```

**Elixir:**
```elixir
{:trifle_stats, "~> 1.1"}
```

**Go:**
```bash
go get github.com/trifle-io/trifle_stats_go
```

## Configuration

**Ruby:**
```ruby
Trifle::Stats.configure do |config|
  config.driver = Trifle::Stats::Driver::Postgres.new(ActiveRecord::Base.connection)
  config.granularities = %w[10m 1h 1d 1w 1mo]
  config.time_zone = 'GMT'
  config.beginning_of_week = :monday
  config.buffer_enabled = true
  config.buffer_duration = 5
  config.buffer_size = 256
  config.buffer_aggregate = true
end
```

**Elixir:**
```elixir
Trifle.Stats.configure(
  driver: Trifle.Stats.Driver.Postgres.new(conn),
  time_zone: "UTC",
  track_granularities: [:hour, :day, :week, :month],
  beginning_of_week: :monday
)
```

**Go:**
```go
cfg := triflestats.DefaultConfig()
cfg.Driver = triflestats.NewSQLiteDriver(db, "trifle_stats", triflestats.JoinedFull)
cfg.Granularities = []string{"10m", "1h", "1d", "1w", "1mo"}
cfg.TimeZone = "GMT"
cfg.BufferEnabled = true
cfg.BufferDuration = 2 * time.Second
cfg.BufferSize = 256
cfg.BufferAggregate = true
```

**Available drivers:** PostgreSQL, MySQL, SQLite, Redis, MongoDB, Process (in-memory/testing).

**Available granularities:** `1s`, `1m`, `5m`, `10m`, `1h`, `6h`, `1d`, `1w`, `1mo`, `1q`, `1y`.

## Core API

### Track (increment values)

```ruby
# Ruby
Trifle::Stats.track(key: 'orders', at: Time.now, values: { count: 1, revenue: 4990 })
```
```elixir
# Elixir
Trifle.Stats.track("orders", DateTime.utc_now(), %{count: 1, revenue: 4990})
```
```go
// Go
triflestats.Track(cfg, "orders", time.Now(), map[string]any{"count": 1, "revenue": 4990})
```

### Assert (set absolute values / point-in-time snapshots)

```ruby
# Ruby
Trifle::Stats.assert(key: 'state::orders', at: Time.now, values: { pending: 42, shipped: 18 })
```
```elixir
# Elixir
Trifle.Stats.assert("state::orders", DateTime.utc_now(), %{pending: 42, shipped: 18})
```
```go
// Go
triflestats.Assert(cfg, "state::orders", time.Now(), map[string]any{"pending": 42, "shipped": 18})
```

### Values (query time-series data)

```ruby
# Ruby
result = Trifle::Stats.values(key: 'orders', from: 1.week.ago, to: Time.now, granularity: :day)
# Returns: { at: [Time, ...], values: [{count: 5, revenue: 24950}, ...] }
```
```elixir
# Elixir
result = Trifle.Stats.values("orders", from, to, :day, config)
# Returns: %{at: [...], values: [...]}
```
```go
// Go
result, err := triflestats.Values(cfg, "orders", from, to, "1d", false)
// result.At = []time.Time, result.Values = []map[string]any
```

### Beam / Scan (status tracking)

Use `beam` to record a latest-state snapshot and `scan` to read it back. Unlike `track`/`assert` which are time-bucketed, beam/scan gives you the most recent value.

```ruby
# Ruby
Trifle::Stats.beam(key: 'system_status', at: Time.now, values: { health: 'ok' })
Trifle::Stats.scan(key: 'system_status')
```
```elixir
# Elixir
Trifle.Stats.beam("system_status", DateTime.utc_now(), %{health: "ok"}, config)
Trifle.Stats.scan("system_status")
```
```go
// Go
triflestats.Beam(cfg, "system_status", time.Now(), map[string]any{"health": "ok"})
triflestats.Scan(cfg, "system_status")
```

### Series (post-processing)

```ruby
# Ruby
series = Trifle::Stats.series(key: 'orders', from: 1.week.ago, to: Time.now, granularity: :day)
series.transpond.standard_deviation(path: 'duration')
```
```elixir
# Elixir
Trifle.Stats.values("orders", from, to, :day, config)
|> Trifle.Stats.series()
|> Trifle.Stats.Series.transform_average("sum", "count", "avg")
|> Trifle.Stats.Series.aggregate_sum("count")
```

---

## Values Payload Best Practices

This is the most important part of using Trifle Stats effectively. The values payload is a nested hash/map where every leaf value must be numeric. How you structure it determines what you can query and how well it performs.

### Rule 1: Keep total keys under 500 per metric

Every unique path in your values hash becomes a key in the database. Performance starts degrading noticeably above ~500 keys per metric. If you're approaching this limit, split into separate metric keys.
**Bad - too many keys in one metric:**
```ruby
# If you have 200 stores x 50 providers = 10,000 keys
Trifle::Stats.track(
  key: 'orders',
  at: Time.now,
  values: {
    stores: {
      store_1: { provider_a: { count: 1 }, provider_b: { count: 1 } },
      store_2: { provider_a: { count: 1 } },
      # ... 200 stores x 50 providers = explosion
    }
  }
)
```

**Good - separate metric keys:**
```ruby
# Track per-store metrics separately
Trifle::Stats.track(
  key: "orders::store::#{store.id}",
  at: Time.now,
  values: { count: 1, revenue: 4990, providers: { amazon: { count: 1 } } }
)
```

### Rule 2: Track multiple dimensions as separate metric keys

When you need to slice data by different dimensions, use separate tracking calls with different keys rather than deeply nested single payloads. Prefer key splitting over deep nesting.

**Prefer this key structure:**
```
event::orders::all              # aggregated totals
event::orders::store::<slug>    # per-store breakdown
event::orders::provider::<name> # per-provider breakdown
```

**Over one giant payload with unbounded nesting:**
```
event::orders  →  { store -> provider -> country -> ... }
```

```ruby
# Track overall + by store as separate keys
['event::orders::all', "event::orders::store::#{store.slug}"].each do |key|
  Trifle::Stats.track(
    key: key,
    at: Time.now,
    values: {
      total: { count: 1, revenue: 4990, duration: duration_payload(elapsed) },
      providers: { amazon: { count: 1, revenue: 4990 } }
    }
  )
end
```

### Rule 3: Two-dimensional nesting is OK, three is not

Two levels of grouping (e.g., store -> provider AND provider -> store) is fine and useful. Adding a third dimension (store -> provider -> category) leads to key explosion.

**OK - two dimensions:**
```ruby
{
  total: { count: 1, revenue: 4990 },
  by_store: { store_42: { count: 1, revenue: 4990 } },
  by_provider: { amazon: { count: 1, revenue: 4990 } }
}
```

**Dangerous - three dimensions nested:**
```ruby
# DON'T DO THIS
{
  by_store: {
    store_42: {
      by_provider: {
        amazon: {
          by_category: { electronics: { count: 1 } }  # key explosion!
        }
      }
    }
  }
}
```

### Rule 4: Always track counts, especially in leaf nodes

Every grouping should have a `count` field. Without counts, you cannot calculate averages, rates, or standard deviations. Counts are the foundation of all derived metrics.

```ruby
{
  count: 1,                    # total count
  revenue: 4990,               # total revenue
  state: {
    success: 1,                # count of successes
    failure: 0                 # count of failures
  },
  codes: {
    'CODE_A' => 1,             # count per code
    'CODE_B' => 0
  }
}
```

### Rule 5: Duration tracking needs standard deviation support

When tracking durations (or any metric where you want averages and variance), always track three values: `count`, `sum`, and `square` (sum of squares). This enables the rapid standard deviation formula: `SD = sqrt(sum_of_squares/count - (sum/count)^2)`.

```ruby
def duration_payload(elapsed)
  {
    count: 1,
    sum: elapsed,
    square: elapsed**2
  }
end

Trifle::Stats.track(
  key: 'jobs::processing',
  at: Time.now,
  values: {
    count: 1,
    duration: duration_payload(125),  # 125 seconds
    margin: margin_payload(25.5)      # same pattern for any numeric distribution
  }
)
```

Then query and compute standard deviation:
```ruby
series = Trifle::Stats.series(key: 'jobs::processing', from: 1.week.ago, to: Time.now, granularity: :day)
series.transpond.standard_deviation(path: 'duration')
# Each time bucket now has: { duration: { count: N, sum: X, square: Y, sd: Z } }
```

### Rule 6: Use distribution buckets for value ranges

When you want to see how values distribute (price ranges, margin buckets), use designators to classify values into named buckets.

```ruby
def margin_payload(value)
  {
    count: 1,
    sum: value,
    square: value**2,
    distribution: {
      designator.designate(value: value) => 1  # e.g., "20-30" => 1
    }
  }
end
```

---

## Common Payload Patterns

### Simple event counting
```ruby
{ count: 1 }
```

### Event with state breakdown
```ruby
{ count: 1, state: { success: 1, failure: 0, limited: 0 } }
```

### Event with duration stats
```ruby
{ count: 1, duration: { count: 1, sum: 125, square: 15625 } }
```

### Multi-level grouping (two dimensions)
```ruby
{
  total: { count: 1, revenue: 4990, duration: { count: 1, sum: 3, square: 9 } },
  jobs: { 'InvoiceJob' => { count: 1, duration: { count: 1, sum: 3, square: 9 } } },
  resellers: { 'reseller_42' => { count: 1 } }
}
```

### State snapshot (with assert)
```ruby
# Use assert for point-in-time state, not track
stats = Order.group(:state).count  # { "pending" => 42, "shipped" => 18 }
Trifle::Stats.assert(key: 'state::orders', at: Time.now, values: stats)
```

---

## Querying Tips

- Use `skip_blanks: true` to omit empty time buckets in sparse data
- Choose granularity based on query range: hours for daily views, days for weekly/monthly
- Use the Series API for post-processing: averages, ratios, standard deviations
- All three language implementations produce identical storage format - write in Ruby, read in Go

---

## Validate Quality

When reviewing or auditing metric implementations, check:

- Top-level and leaf counters reconcile (sum of children equals parent count).
- High-cardinality branches are split into separate metric keys.
- Duration and numeric distribution paths include `count`/`sum`/`square`.
- Queried value paths match the actual stored nesting structure.
- `skip_blanks` choice matches charting intent (sparse vs continuous).

---

## Read Deeper Docs on Demand

For the full API reference, read the documentation at https://docs.trifle.io or, if this repository is available locally, read:

- `docs-trifle-io/docs/trifle-stats-rb/` (Ruby)
- `docs-trifle-io/docs/trifle-stats-ex/` (Elixir)
- `docs-trifle-io/docs/trifle-stats-go/` (Go)
- `docs-trifle-io/docs/trifle-stats-rb/transponders/standard_deviation.md`
- `docs-trifle-io/docs/trifle-stats-rb/guides/average.md`
