"""
gRPC Server for The Brain (Chimera)

This server exposes:
- Vision Service (VLM processing)
- Hive Mind (Memory queries)
- World Model (State tracking)

Listens on port 50051 for Railway deployment.
"""

import os
import logging
import asyncio
from concurrent import futures
import grpc
from typing import Optional

# Import generated proto classes (will be created by generate_proto.sh)
try:
    from proto import chimera_pb2, chimera_pb2_grpc
except ImportError:
    # Fallback if proto files not generated yet
    logging.warning("Proto files not generated. Run ./generate_proto.sh first.")
    chimera_pb2 = None
    chimera_pb2_grpc = None

# Import our services
from vision_service import VisualIntentProcessor, SimpleCoordinateDetector
from hive_mind import HiveMind

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
    
    def ProcessVision(self, request, context):
        """
        Process a screenshot with the Vision Language Model.
        
        This is the main VLM endpoint that processes screenshots and returns
        structured understanding or coordinates for UI elements.
        """
        try:
            logger.info(f"Processing vision request (context: '{request.context}')")
            
            # If text_command is provided, use coordinate detection
            if request.text_command:
                logger.info(f"Coordinate detection requested: '{request.text_command}'")
                x, y, confidence = self.vision_processor.get_click_coordinates(
                    request.screenshot,
                    request.text_command
                )
                
                logger.info(f"Found coordinates: ({x}, {y}) with confidence: {confidence}")
                
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
        """
        try:
            if self.hive_mind is None:
                logger.warning("Hive Mind not initialized, returning empty results")
                return chimera_pb2.MemoryResponse(results=[])
            
            logger.info(f"Querying Hive Mind: '{request.query}' (top_k={request.top_k})")
            
            # If ax_tree_summary and screenshot_hash are provided, use recall_experience
            if request.ax_tree_summary and request.screenshot_hash:
                logger.info("Using experience recall (AX tree + screenshot hash)")
                experience = self.hive_mind.recall_experience(
                    request.ax_tree_summary,
                    request.screenshot_hash
                )
                
                if experience:
                    # Found a cached solution
                    import json
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
            else:
                # General semantic search (if implemented in HiveMind)
                # For now, return empty - can be extended later
                logger.info("General memory query (not yet implemented)")
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


def serve(port: int = 50051, use_simple_vision: bool = False, redis_url: Optional[str] = None):
    """
    Start the gRPC server for The Brain.
    
    Args:
        port: Port to listen on (default: 50051 for Railway)
        use_simple_vision: Use simple detector instead of full VLM
        redis_url: Redis URL for Hive Mind
    """
    if chimera_pb2 is None or chimera_pb2_grpc is None:
        logger.error("Proto files not generated! Run ./generate_proto.sh first.")
        return
    
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    chimera_pb2_grpc.add_BrainServicer_to_server(
        BrainService(use_simple_vision=use_simple_vision, redis_url=redis_url),
        server
    )
    
    listen_addr = f"[::]:{port}"
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
    
    # Railway uses PORT environment variable, but we default to 50051 for The Brain
    port = int(os.getenv("PORT", os.getenv("CHIMERA_BRAIN_PORT", "50051")))
    
    # Redis URL for Hive Mind
    redis_url = os.getenv("REDIS_URL", None)
    
    serve(port=port, use_simple_vision=use_simple, redis_url=redis_url)
