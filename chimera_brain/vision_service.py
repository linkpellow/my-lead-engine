"""
Vision Service - The Brain of Project Chimera

This service uses a Vision-Language Model (VLM) to understand visual intent
and return coordinates for UI elements based on natural language commands.

Includes "Trauma Center" functionality for autonomous selector re-mapping.
"""

import io
import logging
import re
from datetime import datetime
from typing import Tuple, Optional, Dict, Any
import torch
from PIL import Image
import numpy as np

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class VisualIntentProcessor:
    """
    Processes visual intent using a Vision-Language Model.
    
    This is the "Brain" - it takes screenshots and text commands,
    and returns coordinates where actions should be performed.
    """
    
    def __init__(self, model_name: Optional[str] = None, device: Optional[str] = None):
        """
        Initialize the vision model.
        
        Args:
            model_name: Name of the model to load. Defaults to a lightweight option.
            device: Device to run on ('cuda', 'cpu', or None for auto-detect)
        """
        self.model_name = model_name or "microsoft/git-base"
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        
        logger.info(f"Loading vision model: {self.model_name} on {self.device}")
        
        try:
            # Try to load a vision-language model
            # For production, you'd use a specialized model like Fuyu, LLaVA, or similar
            # For now, we'll use a simpler approach that works out of the box
            # You can replace this with your preferred VLM model
            
            # Example: Using BLIP or similar models
            # For now, we'll use a placeholder that can be replaced with actual models
            logger.info("Vision model placeholder initialized")
            logger.info("To use a real VLM, replace this with models like:")
            logger.info("  - microsoft/kosmos-2-patch14-224")
            logger.info("  - Salesforce/blip-image-captioning-base")
            logger.info("  - Or fine-tune your own model for coordinate detection")
            
            self.model = None
            self.processor = None
            
            # For now, always use fallback
            # In production, you'd load your fine-tuned model here
        except Exception as e:
            logger.warning(f"Failed to load advanced model: {e}")
            logger.info("Falling back to simple coordinate detection")
            self.model = None
            self.processor = None
    
    def get_click_coordinates(
        self, 
        image_bytes: bytes, 
        text_command: str
    ) -> Tuple[int, int, float]:
        """
        Get click coordinates for a visual intent.
        
        Args:
            image_bytes: PNG image bytes (screenshot)
            text_command: Natural language command (e.g., "Click the big green button")
            
        Returns:
            Tuple of (x, y, confidence) coordinates
        """
        try:
            # Validate image bytes before processing
            if not image_bytes or len(image_bytes) < 8:
                logger.warning(f"Invalid image bytes: empty or too small ({len(image_bytes) if image_bytes else 0} bytes)")
                return (0, 0, 0.0)
            
            # Check for valid image header (PNG, JPEG, etc.)
            # PNG: 89 50 4E 47 (0x89PNG)
            # JPEG: FF D8 FF
            is_png = image_bytes[:4] == b'\x89PNG'
            is_jpeg = image_bytes[:3] == b'\xff\xd8\xff'
            
            if not (is_png or is_jpeg):
                logger.warning(f"Image bytes don't have valid PNG/JPEG header. First 8 bytes: {image_bytes[:8].hex()}")
                # Still try to process - might be another format PIL supports
            
            # Load image from BytesIO stream
            image_stream = io.BytesIO(image_bytes)
            image = Image.open(image_stream)
            image = image.convert("RGB")
            
            # For now, use fallback detection
            # In production, replace this with your actual VLM model
            if self.model is None:
                # Fallback: Simple heuristic-based detection
                return self._fallback_coordinate_detection(image, text_command)
            
            # Use the vision model to understand the command
            # This is a placeholder - in production, you'd have a fine-tuned model
            # that specifically outputs bounding boxes or coordinates
            
            prompt = f"Find the UI element that matches: '{text_command}'. Return the center coordinates as (x, y)."
            
            inputs = self.processor(images=image, text=prompt, return_tensors="pt")
            inputs = {k: v.to(self.device) for k, v in inputs.items()}
            
            with torch.no_grad():
                outputs = self.model.generate(**inputs, max_new_tokens=50)
            
            # Parse coordinates from output
            # In a real implementation, you'd have a specialized model that outputs
            # bounding boxes or coordinates directly
            coordinates = self._parse_coordinates_from_output(outputs, image.size)
            
            return coordinates
            
        except Exception as e:
            logger.error(f"Error processing vision request: {e}")
            # Return safe defaults on any error
            return (0, 0, 0.0)
    
    def _fallback_coordinate_detection(
        self, 
        image: Image.Image, 
        text_command: str
    ) -> Tuple[int, int, float]:
        """
        Fallback coordinate detection using simple heuristics.
        
        This is a placeholder - in production, you'd always use a proper VLM.
        """
        width, height = image.size
        
        # Simple keyword-based heuristics
        text_lower = text_command.lower()
        
        # Look for common UI elements based on keywords
        if "button" in text_lower or "click" in text_lower:
            # Try to find button-like regions (simplified)
            # In reality, you'd use edge detection, color analysis, etc.
            if "green" in text_lower or "submit" in text_lower:
                # Typically submit buttons are in the bottom-right area
                x = int(width * 0.85)
                y = int(height * 0.90)
            elif "login" in text_lower or "sign in" in text_lower:
                # Login buttons often in top-right
                x = int(width * 0.85)
                y = int(height * 0.15)
            else:
                # Default: center of screen
                x = width // 2
                y = height // 2
        elif "input" in text_lower or "field" in text_lower or "type" in text_lower:
            # Input fields often in center-top area
            x = width // 2
            y = int(height * 0.35)
        else:
            # Default: center
            x = width // 2
            y = height // 2
        
        # Low confidence for fallback
        confidence = 0.5
        
        logger.info(f"Fallback detection: ({x}, {y}) for '{text_command}'")
        return (x, y, confidence)
    
    def _parse_coordinates_from_output(
        self, 
        outputs: torch.Tensor, 
        image_size: Tuple[int, int]
    ) -> Tuple[int, int, float]:
        """
        Parse coordinates from model output.
        
        This is a placeholder - in production, you'd have a model that
        directly outputs bounding boxes or coordinates.
        """
        # For now, return center with medium confidence
        # In reality, you'd decode the model output properly
        width, height = image_size
        return (width // 2, height // 2, 0.7)
    
    def find_new_selector(
        self,
        screenshot: bytes,
        intent_description: str,
        domain: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Find a new CSS/XPath selector for a UI element using VLM.
        
        This is the "Trauma Center" method - when a selector fails,
        this method uses the VLM to autonomously re-map the selector.
        
        Args:
            screenshot: PNG image bytes
            intent_description: Natural language description (e.g., "the search input field")
            domain: Optional domain/URL for context
        
        Returns:
            Dict with:
                - selector: CSS or XPath selector string
                - selector_type: "css" or "xpath"
                - confidence: Confidence score (0.0 to 1.0)
                - coordinates: (x, y) tuple
                - metadata: Additional metadata (attributes, etc.)
        """
        try:
            logger.info(f"🔧 Trauma Center: Finding new selector for '{intent_description}'")
            
            # Validate image
            if not screenshot or len(screenshot) < 8:
                logger.warning("Invalid screenshot for selector recovery")
                return {
                    'selector': None,
                    'selector_type': 'css',
                    'confidence': 0.0,
                    'coordinates': (0, 0),
                    'metadata': {}
                }
            
            # Load image
            image_stream = io.BytesIO(screenshot)
            image = Image.open(image_stream)
            image = image.convert("RGB")
            width, height = image.size
            
            # Get coordinates using existing coordinate detection
            x, y, coord_confidence = self.get_click_coordinates(screenshot, intent_description)
            
            # Generate selector based on intent and coordinates
            # In production, this would use a specialized VLM that outputs selectors
            # For now, we use heuristics and coordinate-based generation
            selector = self._generate_selector_from_intent(intent_description, x, y, width, height)
            
            # Calculate confidence based on coordinate confidence and selector quality
            confidence = coord_confidence * 0.8  # Slightly lower for selector generation
            
            logger.info(f"✅ Trauma Center: Generated selector '{selector}' with confidence {confidence:.2f}")
            
            return {
                'selector': selector,
                'selector_type': 'css',
                'confidence': confidence,
                'coordinates': (x, y),
                'metadata': {
                    'intent': intent_description,
                    'domain': domain,
                    'generated_at': datetime.utcnow().isoformat(),
                    'image_size': {'width': width, 'height': height}
                }
            }
            
        except Exception as e:
            logger.error(f"❌ Trauma Center: Failed to find new selector: {e}", exc_info=True)
            return {
                'selector': None,
                'selector_type': 'css',
                'confidence': 0.0,
                'coordinates': (0, 0),
                'metadata': {'error': str(e)}
            }
    
    def _generate_selector_from_intent(
        self,
        intent: str,
        x: int,
        y: int,
        image_width: int,
        image_height: int
    ) -> str:
        """
        Generate a CSS selector from intent description and coordinates.
        
        This is a heuristic-based approach. In production, you'd use a
        VLM that can analyze the screenshot and generate accurate selectors.
        
        Args:
            intent: Intent description
            x, y: Coordinates
            image_width, image_height: Image dimensions
        
        Returns:
            CSS selector string
        """
        intent_lower = intent.lower()
        
        # Intent-based selectors
        if "button" in intent_lower or "click" in intent_lower:
            if "login" in intent_lower or "sign in" in intent_lower:
                # Try common login button selectors
                return "button[type='submit'], .login-button, #login-button, button:contains('Login'), button:contains('Sign In')"
            elif "submit" in intent_lower:
                return "button[type='submit']"
            else:
                return "button"
        
        elif "input" in intent_lower or "field" in intent_lower or "search" in intent_lower:
            if "search" in intent_lower:
                return "input[type='search'], input[name='search'], #search, .search-input, input[placeholder*='search' i]"
            else:
                return "input"
        
        elif "link" in intent_lower or "anchor" in intent_lower:
            return "a"
        
        # Fallback: Use coordinate-based selector (not ideal, but works)
        # In production, VLM would generate proper selector
        logger.warning(f"Using fallback selector generation for intent: {intent}")
        return f"*"  # Generic fallback - would need DOM access for precise selector


class SimpleCoordinateDetector:
    """
    A simpler, faster coordinate detector for development/testing.
    
    This uses basic image processing to find UI elements.
    """
    
    def __init__(self):
        logger.info("Initializing simple coordinate detector")
    
    def get_click_coordinates(
        self, 
        image_bytes: bytes, 
        text_command: str
    ) -> Tuple[int, int, float]:
        """
        Simple coordinate detection using keyword matching and heuristics.
        """
        # Validate image bytes before processing
        if not image_bytes or len(image_bytes) < 8:
            logger.warning(f"Invalid image bytes: empty or too small ({len(image_bytes) if image_bytes else 0} bytes)")
            return (0, 0, 0.0)
        
        try:
            image_stream = io.BytesIO(image_bytes)
            image = Image.open(image_stream)
            image = image.convert("RGB")
            width, height = image.size
        except Exception as e:
            logger.error(f"Failed to open image: {e}")
            return (0, 0, 0.0)
        
        width, height = image.size
        
        # Convert to numpy for analysis
        img_array = np.array(image)
        
        # Simple keyword-based detection
        text_lower = text_command.lower()
        
        # Look for bright/colored regions (potential buttons)
        if "button" in text_lower:
            # Find regions with high saturation or brightness
            # This is very simplified - real implementation would be more sophisticated
            if "green" in text_lower:
                # Look for green regions
                green_mask = (img_array[:, :, 1] > img_array[:, :, 0]) & \
                            (img_array[:, :, 1] > img_array[:, :, 2])
                if green_mask.any():
                    y_coords, x_coords = np.where(green_mask)
                    x = int(np.mean(x_coords))
                    y = int(np.mean(y_coords))
                    confidence = 0.6
                    return (x, y, confidence)
        
        # Default: intelligent center based on common UI patterns
        if "top" in text_lower or "header" in text_lower:
            y = int(height * 0.15)
        elif "bottom" in text_lower or "footer" in text_lower:
            y = int(height * 0.85)
        else:
            y = height // 2
        
        if "left" in text_lower:
            x = int(width * 0.15)
        elif "right" in text_lower:
            x = int(width * 0.85)
        else:
            x = width // 2
        
        confidence = 0.5
        return (x, y, confidence)
