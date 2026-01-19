"""
Telemetry Client for Chimera Core → V2 Pilot Integration

Pushes real-time diagnostic data to BrainScraper V2 Pilot interface:
- Coordinate drift (VLM vs Blueprint)
- Fingerprint data (JA3, User-Agent, headers)
- Screenshots and region proposals
- Mouse movement heatmap data
- Decision traces (THINK steps)
- VLM confidence scores
"""

import os
import base64
import time
import requests
from io import BytesIO
from typing import Dict, List, Optional, Tuple
from PIL import Image
import logging

logger = logging.getLogger(__name__)


class TelemetryClient:
    """Client for pushing telemetry to V2 Pilot diagnostic interface"""
    
    def __init__(self, brainscraper_url: Optional[str] = None):
        """
        Initialize telemetry client
        
        Args:
            brainscraper_url: URL of BrainScraper service (defaults to env var or Railway internal)
        """
        self.brainscraper_url = brainscraper_url or os.getenv(
            'BRAINSCRAPER_URL',
            'http://brainscraper.railway.internal:3000'
        )
        self.telemetry_endpoint = f"{self.brainscraper_url}/api/v2-pilot/telemetry"
        logger.info(f"📡 Telemetry client initialized: {self.telemetry_endpoint}")
    
    def push(
        self,
        mission_id: str,
        coordinate_drift: Optional[Dict] = None,
        fingerprint: Optional[Dict] = None,
        screenshot: Optional[bytes] = None,
        region_coords: Optional[Tuple[int, int]] = None,
        grounding_bbox: Optional[Dict] = None,
        mouse_movements: Optional[List[Dict]] = None,
        decision_trace: Optional[List[Dict]] = None,
        vision_confidence: Optional[float] = None,
        fallback_triggered: Optional[bool] = None,
        status: Optional[str] = None,
        trauma_signals: Optional[List[str]] = None,
        trauma_details: Optional[str] = None
    ) -> bool:
        """
        Push telemetry data to V2 Pilot
        
        Args:
            mission_id: Unique mission identifier
            coordinate_drift: {suggested: {x, y}, actual: {x, y}, confidence}
            fingerprint: {ja3_hash, user_agent, sec_ch_ua, isp_carrier, session_id, ip_changed}
            screenshot: Raw screenshot bytes (PNG)
            region_coords: (x, y) coordinates for 200x200 crop center
            grounding_bbox: {x, y, width, height} bounding box for VLM focus area
            mouse_movements: List of {x, y, timestamp}
            decision_trace: List of {step, action, timestamp, confidence}
            vision_confidence: VLM confidence score (0.0-1.0)
            fallback_triggered: Whether olmOCR-2 fallback was triggered
            status: Mission status (queued/processing/completed/failed)
            trauma_signals: List of trauma signal types
            trauma_details: Human-readable trauma details
            
        Returns:
            True if push succeeded, False otherwise
        """
        try:
            payload = {'mission_id': mission_id}
            
            # Add coordinate drift
            if coordinate_drift:
                payload['coordinate_drift'] = coordinate_drift
            
            # Add fingerprint
            if fingerprint:
                payload['fingerprint'] = fingerprint
            
            # Add screenshot (convert to data URI)
            if screenshot:
                screenshot_b64 = base64.b64encode(screenshot).decode('utf-8')
                payload['screenshot_url'] = f"data:image/png;base64,{screenshot_b64}"
                
                # Extract region proposal if coordinates provided
                if region_coords:
                    region_b64 = self._extract_region_proposal(screenshot, region_coords)
                    if region_b64:
                        payload['region_proposal'] = region_b64
            
            # Add grounding bounding box
            if grounding_bbox:
                payload['grounding_bbox'] = grounding_bbox
            
            # Add mouse movements (keep last 10)
            if mouse_movements:
                payload['mouse_movements'] = mouse_movements[-10:]
            
            # Add decision trace
            if decision_trace:
                payload['decision_trace'] = decision_trace
            
            # Add VLM metrics
            if vision_confidence is not None:
                payload['vision_confidence'] = vision_confidence
            if fallback_triggered is not None:
                payload['fallback_triggered'] = fallback_triggered
            
            # Add status
            if status:
                payload['status'] = status
            
            # Add trauma signals
            if trauma_signals:
                payload['trauma_signals'] = trauma_signals
                if trauma_details:
                    payload['trauma_details'] = trauma_details
            
            # Send to BrainScraper
            response = requests.post(
                self.telemetry_endpoint,
                json=payload,
                timeout=5
            )
            
            if response.status_code == 200:
                result = response.json()
                logger.info(
                    f"✅ Telemetry pushed: {mission_id} "
                    f"({result.get('fields_updated', 0)} fields)"
                )
                return True
            else:
                logger.error(
                    f"❌ Telemetry push failed: {response.status_code} - {response.text}"
                )
                return False
                
        except Exception as e:
            logger.error(f"❌ Exception pushing telemetry: {e}")
            return False
    
    def _extract_region_proposal(
        self,
        screenshot: bytes,
        center: Tuple[int, int],
        size: int = 200
    ) -> Optional[str]:
        """
        Extract 200x200 crop from screenshot centered at coordinates
        
        Args:
            screenshot: Raw screenshot bytes
            center: (x, y) center coordinates
            size: Crop size (default 200x200)
            
        Returns:
            Base64 encoded crop, or None if failed
        """
        try:
            img = Image.open(BytesIO(screenshot))
            x, y = center
            half_size = size // 2
            
            # Calculate crop box (with bounds checking)
            left = max(0, x - half_size)
            top = max(0, y - half_size)
            right = min(img.width, x + half_size)
            bottom = min(img.height, y + half_size)
            
            # Crop and resize to ensure 200x200
            crop = img.crop((left, top, right, bottom))
            crop = crop.resize((size, size), Image.LANCZOS)
            
            # Convert to base64
            buffer = BytesIO()
            crop.save(buffer, format='PNG')
            return base64.b64encode(buffer.getvalue()).decode('utf-8')
            
        except Exception as e:
            logger.error(f"Failed to extract region proposal: {e}")
            return None
    
    def push_start(
        self,
        mission_id: str,
        fingerprint: Dict,
        initial_step: str
    ) -> bool:
        """
        Push mission start telemetry
        
        Args:
            mission_id: Mission ID
            fingerprint: Browser fingerprint data
            initial_step: First decision trace step
            
        Returns:
            True if push succeeded
        """
        return self.push(
            mission_id=mission_id,
            status='processing',
            fingerprint=fingerprint,
            decision_trace=[{
                'step': initial_step,
                'action': 'Mission started',
                'timestamp': int(time.time() * 1000),
                'confidence': 1.0
            }]
        )
    
    def push_vlm_click(
        self,
        mission_id: str,
        suggested_coords: Tuple[int, int],
        actual_coords: Tuple[int, int],
        confidence: float,
        screenshot: bytes
    ) -> bool:
        """
        Push VLM click telemetry with coordinate drift
        
        Args:
            mission_id: Mission ID
            suggested_coords: (x, y) Blueprint predicted coordinates
            actual_coords: (x, y) VLM actual click coordinates
            confidence: VLM confidence score
            screenshot: Screenshot bytes
            
        Returns:
            True if push succeeded
        """
        return self.push(
            mission_id=mission_id,
            coordinate_drift={
                'suggested': {'x': suggested_coords[0], 'y': suggested_coords[1]},
                'actual': {'x': actual_coords[0], 'y': actual_coords[1]},
                'confidence': confidence
            },
            screenshot=screenshot,
            region_coords=actual_coords,
            vision_confidence=confidence
        )
    
    def push_captcha_detected(
        self,
        mission_id: str,
        captcha_type: str,
        decision_trace: List[Dict]
    ) -> bool:
        """
        Push CAPTCHA detection telemetry
        
        Args:
            mission_id: Mission ID
            captcha_type: Type of CAPTCHA detected
            decision_trace: Updated decision trace
            
        Returns:
            True if push succeeded
        """
        return self.push(
            mission_id=mission_id,
            trauma_signals=['NEEDS_OLMOCR_VERIFICATION'],
            trauma_details=f'Detected {captcha_type} CAPTCHA',
            decision_trace=decision_trace
        )
    
    def push_session_broken(
        self,
        mission_id: str,
        fingerprint: Dict
    ) -> bool:
        """
        Push session broken alert
        
        Args:
            mission_id: Mission ID
            fingerprint: Updated fingerprint with ip_changed=True
            
        Returns:
            True if push succeeded
        """
        fingerprint['ip_changed'] = True
        return self.push(
            mission_id=mission_id,
            fingerprint=fingerprint,
            trauma_signals=['SESSION_BROKEN'],
            trauma_details='IP address changed mid-mission'
        )
    
    def push_complete(
        self,
        mission_id: str,
        decision_trace: List[Dict],
        success: bool = True
    ) -> bool:
        """
        Push mission completion telemetry
        
        Args:
            mission_id: Mission ID
            decision_trace: Final decision trace
            success: Whether mission succeeded
            
        Returns:
            True if push succeeded
        """
        return self.push(
            mission_id=mission_id,
            status='completed' if success else 'failed',
            decision_trace=decision_trace
        )


# Singleton instance
_telemetry_client = None

def get_telemetry_client() -> TelemetryClient:
    """Get or create singleton telemetry client"""
    global _telemetry_client
    if _telemetry_client is None:
        _telemetry_client = TelemetryClient()
    return _telemetry_client
