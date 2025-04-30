import numpy as np
from filterpy.kalman import KalmanFilter
import matplotlib.pyplot as plt

class BayesianLocalizer:
    """
    Advanced Bayesian filter for swarm robot localization with measurement validation
    """
    def __init__(self, dim_x=4, dim_z=2, initial_pos=(0.0, 0.0)):
        # State: [x, y, vx, vy]
        self.kf = KalmanFilter(dim_x=dim_x, dim_z=dim_z)
        
        # Initialize state [x, y, vx, vy]
        self.kf.x = np.array([initial_pos[0], initial_pos[1], 0.0, 0.0])
        
        # State transition matrix (constant velocity model)
        dt = 0.1  # Time step
        self.kf.F = np.array([
            [1, 0, dt, 0],
            [0, 1, 0, dt],
            [0, 0, 1, 0],
            [0, 0, 0, 1]
        ])
        
        # Measurement function (we only measure position)
        self.kf.H = np.array([
            [1, 0, 0, 0],
            [0, 1, 0, 0]
        ])
        
        # Measurement noise
        self.kf.R = np.array([[0.1, 0], 
                              [0, 0.1]])
        
        # Process noise
        self.kf.Q = np.array([
            [0.01, 0, 0, 0],
            [0, 0.01, 0, 0],
            [0, 0, 0.1, 0],
            [0, 0, 0, 0.1]
        ])
        
        # Initial covariance
        self.kf.P = np.eye(4) * 1.0
        
        # Track history for visualization
        self.history = {
            'time': [],
            'x': [],
            'y': [],
            'measurements': []
        }
        self.time_step = 0
    
    def update(self, measurement, validate=True):
        """Update filter with new measurement"""
        self.time_step += 1
        
        # Prediction step
        self.kf.predict()
        
        # Validate measurement (basic outlier rejection)
        if validate:
            # Calculate Mahalanobis distance
            z = np.array(measurement)
            y = z - self.kf.H @ self.kf.x
            S = self.kf.H @ self.kf.P @ self.kf.H.T + self.kf.R
            d = y.T @ np.linalg.inv(S) @ y
            
            # Skip update if measurement is an outlier
            if d > 10.0:  # Threshold
                print(f"Outlier rejected at step {self.time_step}, distance: {d}")
                estimated = self.kf.x
                self._update_history(measurement, estimated)
                return estimated[:2].tolist()
        
        # Update step
        self.kf.update(np.array(measurement))
        
        # Extract position estimate
        estimated = self.kf.x
        self._update_history(measurement, estimated)
        
        # Return only position components [x, y]
        return estimated[:2].tolist()
    
    def _update_history(self, measurement, estimated):
        """Track history for debugging/visualization"""
        self.history['time'].append(self.time_step)
        self.history['x'].append(estimated[0])
        self.history['y'].append(estimated[1])
        self.history['measurements'].append(measurement)
    
    def plot_trajectory(self, save_path=None):
        """Visualize filter performance"""
        plt.figure(figsize=(10, 8))
        
        # Extract measurements
        measurements = np.array(self.history['measurements'])
        
        # Plot measurements and estimates
        plt.scatter(measurements[:, 0], measurements[:, 1], 
                   color='red', label='Measurements', alpha=0.5)
        plt.plot(self.history['x'], self.history['y'], 
                color='blue', label='Filter Estimate')
        
        plt.title('Target Localization Performance')
        plt.xlabel('X Position')
        plt.ylabel('Y Position')
        plt.legend()
        plt.grid(True)
        
        if save_path:
            plt.savefig(save_path)
        
        plt.close()
        return save_path
