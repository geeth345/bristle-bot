import random
import numpy as np
from config import Config
from models import Position

class BotSimulator:
    """Simulated swarm environment generator"""
    def __init__(self, num_bots=5):
        self.bots = {
            str(i): {
                'id': str(i),
                'position': {
                    'x': random.uniform(0, 5),
                    'y': random.uniform(0, 5)
                },
                'battery': 100.0
            } for i in range(num_bots)
        }

    def generate_measurements(self, source_pos: tuple, noise: float = 1.0) -> list:
        """
        Generate simulated dB measurements with Gaussian noise
        Args:
            source_pos: (x, y) tuple of sound source position
            noise: Standard deviation of measurement noise
        Returns:
            List of SoundIntensityReading-like dictionaries
        """
        measurements = []
        for bid, bot in self.bots.items():
            dx = bot['position']['x'] - source_pos[0]
            dy = bot['position']['y'] - source_pos[1]
            distance = np.sqrt(dx**2 + dy**2)
            true_db = Config.REFERENCE_DB - 20 * np.log10(max(distance, 0.1))
            measured_db = true_db + random.gauss(0, noise)
            measurements.append({
                'bot_id': bid,
                'db': measured_db,
                'position': Position(**bot['position'])
            })
        return measurements
