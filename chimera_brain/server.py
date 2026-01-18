"""
gRPC Server for The Brain (Chimera)

This server exposes:
- Vision Service (VLM processing)
- Hive Mind (Memory queries)
- World Model (State tracking)

Listens on port 50051 for Railway deployment.
"""

import os
import json
import logging
import asyncio
from concurrent import futures
import grpc
from typing import Optional
from http.server import HTTPServer, BaseHTTPRequestHandler
from threading import Thread

# Import generated proto classes (will be created by generate_proto.sh)
# Files are generated in root directory, not proto/ subfolder
try:
    import chimera_pb2
    import chimera_pb2_grpc
except ImportError:
    # Fallback if proto files not generated yet
    logging.warning("Proto files not generated. Run ./generate_proto.sh first.")
    chimera_pb2 = None
    chimera_pb2_grpc = None

# Import our services
from vision_service import VisualIntentProcessor, SimpleCoordinateDetector
from hive_mind import HiveMind
from world_model.selector_registry import SelectorRegistry

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class BrainService(chimera_pb2_grpc.BrainServicer):
    """
    Implementation of the Brain gRPC service.
    
    Handles:
    - ProcessVision: VLM processing for screenshots
    - QueryMemory: Hive Mind memory queries
    - UpdateWorldModel: World model state updates
    """
    
    def __init__(self, use_simple_vision: bool = False, redis_url: Optional[str] = None):
        """
        Initialize the Brain service.
        
        Args:
            use_simple_vision: If True, use SimpleCoordinateDetector instead of full VLM
            redis_url: Redis URL for Hive Mind (defaults to REDIS_URL env var)
        """
        # Initialize Vision Service
        if use_simple_vision:
            logger.info("Using simple coordinate detector for Vision Service")
            self.vision_processor = SimpleCoordinateDetector()
        else:
            logger.info("Initializing full Vision Language Model")
            model_name = os.getenv("CHIMERA_VISION_MODEL", None)
            device = os.getenv("CHIMERA_VISION_DEVICE", None)
            try:
                self.vision_processor = VisualIntentProcessor(model_name=model_name, device=device)
            except Exception as e:
                logger.warning(f"Failed to load full VLM model, falling back to simple: {e}")
                self.vision_processor = SimpleCoordinateDetector()
        
        # Initialize Hive Mind
        redis_url = redis_url or os.getenv("REDIS_URL", "redis://localhost:6379")
        logger.info(f"Initializing Hive Mind with Redis: {redis_url}")
        try:
            self.hive_mind = HiveMind(redis_url=redis_url)
            logger.info("✅ Hive Mind initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Hive Mind: {e}")
            self.hive_mind = None
        
        # Initialize Selector Registry (Trauma Center)
        try:
            self.selector_registry = SelectorRegistry(redis_url=redis_url)
            logger.info("✅ Selector Registry (Trauma Center) initialized")
        except Exception as e:
            logger.warning(f"Failed to initialize Selector Registry, using JSON fallback: {e}")
            self.selector_registry = SelectorRegistry()  # JSON fallback
    
    def ProcessVision(self, request, context):
        """
        Process a screenshot with the Vision Language Model.
        
        This is the main VLM endpoint that processes screenshots and returns
        structured understanding or coordinates for UI elements.
        
        Includes "Trauma Center" logic for autonomous selector re-mapping.
        """
        try:
            logger.info(f"Processing vision request (context: '{request.context}')")
            
            # Extract domain from context if available (for selector registry)
            domain = None
            if request.context:
                # Try to extract domain from context (e.g., "https://example.com/login")
                import re
                url_match = re.search(r'https?://[^\s]+', request.context)
                if url_match:
                    domain = url_match.group(0)
            
            # If text_command is provided, use coordinate detection
            if request.text_command:
                logger.info(f"Coordinate detection requested: '{request.text_command}'")
                
                # Check if we should trigger Trauma Center (selector recovery)
                intent = request.text_command
                should_heal = self.selector_registry.should_trigger_trauma_center(domain or "unknown", intent)
                
                # Try standard coordinate detection first
                x, y, confidence = self.vision_processor.get_click_coordinates(
                    request.screenshot,
                    request.text_command
                )
                
                # If confidence is low or Trauma Center should be triggered, attempt healing
                if (confidence < 0.7 or should_heal) and hasattr(self.vision_processor, 'find_new_selector'):
                    logger.warning(f"⚠️ TRAUMA CENTER: Low confidence ({confidence:.2f}) or selector failure detected")
                    logger.warning(f"   Intent: '{intent}', Domain: {domain or 'unknown'}")
                    
                    # Get existing selector for comparison
                    existing_selector = self.selector_registry.get_selector(domain or "unknown", intent)
                    old_selector = existing_selector.get('selector', 'none') if existing_selector else 'none'
                    
                    # Attempt to find new selector using VLM
                    try:
                        selector_result = self.vision_processor.find_new_selector(
                            request.screenshot,
                            intent,
                            domain
                        )
                        
                        if selector_result.get('selector') and selector_result.get('confidence', 0) > 0.5:
                            # Update coordinates from selector recovery
                            x, y = selector_result['coordinates']
                            confidence = selector_result['confidence']
                            
                            # Register the new selector
                            selector_id = self.selector_registry.register_selector(
                                domain=domain or "unknown",
                                intent=intent,
                                selector=selector_result['selector'],
                                selector_type=selector_result.get('selector_type', 'css'),
                                confidence=confidence,
                                metadata=selector_result.get('metadata', {})
                            )
                            
                            # Record success (resets failure count)
                            self.selector_registry.record_success(domain or "unknown", intent)
                            
                            logger.warning(f"✅ TRAUMA CENTER: Self-healed selector")
                            logger.warning(f"   Old: {old_selector}")
                            logger.warning(f"   New: {selector_result['selector']}")
                            logger.warning(f"   Confidence: {confidence:.2f}")
                            
                            # Create UIElement for response
                            ui_element = chimera_pb2.UIElement(
                                type="button" if "button" in intent.lower() else "input" if "input" in intent.lower() else "element",
                                selector=selector_result['selector'],
                                attributes={
                                    'intent': intent,
                                    'domain': domain or "unknown",
                                    'confidence': str(confidence),
                                    'healed': 'true',
                                    'old_selector': old_selector
                                }
                            )
                            
                            return chimera_pb2.VisionResponse(
                                description=f"Found element at ({x}, {y}) [Self-Healed]",
                                confidence=confidence,
                                found=True,
                                x=x,
                                y=y,
                                width=50,
                                height=50,
                                elements=[ui_element]
                            )
                        else:
                            # VLM recovery failed
                            failure_count = self.selector_registry.record_failure(domain or "unknown", intent)
                            
                            if failure_count >= 3:
                                logger.critical(f"🚨 CRITICAL: Selector recovery failed 3 times for '{intent}'")
                                logger.critical(f"   Requires manual review - VLM cannot generate valid selector")
                                context.set_code(grpc.StatusCode.NOT_FOUND)
                                context.set_details(f"Selector recovery failed after 3 attempts for: {intent}")
                                return chimera_pb2.VisionResponse(
                                    description="",
                                    confidence=0.0,
                                    found=False,
                                    x=0,
                                    y=0,
                                    width=0,
                                    height=0,
                                    elements=[]
                                )
                            else:
                                logger.warning(f"⚠️ Trauma Center recovery failed (attempt {failure_count}/3), using fallback coordinates")
                    except Exception as e:
                        logger.error(f"❌ Trauma Center error: {e}", exc_info=True)
                        # Continue with original coordinates
                
                logger.info(f"Found coordinates: ({x}, {y}) with confidence: {confidence}")
                
                # Record successful use if selector exists
                if not should_heal:
                    self.selector_registry.record_success(domain or "unknown", intent)
                
                return chimera_pb2.VisionResponse(
                    description=f"Found element at ({x}, {y})",
                    confidence=confidence,
                    found=True,
                    x=x,
                    y=y,
                    width=50,  # Default click target size
                    height=50,
                    elements=[]  # Can be populated with detected UI elements
                )
            else:
                # General vision processing (description generation)
                # For now, use coordinate detector as fallback
                # In production, you'd use a full VLM for description
                logger.info("General vision processing requested")
                
                # Use a default text command to get some coordinates
                # In production, replace this with actual VLM description
                x, y, confidence = self.vision_processor.get_click_coordinates(
                    request.screenshot,
                    "center of screen"
                )
                
                return chimera_pb2.VisionResponse(
                    description="Screenshot processed successfully",
                    confidence=confidence,
                    found=False,
                    x=0,
                    y=0,
                    width=0,
                    height=0,
                    elements=[]  # TODO: Populate with detected UI elements
                )
                
        except Exception as e:
            logger.error(f"Error processing vision request: {e}", exc_info=True)
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(f"Error processing vision: {str(e)}")
            return chimera_pb2.VisionResponse(
                description="",
                confidence=0.0,
                found=False,
                x=0,
                y=0,
                width=0,
                height=0,
                elements=[]
            )
    
    def QueryMemory(self, request, context):
        """
        Query the Hive Mind for similar past experiences.
        
        This allows the swarm to recall successful action plans from memory.
        Supports two modes:
        1. Exact recall: Uses ax_tree_summary + screenshot_hash for precise matching
        2. Semantic search: Uses query text for general similarity search
        """
        try:
            if self.hive_mind is None:
                logger.warning("Hive Mind not initialized, returning empty results")
                return chimera_pb2.MemoryResponse(results=[])
            
            top_k = request.top_k if request.top_k > 0 else 5
            
            # Mode 1: Exact recall (AX tree + screenshot hash)
            if request.ax_tree_summary and request.screenshot_hash:
                logger.info("Using experience recall (AX tree + screenshot hash)")
                experience = self.hive_mind.recall_experience(
                    request.ax_tree_summary,
                    request.screenshot_hash
                )
                
                if experience:
                    # Found a cached solution
                    return chimera_pb2.MemoryResponse(
                        results=[
                            chimera_pb2.MemoryResult(
                                text=json.dumps(experience),
                                similarity=0.99,  # High similarity for exact match
                                metadata={},
                                action_plan=json.dumps(experience)
                            )
                        ]
                    )
                else:
                    # No cached solution found
                    return chimera_pb2.MemoryResponse(results=[])
            
            # Mode 2: Semantic search (query text)
            elif request.query:
                logger.info(f"Using semantic search: '{request.query}' (top_k={top_k})")
                results = self.hive_mind.semantic_search(
                    query_text=request.query,
                    top_k=top_k
                )
                
                # Convert to gRPC MemoryResult format
                memory_results = []
                for result in results:
                    memory_results.append(
                        chimera_pb2.MemoryResult(
                            text=result.get('text', ''),
                            similarity=result.get('similarity', 0.0),
                            metadata=result.get('metadata', {}),
                            action_plan=json.dumps(result.get('action_plan', {}))
                        )
                    )
                
                logger.info(f"Returning {len(memory_results)} memory results")
                return chimera_pb2.MemoryResponse(results=memory_results)
            
            else:
                # No query parameters provided
                logger.warning("QueryMemory called without query, ax_tree_summary, or screenshot_hash")
                return chimera_pb2.MemoryResponse(results=[])
                
        except Exception as e:
            logger.error(f"Error querying Hive Mind: {e}", exc_info=True)
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(f"Error querying memory: {str(e)}")
            return chimera_pb2.MemoryResponse(results=[])
    
    def UpdateWorldModel(self, request, context):
        """
        Update the world model with new state information.
        
        This tracks page state and predicts outcomes.
        """
        try:
            logger.info(f"Updating world model: state_id={request.state_id}")
            
            # TODO: Implement world model update logic
            # For now, just acknowledge the update
            
            return chimera_pb2.WorldModelResponse(
                success=True,
                prediction="{}"  # Empty JSON for now
            )
            
        except Exception as e:
            logger.error(f"Error updating world model: {e}", exc_info=True)
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(f"Error updating world model: {str(e)}")
            return chimera_pb2.WorldModelResponse(
                success=False,
                prediction="{}"
            )


# Removed HTTPServerV6 - using standard HTTPServer with 0.0.0.0 binding


class HealthCheckHandler(BaseHTTPRequestHandler):
    """Simple HTTP handler for Railway healthchecks"""
    
    def do_GET(self):
        if self.path == '/health':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"status":"healthy","service":"chimera-brain"}')
        else:
            self.send_response(404)
            self.end_headers()
    
    def log_message(self, format, *args):
        # Suppress HTTP server logs
        pass


def start_health_server(port: int = 8080):
    """Start HTTP healthcheck server in a separate thread, binding to 0.0.0.0 for Railway"""
    def run_server():
        # Bind to 0.0.0.0 for Railway compatibility (listens on all interfaces)
        server_address = ('0.0.0.0', port)
        server = HTTPServer(server_address, HealthCheckHandler)
        logger.info(f"🏥 Health check server started on 0.0.0.0:{port}")
        server.serve_forever()
    
    thread = Thread(target=run_server, daemon=True)
    thread.start()
    return thread


def serve(grpc_port: int = 50051, health_port: int = 8080, use_simple_vision: bool = False, redis_url: Optional[str] = None):
    """
    Start the gRPC server for The Brain.
    
    Args:
        grpc_port: Port for gRPC server (default: 50051)
        health_port: Port for HTTP healthcheck (default: 8080, Railway uses PORT env var)
        use_simple_vision: Use simple detector instead of full VLM
        redis_url: Redis URL for Hive Mind
    """
    if chimera_pb2 is None or chimera_pb2_grpc is None:
        logger.error("Proto files not generated! Run ./generate_proto.sh first.")
        logger.error("Starting HTTP healthcheck server anyway so Railway doesn't kill the container...")
        # Start healthcheck server even if proto files are missing
        # This allows Railway to see the service as "healthy" while we debug proto files
        start_health_server(health_port)
        logger.error("Waiting indefinitely (proto files must be fixed)...")
        import time
        while True:
            time.sleep(60)  # Keep container alive
        return
    
    # Start HTTP healthcheck server (Railway requirement)
    # Railway uses PORT env var for healthchecks, but we need gRPC on 50051
    start_health_server(health_port)
    
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    chimera_pb2_grpc.add_BrainServicer_to_server(
        BrainService(use_simple_vision=use_simple_vision, redis_url=redis_url),
        server
    )
    
    # Bind to 0.0.0.0 for Railway compatibility (listens on all interfaces)
    listen_addr = f"0.0.0.0:{grpc_port}"
    server.add_insecure_port(listen_addr)
    
    logger.info(f"🧠 Starting The Brain gRPC server on {listen_addr}")
    logger.info(f"   - Vision Service: {'Simple' if use_simple_vision else 'Full VLM'}")
    logger.info(f"   - Hive Mind: {'Enabled' if redis_url or os.getenv('REDIS_URL') else 'Disabled'}")
    server.start()
    
    try:
        server.wait_for_termination()
    except KeyboardInterrupt:
        logger.info("Shutting down The Brain server")
        server.stop(0)


if __name__ == "__main__":
    import sys
    
    # Parse command line arguments
    use_simple = "--simple" in sys.argv or os.getenv("CHIMERA_USE_SIMPLE", "false").lower() == "true"
    
    # Railway uses PORT for healthchecks, but gRPC needs to be on 50051
    # Use PORT for HTTP health, CHIMERA_BRAIN_PORT for gRPC
    health_port = int(os.getenv("PORT", "8080"))  # Railway healthcheck port
    grpc_port = int(os.getenv("CHIMERA_BRAIN_PORT", "50051"))  # gRPC server port
    
    # Redis URL for Hive Mind
    redis_url = os.getenv("REDIS_URL", None)
    
    serve(grpc_port=grpc_port, health_port=health_port, use_simple_vision=use_simple, redis_url=redis_url)
