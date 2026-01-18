"""
Chimera Core - Biological Movement Engine

High-fidelity human movement simulation using Bezier curves and Gaussian noise.
Implements Fitts's Law for natural acceleration/deceleration patterns.
"""

import math
import random
import asyncio
from typing import List, Tuple
from playwright.async_api import Page


class BiologicalMove:
    """
    Generates human-like mouse movements using Bezier curves with Gaussian noise.
    
    Implements:
    - Fitts's Law: Acceleration at start, deceleration at target
    - Gaussian noise: 1-2px micro-tremors (natural hand tremor)
    - Bezier interpolation: Natural curved paths
    """
    
    @staticmethod
    def generate_bezier_path(
        start: Tuple[float, float],
        end: Tuple[float, float],
        steps: int = 30,
        jitter: float = 1.5
    ) -> List[Tuple[float, float, float]]:
        """
        Generate Bezier curve path with Gaussian noise.
        
        Args:
            start: (x, y) starting position
            end: (x, y) ending position
            steps: Number of intermediate points
            jitter: Gaussian noise amplitude (pixels)
        
        Returns:
            List of (x, y, delay_ms) tuples
        """
        # Control points for Bezier curve (creates natural arc)
        mid_x = (start[0] + end[0]) / 2 + random.uniform(-50, 50)
        mid_y = (start[1] + end[1]) / 2 + random.uniform(-30, 30)
        
        path = []
        
        for i in range(steps + 1):
            t = i / steps
            
            # Cubic Bezier curve (4 control points)
            # P(t) = (1-t)³P₀ + 3(1-t)²tP₁ + 3(1-t)t²P₂ + t³P₃
            x = (
                (1 - t) ** 3 * start[0] +
                3 * (1 - t) ** 2 * t * (start[0] + (mid_x - start[0]) * 0.3) +
                3 * (1 - t) * t ** 2 * (end[0] + (mid_x - end[0]) * 0.3) +
                t ** 3 * end[0]
            )
            y = (
                (1 - t) ** 3 * start[1] +
                3 * (1 - t) ** 2 * t * (start[1] + (mid_y - start[1]) * 0.3) +
                3 * (1 - t) * t ** 2 * (end[1] + (mid_y - end[1]) * 0.3) +
                t ** 3 * end[1]
            )
            
            # Add Gaussian noise (micro-tremors)
            jitter_x = random.gauss(0, jitter)
            jitter_y = random.gauss(0, jitter)
            x += jitter_x
            y += jitter_y
            
            # Fitts's Law: Velocity curve (Ease-In-Out)
            # Slow at start and end, fast in middle
            if t < 0.5:
                # Ease-in (acceleration)
                ease_t = 2 * t * t
            else:
                # Ease-out (deceleration)
                ease_t = 1 - pow(-2 * t + 2, 2) / 2
            
            # Delay based on ease curve (faster in middle)
            base_delay = 5  # ms per step
            delay_ms = base_delay + (1 - ease_t) * 10  # 5-15ms range
            
            path.append((x, y, delay_ms))
        
        return path
    
    @staticmethod
    async def move_mouse_biological(
        page: Page,
        start: Tuple[float, float],
        end: Tuple[float, float],
        steps: int = None
    ) -> None:
        """
        Move mouse along Bezier path with biological timing.
        
        Args:
            page: Playwright page
            start: Starting (x, y) position
            end: Ending (x, y) position
            steps: Number of path steps (auto-calculated if None)
        """
        # Calculate steps based on distance (longer moves = more steps)
        distance = math.sqrt((end[0] - start[0]) ** 2 + (end[1] - start[1]) ** 2)
        if steps is None:
            steps = max(20, int(distance / 10))  # ~10px per step
        
        # Generate Bezier path
        path = BiologicalMove.generate_bezier_path(start, end, steps)
        
        # Execute movement
        for x, y, delay_ms in path:
            await page.mouse.move(x, y)
            await asyncio.sleep(delay_ms / 1000.0)  # Convert ms to seconds


class NaturalReader:
    """
    Simulates human eye scanning with micro-saccades (small, jittery scrolls).
    """
    
    @staticmethod
    async def micro_scroll_sequence(
        page: Page,
        total_distance: int = 500,
        micro_scrolls: int = 12
    ) -> None:
        """
        Perform natural reading scroll with micro-saccades.
        
        Args:
            page: Playwright page
            total_distance: Total scroll distance (pixels)
            micro_scrolls: Number of micro-scrolls (10-15 for natural reading)
        """
        scroll_per_step = total_distance / micro_scrolls
        
        for i in range(micro_scrolls):
            # Micro-scroll (2-5px with variation)
            scroll_amount = scroll_per_step + random.uniform(-1, 1)
            await page.mouse.wheel(0, scroll_amount)
            
            # Random pause (5-15ms) - simulates eye fixation
            pause_ms = random.uniform(5, 15)
            await asyncio.sleep(pause_ms / 1000.0)
    
    @staticmethod
    async def curiosity_hover(
        page: Page,
        viewport_width: int,
        viewport_height: int,
        num_hovers: int = 3
    ) -> None:
        """
        Perform random hover events over white-space to trigger liveness listeners.
        
        Args:
            page: Playwright page
            viewport_width: Viewport width
            viewport_height: Viewport height
            num_hovers: Number of hover events
        """
        for i in range(num_hovers):
            # Random position (avoid edges)
            x = random.randint(100, viewport_width - 100)
            y = random.randint(100, viewport_height - 100)
            
            # Move to position
            await page.mouse.move(x, y)
            
            # Brief pause (simulates "looking")
            await asyncio.sleep(random.uniform(0.2, 0.5))
            
            # Small jitter (micro-movement)
            jitter_x = x + random.uniform(-3, 3)
            jitter_y = y + random.uniform(-3, 3)
            await page.mouse.move(jitter_x, jitter_y)
            
            # Pause before next hover
            await asyncio.sleep(random.uniform(0.3, 0.7))
