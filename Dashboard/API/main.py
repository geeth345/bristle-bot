from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from models import SoundIntensityReading, LocalizationResult, Position
from intensity_localizer import IntensityLocalizer
from localization_filter import LocalizationFilter
from typing import List
from models import Position
from config import Config
import time

app = FastAPI(title="Swarm Sound Localization API",
             description="Real-time sound source localization using dB measurements",
             version="1.0.0")

# Enable CORS for web interface
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

# Initialize components
localizer = IntensityLocalizer()
kalman_filter = LocalizationFilter()
target_history = []
MAX_HISTORY = 1000  # Prevent memory overflow

@app.post("/localize", 
         response_model=LocalizationResult,
         summary="Localize sound source",
         description="Process dB measurements from swarm to estimate sound source position")
async def localize(measurements: List[SoundIntensityReading]):
    """
    Endpoint for sound source localization
    - Converts measurements to internal format
    - Performs dB-based localization
    - Applies Kalman filtering
    - Stores result in history
    """
    try:
        # Validate input
        if not measurements:
            raise HTTPException(400, "No measurements provided")
            
        # Convert to localization format
        raw_data = [{
            'db': m.db,
            'position': m.position
        } for m in measurements]

        # Perform localization
        estimate = localizer.localize(raw_data)
        
        # Apply Kalman filtering
        filtered_pos = kalman_filter.update(
            Position(x=estimate['x'], y=estimate['y'])
        )

        # Create result object
        result = LocalizationResult(
            position=filtered_pos,
            source_db=estimate['source_db'],
            confidence=estimate['confidence']
        )

        # Maintain history
        target_history.append(result)
        if len(target_history) > MAX_HISTORY:
            target_history.pop(0)

        return result

    except Exception as e:
        raise HTTPException(500, f"Localization failed: {str(e)}")

@app.get("/history",
        response_model=List[LocalizationResult],
        summary="Get localization history",
        description="Returns most recent localization results")
async def get_history(limit: int = 50):
    """Retrieve historical localization data"""
    return target_history[-limit:]

@app.get("/config",
        summary="Get current configuration",
        description="Returns active configuration parameters")
async def get_config():
    """Return current configuration"""
    return Config.to_dict()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=Config.API_HOST, port=Config.FASTAPI_PORT)
