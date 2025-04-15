import numpy as np
from scipy import signal
import matplotlib.pyplot as plt
from typing import List, Tuple, Dict, Any, Optional

class SoundLocalizer:
    """
    Implements GCC-PHAT algorithm for sound source localization
    """
    def __init__(self, sampling_rate: int = 44100):
        self.sampling_rate = sampling_rate
        self.speed_of_sound = 343.0  # m/s at room temperature
        
    def gcc_phat(self, signal1: np.ndarray, signal2: np.ndarray) -> Tuple[float, np.ndarray]:
        """
        Generalized Cross Correlation with Phase Transform
        
        Parameters:
        -----------
        signal1, signal2 : np.ndarray
            Audio signals from two microphones
            
        Returns:
        --------
        tdoa : float
            Time difference of arrival in seconds
        correlation : np.ndarray
            Correlation values for visualization
        """
        # Ensure signals are the same length
        min_len = min(len(signal1), len(signal2))
        signal1 = signal1[:min_len]
        signal2 = signal2[:min_len]
        
        # Compute FFT of signals
        X1 = np.fft.rfft(signal1)
        X2 = np.fft.rfft(signal2)
        
        # Compute cross-spectrum
        G = X1 * np.conj(X2)
        
        # Apply phase transform
        eps = 1e-10  # Avoid division by zero
        G_phat = G / (np.abs(G) + eps)
        
        # Compute cross-correlation
        correlation = np.fft.irfft(G_phat)
        
        # Find delay
        max_idx = np.argmax(correlation)
        if max_idx > len(correlation) // 2:
            max_idx = max_idx - len(correlation)
        
        # Convert to seconds
        tdoa = max_idx / self.sampling_rate
        
        return tdoa, correlation
    
    def estimate_angle(self, tdoa: float, mic_distance: float) -> float:
        """
        Estimate angle of arrival from TDOA
        
        Parameters:
        -----------
        tdoa : float
            Time difference of arrival in seconds
        mic_distance : float
            Distance between microphones in meters
            
        Returns:
        --------
        angle : float
            Estimated angle in degrees
        """
        if abs(tdoa) >= mic_distance / self.speed_of_sound:
            # Cap at maximum possible angle
            tdoa = np.sign(tdoa) * mic_distance / self.speed_of_sound
            
        # theta = arcsin(TDOA * c / d)
        angle = np.arcsin(tdoa * self.speed_of_sound / mic_distance)
        return np.degrees(angle)
    
    def estimate_position(self, angle1: float, pos1: Tuple[float, float], 
                         angle2: float, pos2: Tuple[float, float]) -> Tuple[float, float]:
        """
        Triangulate position from two angle measurements
        
        Parameters:
        -----------
        angle1, angle2 : float
            Angles in degrees from two microphone pairs
        pos1, pos2 : Tuple[float, float]
            Positions of the microphone pairs
            
        Returns:
        --------
        position : Tuple[float, float]
            Estimated position (x, y)
        """
        # Convert angles to radians
        angle1_rad = np.radians(angle1)
        angle2_rad = np.radians(angle2)
        
        # Create line equations: y = m*x + b
        m1 = np.tan(angle1_rad)
        m2 = np.tan(angle2_rad)
        
        b1 = pos1[1] - m1 * pos1[0]
        b2 = pos2[1] - m2 * pos2[0]
        
        # Solve for intersection point
        if abs(m1 - m2) < 1e-6:  # Nearly parallel
            # Return midpoint as fallback
            return ((pos1[0] + pos2[0]) / 2, (pos1[1] + pos2[1]) / 2)
        
        x = (b2 - b1) / (m1 - m2)
        y = m1 * x + b1
        
        return (x, y)

    def process_audio_signals(self, signals: Dict[str, np.ndarray], 
                             mic_positions: Dict[str, Tuple[float, float]], 
                             mic_pairs: List[Tuple[str, str]], 
                             mic_distances: List[float]) -> Dict[str, Any]:
        """
        Process multiple audio signals to estimate sound source position
        
        Parameters:
        -----------
        signals : Dict[str, np.ndarray]
            Dictionary of audio signals from each bot/microphone
        mic_positions : Dict[str, Tuple[float, float]]
            Dictionary of microphone positions
        mic_pairs : List[Tuple[str, str]]
            List of microphone pairs to use for TDOA estimation
        mic_distances : List[float]
            Distances between each microphone pair
            
        Returns:
        --------
        result : Dict[str, Any]
            Dictionary with estimated position and diagnostics
        """
        if len(mic_pairs) < 2:
            return {"error": "Need at least 2 microphone pairs for triangulation"}
        
        # Calculate TDOAs
        tdoas = []
        angles = []
        
        for i, (mic1, mic2) in enumerate(mic_pairs):
            if mic1 not in signals or mic2 not in signals:
                return {"error": f"Missing audio signal for {mic1} or {mic2}"}
            
            tdoa, corr = self.gcc_phat(signals[mic1], signals[mic2])
            angle = self.estimate_angle(tdoa, mic_distances[i])
            
            tdoas.append(tdoa)
            angles.append(angle)
        
        # Triangulate position
        positions = []
        for i in range(len(mic_pairs)-1):
            for j in range(i+1, len(mic_pairs)):
                pos = self.estimate_position(
                    angles[i], mic_positions[mic_pairs[i][0]],
                    angles[j], mic_positions[mic_pairs[j][0]]
                )
                positions.append(pos)
        
        # Average all estimated positions
        if positions:
            avg_x = sum(p[0] for p in positions) / len(positions)
            avg_y = sum(p[1] for p in positions) / len(positions)
            
            return {
                "position": (avg_x, avg_y),
                "tdoas": tdoas,
                "angles": angles
            }
        else:
            return {"error": "Could not estimate position"}
    
    def visualize_correlation(self, correlation: np.ndarray, tdoa: float) -> str:
        """Generate visualization of cross-correlation result"""
        plt.figure(figsize=(10, 6))
        
        # Time axis in milliseconds
        x_axis = np.linspace(-len(correlation)//2, len(correlation)//2, len(correlation))
        x_axis = x_axis / self.sampling_rate * 1000  # Convert to ms
        
        plt.plot(x_axis, np.roll(correlation, len(correlation)//2))
        
        # Mark the detected peak
        tdoa_ms = tdoa * 1000  # Convert to ms
        max_val = np.max(correlation)
        plt.plot([tdoa_ms, tdoa_ms], [0, max_val], 'r--')
        
        plt.title('GCC-PHAT Cross-Correlation')
        plt.xlabel('Time Delay (ms)')
        plt.ylabel('Correlation')
        plt.grid(True)
        
        # Save to buffer
        from io import BytesIO
        buf = BytesIO()
        plt.savefig(buf, format='png')
        plt.close()
        
        # Convert to base64 for embedding in web
        import base64
        data = base64.b64encode(buf.getbuffer()).decode('ascii')
        return f"data:image/png;base64,{data}"
