# Production-Grade Workflow Engine

## 🎯 Overview

The Production-Grade Workflow Engine transforms the "BrainScraper Bus" concept into a robust, contract-based pipeline system with:

- **Contracts (Prerequisites)**: Stations declare what they need to run
- **Traffic Control (Stop Conditions)**: Early termination when conditions are met
- **Accounting (Cost Tracking)**: Full budget management with auto stop-loss

---

## 🏗️ Architecture

### Core Components

1. **PipelineContext** (`app/pipeline/types.py`)
   - Tracks state, costs, and history through the enrichment journey
   - Manages budget limits (auto stop-loss)
   - Records all station executions

2. **PipelineStation** (`app/pipeline/station.py`)
   - Base class for all enrichment stations
   - Enforces prerequisites (required inputs)
   - Declares outputs (produces fields)
   - Estimates costs

3. **PipelineEngine** (`app/pipeline/engine.py`)
   - Orchestrates stations with stop conditions
   - Handles budget checks
   - Manages error recovery

4. **Station Implementations** (`app/pipeline/stations/enrichment.py`)
   - Wraps existing enrichment logic into contract-based stations
   - All 6 stages of enrichment pipeline

5. **Route Loader** (`app/pipeline/loader.py`)
   - Loads pipeline configurations from JSON
   - Dynamically instantiates stations
   - Supports multiple pipeline routes

---

## 📋 Stop Conditions

```python
class StopCondition(Enum):
    CONTINUE = "continue"           # Normal success, proceed to next station
    SKIP_REMAINING = "skip_rest"    # Success/Stop (e.g., Found DNC match, stop enriching)
    FAIL = "fail"                   # Error occurred, decide based on policy (retry/skip)
```

### Examples

- **TelnyxGatekeepStation**: Returns `SKIP_REMAINING` if phone is VOIP/Landline (saves costs)
- **DNCGatekeeperStation**: Returns `SKIP_REMAINING` if lead is on DNC list (can't contact)
- **SkipTracingStation**: Returns `FAIL` if no phone found (critical failure)

---

## 🔧 Station Contracts

Each station declares:

### Required Inputs (Prerequisites)
```python
@property
def required_inputs(self) -> Set[str]:
    return {"phone"}  # Must have phone to run
```

### Produced Outputs (Promises)
```python
@property
def produces_outputs(self) -> Set[str]:
    return {"dnc_status", "can_contact"}  # Will add these fields
```

### Cost Estimate
```python
@property
def cost_estimate(self) -> float:
    return 0.02  # Estimated cost in dollars
```

---

## 🚀 Usage

### Basic Usage

```python
from app.pipeline.loader import create_pipeline

# Create pipeline from config
engine = create_pipeline("hybrid_smart", budget_override=5.0)

# Run pipeline
enriched_data = await engine.run(initial_lead_data)
```

### Configuration-Driven Routes

Edit `app/pipeline/routes.json`:

```json
{
  "pipelines": {
    "hybrid_smart": {
      "description": "Full enrichment with scraper-first strategy",
      "budget_limit": 5.0,
      "stations": [
        "app.pipeline.stations.enrichment.IdentityStation",
        "app.pipeline.stations.enrichment.ScraperEnrichmentStation",
        "app.pipeline.stations.enrichment.SkipTracingStation",
        "app.pipeline.stations.enrichment.TelnyxGatekeepStation",
        "app.pipeline.stations.enrichment.DNCGatekeeperStation",
        "app.pipeline.stations.enrichment.DemographicsStation",
        "app.pipeline.stations.enrichment.DatabaseSaveStation"
      ]
    }
  }
}
```

### Environment Variables

```bash
# Select pipeline route
PIPELINE_NAME=hybrid_smart  # or "free_only", "api_only"

# Override budget limit
PIPELINE_BUDGET_LIMIT=3.0  # Auto stop-loss at $3.00
```

---

## 📊 Available Pipelines

### 1. `hybrid_smart` (Default)
- **Strategy**: Scraper-first, API fallback
- **Budget**: $5.00
- **Stations**: All 7 stations
- **Use Case**: Production (cost-optimized)

### 2. `free_only`
- **Strategy**: Free scrapers + free APIs only
- **Budget**: $0.10
- **Stations**: Skips paid skip-tracing
- **Use Case**: Testing, low-budget runs

### 3. `api_only`
- **Strategy**: Skip scrapers, use paid APIs
- **Budget**: $3.00
- **Stations**: Skips scraper enrichment
- **Use Case**: When scrapers are unreliable

---

## 🎯 Station Flow

```
IdentityStation
  ↓ (produces: firstName, lastName, city, state, zipcode)
ScraperEnrichmentStation
  ↓ (produces: phone, age, income) OR (continues if no phone)
SkipTracingStation
  ↓ (produces: phone, email) OR (FAIL if no phone)
TelnyxGatekeepStation
  ↓ (produces: is_valid, carrier) OR (SKIP_REMAINING if invalid)
DNCGatekeeperStation
  ↓ (produces: dnc_status, can_contact) OR (SKIP_REMAINING if DNC)
DemographicsStation
  ↓ (produces: income, age, address)
DatabaseSaveStation
  ↓ (produces: saved, lead_id)
```

---

## 💰 Budget Management

The pipeline automatically stops if budget is exceeded:

```python
# In PipelineStation.execute()
if not ctx.can_afford(self.cost_estimate):
    return {}, StopCondition.SKIP_REMAINING
```

**Example**: If budget is $5.00 and we've spent $4.95, and next station costs $0.10, pipeline stops early.

---

## 🔍 Visualizing Routes

```python
engine = create_pipeline("hybrid_smart")
print(engine.visualize_route())
```

Output:
```
Pipeline Route:
  1. Identity Resolution
     Requires: [name]
     Produces: [firstName, lastName, city, state, zipcode]
     Cost: $0.0000
  2. Scraper Enrichment
     Requires: [firstName, lastName, city, state]
     Produces: [phone, age, income]
     Cost: $0.0000
  ...
```

---

## 🛠️ Creating Custom Stations

```python
from app.pipeline.station import PipelineStation
from app.pipeline.types import PipelineContext, StopCondition

class CustomStation(PipelineStation):
    @property
    def name(self) -> str:
        return "Custom Station"
    
    @property
    def required_inputs(self) -> set:
        return {"phone"}
    
    @property
    def produces_outputs(self) -> set:
        return {"custom_field"}
    
    @property
    def cost_estimate(self) -> float:
        return 0.05
    
    async def process(self, ctx: PipelineContext) -> Tuple[Dict[str, Any], StopCondition]:
        # Your logic here
        result = await some_api_call(ctx.data)
        return {"custom_field": result}, StopCondition.CONTINUE
```

---

## 📈 Cost Tracking

Every station execution is tracked:

```python
ctx.history.append({
    "station": "TelnyxGatekeepStation",
    "cost": 0.01,
    "status": "continue",
    "timestamp": "2026-01-15T10:30:00",
    "error": None
})
```

Final data includes:
- `_pipeline_cost`: Total cost spent
- `_pipeline_stations_executed`: Number of stations run
- `_pipeline_errors`: Number of errors encountered

---

## 🔄 Integration with Worker

The `redis_queue_worker.py` now uses the pipeline engine:

```python
# Old way (manual steps)
identity = resolve_identity(lead_data)
contact_info = enrich_with_scraper(identity)
# ... manual error handling

# New way (contract-based)
engine = get_pipeline_engine()
enriched_data = await engine.run(lead_data)
# Automatic prerequisite checks, budget management, stop conditions
```

---

## ✅ Benefits

1. **Contract Enforcement**: Stations can't run without prerequisites
2. **Budget Protection**: Auto stop-loss prevents overspending
3. **Early Termination**: Stop processing DNC/invalid leads immediately
4. **Cost Visibility**: Full accounting of every API call
5. **Configuration-Driven**: Change routes without code changes
6. **Visualization**: See pipeline structure before running
7. **Error Resilience**: Failed stations don't crash entire pipeline

---

## 🚨 Migration Notes

The new pipeline engine is **backward compatible**. Existing code continues to work, but you can now:

1. Use configuration-driven routes
2. Set budget limits per pipeline
3. Get automatic cost tracking
4. Benefit from contract enforcement

The worker automatically uses the new engine - no code changes needed in your enrichment functions!

---

## 📚 Files

- `app/pipeline/types.py` - Core types (PipelineContext, StopCondition)
- `app/pipeline/station.py` - Base station class
- `app/pipeline/engine.py` - Pipeline orchestrator
- `app/pipeline/loader.py` - Route loader
- `app/pipeline/routes.json` - Pipeline configurations
- `app/pipeline/stations/enrichment.py` - Station implementations
- `app/workers/redis_queue_worker.py` - Updated worker (uses pipeline engine)

---

## 🎉 Ready for 2026

This architecture is production-ready and supports:

- ✅ Visual pipeline graphs (prerequisites → outputs)
- ✅ Wallet protection (budget limits with auto stop-loss)
- ✅ Flow optimization (stop processing DNC leads immediately)
- ✅ Full cost accounting (every API call tracked)
- ✅ Configuration-driven routes (no code changes needed)
- ✅ Contract-based validation (prerequisites enforced)

The "BrainScraper Bus" is now a **Production-Grade Workflow Engine**! 🚀
