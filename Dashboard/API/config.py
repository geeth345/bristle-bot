import os
from dotenv import load_dotenv
from typing import Dict, Any

# Load environment variables from .env file
load_dotenv()

class Config:
    """Configuration singleton for the API"""
    
    # API settings
    API_HOST = os.getenv("API_HOST", "0.0.0.0")
    FASTAPI_PORT = int(os.getenv("FASTAPI_PORT", "8000"))
    FLASK_PORT = int(os.getenv("FLASK_PORT", "5000"))
    DEBUG = os.getenv("DEBUG", "True").lower() in ("true", "1", "t")
    
    # Bayesian filter settings
    FILTER_PROCESS_NOISE = float(os.getenv("FILTER_PROCESS_NOISE", "0.01"))
    FILTER_MEASUREMENT_NOISE = float(os.getenv("FILTER_MEASUREMENT_NOISE", "0.1"))
    
    # Sound processing
    SAMPLING_RATE = int(os.getenv("SAMPLING_RATE", "44100"))
    SPEED_OF_SOUND = float(os.getenv("SPEED_OF_SOUND", "343.0"))  # m/s
    
    # BLE communication
    BLE_CHANNEL = int(os.getenv("BLE_CHANNEL", "37"))
    BLE_TX_POWER = int(os.getenv("BLE_TX_POWER", "0"))  # dBm
    
    # Rate limiting
    RATE_LIMIT_STANDARD = os.getenv("RATE_LIMIT_STANDARD", "10/minute")
    RATE_LIMIT_UPDATE_BOT = os.getenv("RATE_LIMIT_UPDATE_BOT", "30/minute")
    
    @classmethod
    def to_dict(cls) -> Dict[str, Any]:
        """Convert config to dictionary for frontend"""
        return {
            key: value for key, value in cls.__dict__.items()
            if not key.startswith('_') and not callable(value)
        }
