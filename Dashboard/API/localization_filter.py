from filterpy.kalman import KalmanFilter
import numpy as np
from config import Config
from models import Position

class LocalizationFilter:
    """
    Kalman filter implementation for position smoothing
    Models velocity for better trajectory prediction
    """
    def __init__(self):
        self.kf = KalmanFilter(dim_x=4, dim_z=2)
        
        # State vector: [x, y, vx, vy]
        self.kf.x = np.array([0.0, 0.0, 0.0, 0.0])
        
        # State transition matrix (constant velocity model)
        self.kf.F = np.array([
            [1, 0, 0.4, 0],   # x = x + 0.4*vx
            [0, 1, 0, 0.4],   # y = y + 0.4*vy
            [0, 0, 1, 0],     # vx remains
            [0, 0, 0, 1]      # vy remains
        ])
        
        # Measurement function (position only)
        self.kf.H = np.array([
            [1, 0, 0, 0],
            [0, 1, 0, 0]
        ])
        
        # Covariance matrices
        self.kf.R = np.eye(2) * Config.MEASUREMENT_NOISE
        self.kf.Q = np.eye(4) * Config.PROCESS_NOISE
        self.kf.P = np.eye(4) * 10.0  # Initial uncertainty

    def update(self, position: 'Position') -> 'Position':
        """Update filter with new position measurement"""
        self.kf.predict()
        self.kf.update(np.array([position.x, position.y]))
        return Position(
            x=float(self.kf.x[0]),
            y=float(self.kf.x[1])
        )
    