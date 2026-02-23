---
name: trifle-traces
description: Use when implementing execution tracing, structured logging, or debugging instrumentation with Trifle Traces (Ruby). Helps trace execution flow, conditions, API calls, and object state for full observability of background jobs and services.
user-invocable: true
argument-hint: "[topic]"
---

# Trifle Traces - Structured Execution Tracing

Trifle Traces captures the complete flow of execution in your Ruby code. When you open a trace, you should be able to read exactly what happened, what decisions were made, and why - like reading a story of the execution.

## Quick workflow

1. Configure callbacks (`liftoff`, `bump`, `wrapup`) and serializer.
2. Create one tracer per request or job.
3. Trace each major step with explicit phase headers.
4. Trace every important condition and its return value.
5. Trace valuable objects and external I/O with block traces.
6. Set final state (`fail!`, `warn!`, success) and call `wrapup`.

## Installation

```ruby
gem 'trifle-traces'
```

## Configuration

```ruby
Trifle::Traces.configure do |config|
  config.tracer_class = Trifle::Traces::Tracer::Hash
  config.serializer_class = Trifle::Traces::Serializer::Json  # or Inspect, String
  config.bump_every = 5  # seconds between bump callbacks

  config.on(:liftoff) do |tracer|
    # Called when tracer starts. Return value becomes tracer.reference.
    entry = TraceEntry.create(key: tracer.key, state: tracer.state)
    entry.id
  end

  config.on(:bump) do |tracer|
    # Called periodically during execution. Use for live updates.
    entry = TraceEntry.find_by(id: tracer.reference)
    entry&.update(data: tracer.data, state: tracer.state, tags: tracer.tags)
  end

  config.on(:wrapup) do |tracer|
    # Called when trace completes. Final persistence.
    next if tracer.ignore
    entry = TraceEntry.find_by(id: tracer.reference)
    entry&.update(data: tracer.data, state: tracer.state, tags: tracer.tags)
  end
end
```

## Core API

### trace(message, state:, head:) { block }

The main method. Records a message with optional block capture.

```ruby
# Simple message
Trifle::Traces.trace('Starting sync')

# With state
Trifle::Traces.trace('Gateway timeout', state: :error)
Trifle::Traces.trace('Retrying with fallback', state: :warning)

# Header (marks a logical section)
Trifle::Traces.trace('Phase 1: Fetch data', head: true)

# With block - captures return value and increases nesting level
result = Trifle::Traces.trace('Fetching orders') do
  api.fetch_orders(limit: 100)
end
# The block return value is serialized and stored in the trace
# `result` holds the actual return value for continued use
```

### tag(string)

Tags trace for indexing and cross-referencing.

```ruby
Trifle::Traces.tag("order:#{order.id}")
Trifle::Traces.tag("store:#{store.id}")
```

### State methods

```ruby
Trifle::Traces.fail!              # Mark entire trace as failed (:error)
Trifle::Traces.warn!              # Mark entire trace as warning
Trifle::Traces.tracer.success!    # Explicitly mark as success
Trifle::Traces.ignore!            # Mark trace to be skipped in wrapup callback
```

### artifact(name, path)

Attach a file to the trace (screenshots, exports, reports).

```ruby
Trifle::Traces.artifact('invoice.pdf', '/tmp/invoice_42.pdf')
# Creates a :media type line. File path stored in tracer.artifacts array.
```

### Tracer initialization

```ruby
Trifle::Traces.tracer = Trifle::Traces::Tracer::Hash.new(
  key: 'jobs/invoice_charge',
  meta: { job_id: 42 }
)
# ... do work with traces ...
Trifle::Traces.tracer.wrapup
```

---

## Tracing Philosophy: Trace What Matters

The goal of tracing is to be able to read the complete flow of execution. When you open a trace, you should understand exactly what happened without looking at the source code. A trace that doesn't tell the full story provides limited value.

### Rule 1: Trace every condition and its return value

Conditions determine the flow. If you can't see which branch was taken, the trace is incomplete.

**Bad - condition not traced:**
```ruby
if order.shippable?
  ship_order(order)
else
  queue_for_review(order)
end
```

**Good - condition traced with return value:**
```ruby
shippable = Trifle::Traces.trace('Order shippable?') { order.shippable? }
if shippable
  Trifle::Traces.trace('Shipping order')
  ship_order(order)
else
  Trifle::Traces.trace('Queuing for review')
  queue_for_review(order)
end
```

The trace output now reads: `Order shippable? -> true` followed by `Shipping order`. Anyone reading this trace knows exactly what happened.

### Rule 2: Trace valuable objects with blocks for inspection

Any object that matters for understanding what happened should be traced with a block. The block return value gets serialized into the trace.

```ruby
order = Trifle::Traces.trace('Loading order') do
  { id: order.id, state: order.state, total: order.total, items: order.items.count }
end

config = Trifle::Traces.trace('Shipping configuration') do
  { carrier: carrier.name, method: shipping_method, warehouse: warehouse.code }
end
```

### Rule 3: Trace all API requests and responses

External API calls are critical decision points. Always trace what you sent and what you got back.

```ruby
response = Trifle::Traces.trace('POST /api/v1/shipments') do
  payload = { order_id: order.id, items: items.map(&:sku) }
  Trifle::Traces.trace('Request payload') { payload }
  result = ShippingAPI.create_shipment(payload)
  Trifle::Traces.trace('Response') do
    { status: result.status, tracking: result.tracking_number, errors: result.errors }
  end
  result
end
```

### Rule 4: Use head markers for logical sections

Long traces need structure. Use `head: true` to mark major phases.

```ruby
Trifle::Traces.trace('Phase 1: Validation', head: true)
# validation traces...

Trifle::Traces.trace('Phase 2: Processing', head: true)
# processing traces...

Trifle::Traces.trace('Phase 3: Notification', head: true)
# notification traces...
```

### Rule 5: Mark the beginning of loops, cycles, and pagination

Any time something happens multiple times in a row (loops, pagination, batch processing, retries), mark the start of each iteration as a head. Without this, the trace becomes a flat wall of repeated lines with no way to tell where one iteration ends and the next begins.

```ruby
orders.each_with_index do |order, index|
  Trifle::Traces.trace("Processing order #{index + 1}/#{orders.count}: ##{order.id}", head: true)
  Trifle::Traces.tag("order:#{order.id}")
  # ... per-order traces ...
end
```

```ruby
page = 1
loop do
  Trifle::Traces.trace("Fetching page #{page}", head: true)
  response = Trifle::Traces.trace('API response') { api.fetch(page: page) }
  break if response.empty?
  Trifle::Traces.trace("Processing #{response.count} records")
  process(response)
  page += 1
end
```

```ruby
retries = 0
begin
  Trifle::Traces.trace("Attempt #{retries + 1}", head: true)
  result = perform_request
rescue RetryableError => e
  retries += 1
  Trifle::Traces.trace("Failed, retrying", state: :warning) { e.message }
  retry if retries < 3
  raise
end
```

### Rule 6: Mark errors and exceptions clearly

Use `state: :error` for failures and `Trifle::Traces.fail!` to mark the entire trace as failed.

```ruby
begin
  process_payment(order)
rescue PaymentError => e
  Trifle::Traces.trace('Payment failed', state: :error) { e.message }
  Trifle::Traces.fail!
  raise
rescue StandardError => e
  Trifle::Traces.trace('Unexpected error', state: :error) { e.message }
  Trifle::Traces.trace('Backtrace', state: :debug) { e.backtrace.first(5) }
  Trifle::Traces.fail!
  raise
end
```

### Rule 7: Use debug state for verbose/diagnostic data

Debug traces carry detailed information that aids troubleshooting but isn't part of the normal flow.

```ruby
Trifle::Traces.trace('Raw API response', state: :debug) { response.body }
Trifle::Traces.trace('Backtrace', state: :debug) { error.backtrace }
Trifle::Traces.trace('SQL query', state: :debug) { query.to_sql }
```

### Rule 8: Tag resources for cross-referencing

Tags let you find all traces related to a specific resource. Tag early, tag often.

```ruby
def process_request(request)
  Trifle::Traces.tag(request.tag)           # e.g., "request:42"
  Trifle::Traces.tag("store:#{request.store_id}")

  request.items.each do |item|
    Trifle::Traces.tag("item:#{item.id}")
    process_item(item)
  end
end
```

---

## Line Types

Each trace line has a `type` field:

| Type | Usage | How it's created |
|------|-------|-----------------|
| `:text` | Regular trace message | `Trifle::Traces.trace('message')` |
| `:head` | Section header/marker | `Trifle::Traces.trace('message', head: true)` |
| `:raw` | Block return value (serialized) | Automatically from block traces |
| `:media` | File attachment | `Trifle::Traces.artifact(name, path)` |

## States

**Line-level states** (individual trace line):
- `:success` (default) - normal execution
- `:error` - something failed
- `:warning` - something concerning but not fatal
- `:debug` - diagnostic information

```ruby
Trifle::Traces.trace('All good')                          # :success (default)
Trifle::Traces.trace('API timeout', state: :error)         # :error
Trifle::Traces.trace('Retrying...', state: :warning)       # :warning
Trifle::Traces.trace('Raw response', state: :debug)        # :debug
```

**Tracer-level states** (overall trace outcome):
```ruby
Trifle::Traces.fail!    # sets tracer state to :error
Trifle::Traces.warn!    # sets tracer state to :warning
Trifle::Traces.ignore!  # marks trace to skip persistence
# Default state after successful wrapup: :success
```

## Trace Data Structure

Each line in `tracer.data` is a hash:
```ruby
{
  at: 1706184000,        # Unix timestamp
  message: 'Fetching orders',
  state: :success,       # line state
  type: :text,           # line type
  level: 0               # nesting depth (increases inside blocks)
}
```

---

## Middleware Integrations

### Sidekiq

```ruby
# In sidekiq initializer
Sidekiq.configure_server do |config|
  config.server_middleware do |chain|
    chain.add Trifle::Traces::Middleware::Sidekiq
  end
end

# In worker class
class ProcessOrderJob
  include Sidekiq::Worker
  sidekiq_options tracer_key: 'jobs/process_order'

  def perform(order_id)
    Trifle::Traces.tag("order:#{order_id}")
    Trifle::Traces.trace('Starting order processing', head: true)
    # ... tracing happens automatically within the middleware lifecycle
  end
end
```

### Rails Controller

```ruby
class PaymentsController < ApplicationController
  include Trifle::Traces::Middleware::RailsController
  with_trifle_traces only: %i[create]

  def create
    Trifle::Traces.trace('Processing payment', head: true)
    # ...
  end

  def trace_key
    "api/payments/#{params[:action]}"
  end
end
```

### Manual (any Ruby code)

```ruby
def execute
  Trifle::Traces.tracer = Trifle::Traces::Tracer::Hash.new(
    key: 'services/sync_inventory'
  )
  Trifle::Traces.trace('Starting inventory sync', head: true)
  # ... do work ...
rescue => e
  Trifle::Traces.trace("Exception: #{e}", state: :error)
  Trifle::Traces.fail!
  raise
ensure
  Trifle::Traces.tracer&.wrapup
end
```

---

## Complete Example: A Well-Traced Job

```ruby
class FulfillOrderJob
  include Sidekiq::Worker
  sidekiq_options tracer_key: 'jobs/fulfill_order'

  def perform(order_id)
    Trifle::Traces.trace('FulfillOrderJob Start', head: true)
    Trifle::Traces.tag("order:#{order_id}")

    order = Trifle::Traces.trace('Loading order') do
      Order.find(order_id)
    end

    fulfillable = Trifle::Traces.trace('Order fulfillable?') { order.fulfillable? }
    unless fulfillable
      Trifle::Traces.trace('Order not fulfillable, skipping', state: :warning)
      return
    end

    Trifle::Traces.trace('Checking inventory', head: true)
    order.items.each do |item|
      Trifle::Traces.tag("item:#{item.id}")
      in_stock = Trifle::Traces.trace("Stock for SKU #{item.sku}?") do
        { sku: item.sku, available: item.stock_count, required: item.quantity }
      end
    end

    Trifle::Traces.trace('Creating shipment', head: true)
    shipment = Trifle::Traces.trace('POST /shipments') do
      ShippingAPI.create(order_id: order.id)
    end

    Trifle::Traces.trace('Fulfillment complete') do
      { tracking_number: shipment.tracking_number, shipped_at: Time.now }
    end

  rescue ShippingError => e
    Trifle::Traces.trace('Shipping failed', state: :error) { e.message }
    Trifle::Traces.fail!
    raise
  end
end
```

Reading this trace tells the complete story: order loaded, fulfillability checked, inventory verified per item, shipment API called with response captured, or error with reason.

---

## Quality Checklist

When reviewing or auditing trace instrumentation, check:

- Every major branch/condition has a trace line with its return value visible.
- External calls (APIs, services) have both request and response traced.
- Error traces include both the message and backtrace (backtrace as `:debug`).
- Loops and repeated work have `head: true` at each iteration boundary.
- Tags make navigation by entity possible (can find all traces for a given resource).
- The final result or outcome payload is traced so the trace explains the conclusion.
- Very large debug payloads are offloaded to artifacts rather than inlined in trace data.

---

## Read Deeper Docs on Demand

For the full API reference, visit https://docs.trifle.io or, if this repository is available locally, read:

- `docs-trifle-io/docs/trifle-traces/`
- `docs-trifle-io/docs/trifle-traces/getting_started.md`
- `docs-trifle-io/docs/trifle-traces/usage.md`
- `docs-trifle-io/docs/trifle-traces/tags_and_artifacts.md`
- `docs-trifle-io/docs/trifle-traces/state.md`
