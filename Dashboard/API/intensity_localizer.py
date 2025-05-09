import numpy as np
from config import Config
from typing import List, Dict

class IntensityLocalizer:
    """
    dB-based sound source localization using hybrid weighted centroid and grid search
    Implements inverse square law for distance estimation
    """
    def __init__(self):
        self.epsilon = 1e-9  # Prevent division by zero
        
    def db_to_distance(self, source_db: float, measured_db: float) -> float:
        """
        Convert dB difference to distance using inverse square law:
        distance = reference_distance * 10^((source_db - measured_db)/20)
        """
        return Config.REFERENCE_DISTANCE * 10 ** ((source_db - measured_db) / 20)

    def calculate_confidence(self, error: float) -> float:
        """Dynamic confidence scoring based on localization error"""
        return max(0.0, 1.0 - Config.DECAY_FACTOR * abs(error))

    def localize(self, measurements: List[Dict]) -> Dict:
        """Robust localization with multi-stage refinement"""
        if not measurements:
            raise ValueError("Empty measurement list")

        # Filter valid measurements
        valid = [m for m in measurements if 30 <= m['db'] <= 150]
        if len(valid) < 3:
            # Not enough points for robust localization
            return {'x': 0, 'y': 0, 'source_db': 94, 'confidence': 0.0}

        # Robust source dB estimation using median
        sorted_db = sorted([m['db'] for m in valid], reverse=True)
        source_db = np.median(sorted_db[:3]) + 6.0

        # Weighted centroid calculation with inverse square weights
        weights = []
        positions = []
        for m in valid:
            dist = self.db_to_distance(source_db, m['db'])
            weight = 1 / (dist ** 2 + self.epsilon)
            weights.append(weight)
            positions.append((m['position'].x, m['position'].y))

        total_weight = sum(weights)
        x = sum(p[0] * w for p, w in zip(positions, weights)) / total_weight
        y = sum(p[1] * w for p, w in zip(positions, weights)) / total_weight

        # Multi-resolution grid search refinement
        best = (x, y)
        for resolution in [0.3, 0.1, 0.05]:
            x_range = np.arange(best[0] - 0.5, best[0] + 0.5, resolution)
            y_range = np.arange(best[1] - 0.5, best[1] + 0.5, resolution)
            best = self._grid_search(valid, x_range, y_range, best)

        error = np.sqrt((best[0] - x) ** 2 + (best[1] - y) ** 2)
        confidence = self.calculate_confidence(error)

        return {
            'x': best[0], 
            'y': best[1], 
            'source_db': source_db, 
            'confidence': confidence
        }


    def _grid_search(self, measurements, x_range, y_range, current_best):
        """Refine localization with grid search"""
        min_error = float('inf')
        best = current_best
        for x in x_range:
            for y in y_range:
                error = 0
                for m in measurements:
                    dx = x - m['position'].x
                    dy = y - m['position'].y
                    dist = np.sqrt(dx ** 2 + dy ** 2)
                    expected_db = 94 - 20 * np.log10(max(dist, 0.1))
                    error += abs(m['db'] - expected_db)
                if error < min_error:
                    min_error = error
                    best = (x, y)
        return best
    
    def _estimate_db(self, x: float, y: float, measurement: dict) -> float:
        """Estimate expected dB at given position"""
        dx = x - measurement['position'].x
        dy = y - measurement['position'].y
        distance = np.sqrt(dx**2 + dy**2)
        return Config.REFERENCE_DB - 20 * np.log10(max(distance, 0.1))