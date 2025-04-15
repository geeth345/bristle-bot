from typing import Dict, Any
import time
import numpy as np
import random
import math

class BotSimulator:
    """Simulates swarm bot behavior"""
    
    def __init__(self):
        """Initialize with default bots"""
        self.bots = {
            0: self._create_bot(0.0, 0.0),
            1: self._create_bot(1.0, 1.0)
        }
        
    def _create_bot(self, x: float, y: float) -> Dict[str, Any]:
        """Create a new bot with default parameters"""
        return {
            "x": x,
            "y": y,
            "battery": 100.0,
            "status": "active",
            "last_update": time.time(),
            "velocity": {
                "x": 0.0,
                "y": 0.0
            }
        }
    
    def add_bot(self, bot_id: int, x: float, y: float) -> Dict[str, Any]:
        """Add a new bot to the simulation"""
        if bot_id in self.bots:
            raise ValueError(f"Bot with ID {bot_id} already exists")
            
        self.bots[bot_id] = self._create_bot(x, y)
        return self.bots[bot_id]
    
    def update_bot(self, bot_id: int, **kwargs) -> Dict[str, Any]:
        """Update bot properties"""
        if bot_id not in self.bots:
            raise ValueError(f"Bot with ID {bot_id} does not exist")
            
        # Update provided properties
        for key, value in kwargs.items():
            if key in self.bots[bot_id]:
                self.bots[bot_id][key] = value
        
        # Always update timestamp
        self.bots[bot_id]["last_update"] = time.time()
        
        return self.bots[bot_id]
    
    def remove_bot(self, bot_id: int) -> bool:
        """Remove a bot from the simulation"""
        if bot_id not in self.bots:
            return False
            
        del self.bots[bot_id]
        return True
    
    def get_bot(self, bot_id: int) -> Dict[str, Any]:
        """Get a specific bot"""
        if bot_id not in self.bots:
            raise ValueError(f"Bot with ID {bot_id} does not exist")
            
        return self.bots[bot_id]
    
    def get_all_bots(self) -> Dict[int, Dict[str, Any]]:
        """Get all bots"""
        return self.bots
    
    def move_bot(self, bot_id: int, dx: float, dy: float) -> Dict[str, Any]:
        """Move a bot by the specified delta"""
        if bot_id not in self.bots:
            raise ValueError(f"Bot with ID {bot_id} does not exist")
            
        self.bots[bot_id]["x"] += dx
        self.bots[bot_id]["y"] += dy
        self.bots[bot_id]["velocity"]["x"] = dx
        self.bots[bot_id]["velocity"]["y"] = dy
        self.bots[bot_id]["last_update"] = time.time()
        
        # Simulate battery drain
        self.bots[bot_id]["battery"] -= 0.01 * (abs(dx) + abs(dy))
        if self.bots[bot_id]["battery"] < 0:
            self.bots[bot_id]["battery"] = 0
            self.bots[bot_id]["status"] = "battery_critical"
            
        return self.bots[bot_id]
    
    def update_bots(self) -> None:
        """Update all bots (e.g., for simulation)"""
        for bot_id in self.bots:
            # Simple random walk
            dx = random.uniform(-0.1, 0.1)
            dy = random.uniform(-0.1, 0.1)
            self.move_bot(bot_id, dx, dy)
    
    def generate_audio_signal(self, bot_id: int, 
                             target_pos: tuple,
                             frequency: float = 440,
                             duration: float = 1.0,
                             sampling_rate: int = 44100) -> Dict[str, Any]:
        """
        Generate simulated audio signal based on bot position and target
        """
        if bot_id not in self.bots:
            raise ValueError(f"Bot with ID {bot_id} does not exist")
        
        # Calculate distance to target
        bot_pos = (self.bots[bot_id]["x"], self.bots[bot_id]["y"])
        distance = math.sqrt(
            (bot_pos[0] - target_pos[0])**2 + 
            (bot_pos[1] - target_pos[1])**2
        )
        
        # Calculate time delay based on distance (speed of sound = 343 m/s)
        delay_samples = int(distance * sampling_rate / 343.0)
        
        # Generate basic sine wave
        t = np.arange(0, duration, 1/sampling_rate)
        signal = np.sin(2 * np.pi * frequency * t)
        
        # Add distance-based attenuation
        attenuation = 1.0 / (1.0 + distance)
        signal = signal * attenuation
        
        # Add delay
        delayed_signal = np.zeros(len(signal) + delay_samples)
        delayed_signal[delay_samples:] = signal
        
        # Add noise based on distance
        noise_level = 0.01 * (1 + distance)
        noise = np.random.normal(0, noise_level, len(delayed_signal))
        final_signal = delayed_signal + noise
        
        return {
            "bot_id": bot_id,
            "signal": final_signal.tolist(),
            "sampling_rate": sampling_rate,
            "distance": distance,
            "delay_samples": delay_samples
        }

# Create simulator instance
simulator = BotSimulator()

# For backward compatibility
mock_bots = simulator.bots
