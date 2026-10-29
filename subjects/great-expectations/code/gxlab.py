"""Small helpers shared by the exercises."""

import warnings

import great_expectations as gx
from great_expectations.execution_engine import ExecutionEngine

warnings.filterwarnings("ignore")

print("great_expectations", gx.__version__)


def spy_on_metric_rounds() -> list[list[str]]:
    """Record every call the validation graph makes to ExecutionEngine.resolve_metrics.

    Each call is one "round": all metrics whose dependencies are already resolved. The returned list is
    appended to in place, so clear it (`calls.clear()`) between runs.
    """
    calls: list[list[str]] = []
    original = ExecutionEngine.resolve_metrics

    def spy(self, metrics_to_resolve, metrics=None, runtime_configuration=None):
        calls.append(sorted(m.metric_name for m in metrics_to_resolve))
        return original(self, metrics_to_resolve, metrics, runtime_configuration)

    ExecutionEngine.resolve_metrics = spy
    return calls


def pandas_batch_definition(context, tag: str):
    """A pandas data source, a DataFrame asset and a whole-dataframe batch definition, all added to `context`."""
    source = context.data_sources.add_pandas(f"source_{tag}")
    asset = source.add_dataframe_asset(f"asset_{tag}")
    return asset.add_batch_definition_whole_dataframe(f"batch_{tag}")
