import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    """
    Central configuration class with environment variables and default values
    Implements dB-based localization parameters and Kalman filter settings
    """
    # API Configuration
    API_HOST = os.getenv("API_HOST", "0.0.0.0")
    FASTAPI_PORT = int(os.getenv("FASTAPI_PORT", "8000"))
    DEBUG = os.getenv("DEBUG", "True").lower() in ("true", "1", "t")
    
    # Sound Localization Parameters
    REFERENCE_DISTANCE = 1.0  # Reference distance in meters
    REFERENCE_DB = 94.0       # Reference sound level at 1 meter
    DECAY_FACTOR = 0.2        # Confidence decay per error unit
    MIN_DB = 30.0             # Minimum valid dB value
    MAX_DB = 150.0            # Maximum valid dB value
    
    # Kalman Filter Configuration
    PROCESS_NOISE = 0.01     # Process noise covariance
    MEASUREMENT_NOISE = 0.1   # Measurement noise covariance

    @classmethod
    def to_dict(cls):
        """Serialize configuration for API endpoints"""
        return {k: v for k, v in cls.__dict__.items() 
                if not k.startswith('_') and not callable(v)}
