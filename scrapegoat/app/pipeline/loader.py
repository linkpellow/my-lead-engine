"""
Pipeline Route Loader
Loads and instantiates pipeline routes from configuration
"""
import json
import importlib
from pathlib import Path
from typing import List, Dict, Any, Optional
from loguru import logger

from .engine import PipelineEngine
from .station import PipelineStation


def load_routes_config(config_path: Optional[Path] = None) -> Dict[str, Any]:
    """
    Load pipeline routes configuration from JSON file.
    
    Args:
        config_path: Path to routes.json (default: app/pipeline/routes.json)
        
    Returns:
        Configuration dictionary
    """
    if config_path is None:
        config_path = Path(__file__).parent / "routes.json"
    
    if not config_path.exists():
        raise FileNotFoundError(f"Routes config not found: {config_path}")
    
    with open(config_path, 'r') as f:
        return json.load(f)


def load_station_class(station_path: str) -> type:
    """
    Dynamically load a station class from module path.
    
    Args:
        station_path: Full module path like "app.pipeline.stations.enrichment.IdentityStation"
        
    Returns:
        Station class
    """
    try:
        module_path, class_name = station_path.rsplit('.', 1)
        module = importlib.import_module(module_path)
        station_class = getattr(module, class_name)
        
        if not issubclass(station_class, PipelineStation):
            raise TypeError(f"{station_path} is not a PipelineStation")
        
        return station_class
        
    except (ImportError, AttributeError, ValueError) as e:
        raise ImportError(f"Failed to load station {station_path}: {e}")


def create_pipeline(
    pipeline_name: str,
    config_path: Optional[Path] = None,
    budget_override: Optional[float] = None
) -> PipelineEngine:
    """
    Create a pipeline engine from configuration.
    
    Args:
        pipeline_name: Name of pipeline from routes.json (e.g., "hybrid_smart")
        config_path: Path to routes.json (default: app/pipeline/routes.json)
        budget_override: Override budget limit from config
        
    Returns:
        Configured PipelineEngine instance
    """
    config = load_routes_config(config_path)
    
    if pipeline_name not in config.get("pipelines", {}):
        available = list(config.get("pipelines", {}).keys())
        raise ValueError(f"Pipeline '{pipeline_name}' not found. Available: {available}")
    
    pipeline_config = config["pipelines"][pipeline_name]
    station_paths = pipeline_config["stations"]
    budget = budget_override or pipeline_config.get("budget_limit", 5.0)
    
    # Load and instantiate stations
    stations = []
    for station_path in station_paths:
        try:
            station_class = load_station_class(station_path)
            station = station_class()
            stations.append(station)
            logger.debug(f"✅ Loaded station: {station.name}")
        except Exception as e:
            logger.error(f"❌ Failed to load station {station_path}: {e}")
            raise
    
    # Create engine
    engine = PipelineEngine(route=stations, budget_limit=budget)
    
    logger.info(f"🚀 Created pipeline '{pipeline_name}' with {len(stations)} stations (budget: ${budget:.2f})")
    
    return engine


def get_available_pipelines(config_path: Optional[Path] = None) -> List[str]:
    """
    Get list of available pipeline names.
    
    Args:
        config_path: Path to routes.json
        
    Returns:
        List of pipeline names
    """
    config = load_routes_config(config_path)
    return list(config.get("pipelines", {}).keys())


def get_default_pipeline_name(config_path: Optional[Path] = None) -> str:
    """
    Get default pipeline name from config.
    
    Args:
        config_path: Path to routes.json
        
    Returns:
        Default pipeline name
    """
    config = load_routes_config(config_path)
    return config.get("default_pipeline", "hybrid_smart")
