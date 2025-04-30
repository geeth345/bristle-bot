from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, List, Optional, Union, Any
import numpy as np
import time
import uuid
import json
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

# Import custom modules
from localization_filter import BayesianLocalizer
from sound_processor import SoundLocalizer
from simulated_bots import mock_bots
from config import Config

# Initialize FastAPI
app = FastAPI(
    title="Swarm Robotics API",
    description="API for swarm robotics control and localization",
    version="0.2.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize filters
localizer = BayesianLocalizer(initial_pos=(1.0, 0.5))
sound_processor = SoundLocalizer(sampling_rate=Config.SAMPLING_RATE)

# In-memory storage for target history
target_history = []

# Data models
class AudioData(BaseModel):
    bot_id: str
    signal: List[float]
    timestamp: Optional[float] = None

class BotUpdateRequest(BaseModel):
    bot_id: int
    x: float
    y: float
    battery: Optional[float] = 100.0
    status: Optional[str] = "active"

class SoundLocalizationRequest(BaseModel):
    signals: Dict[str, List[float]]
    mic_positions: Dict[str, List[float]]
    mic_pairs: List[List[str]]
    mic_distances: List[float]

# Middleware for request timing
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    return response

# Bot management endpoints
@app.post("/update_bot")
async def update_bot(request: BotUpdateRequest):
    """Update bot position with validation"""
    if request.bot_id not in mock_bots:
        return {"error": "Invalid bot ID"}
    
    # Validate coordinate ranges
    if not (-100 <= request.x <= 100) or not (-100 <= request.y <= 100):
        raise HTTPException(status_code=400, detail="Coordinates out of valid range")
    
    # Update bot information
    mock_bots[request.bot_id] = {
        "x": request.x,
        "y": request.y,
        "battery": request.battery,
        "status": request.status,
        "last_update": time.time()
    }
    
    return {
        "status": "success", 
        "bot_id": request.bot_id, 
        "position": [request.x, request.y]
    }

@app.get("/bot/{bot_id}")
async def get_bot(bot_id: int):
    """Get information about a specific bot"""
    if bot_id not in mock_bots:
        raise HTTPException(status_code=404, detail="Bot not found")
    
    return {
        "id": bot_id,
        **mock_bots[bot_id]
    }

@app.get("/bots")
async def get_all_bots():
    """Get information about all bots"""
    return [{"id": k, **v} for k, v in mock_bots.items()]

# Target localization endpoints
@app.get("/localize_target")
async def localize_target():
    """
    Localize target using Bayesian filter with mock data
    """
    # Generate random measurement with some noise
    true_pos = [1.2, 0.8]
    noise = np.random.normal(0, 0.1, size=2)
    mock_measurement = [true_pos[0] + noise[0], true_pos[1] + noise[1]]
    
    # Update Bayesian filter
    estimated_pos = localizer.update(mock_measurement)
    
    # Store in history
    target_history.append({
        "timestamp": time.time(),
        "measurement": mock_measurement,
        "estimated": estimated_pos
    })
    
    # Keep only last 100 points
    if len(target_history) > 100:
        target_history.pop(0)
    
    return {
        "x": estimated_pos[0],
        "y": estimated_pos[1],
        "measurement": mock_measurement,
        "confidence": float(np.linalg.norm(localizer.kf.P[:2, :2]))
    }

@app.post("/process_audio")
async def process_audio(request: SoundLocalizationRequest):
    """
    Process audio signals from multiple bots to localize sound source
    """
    # Convert inputs to numpy arrays
    signals = {
        bot_id: np.array(signal) 
        for bot_id, signal in request.signals.items()
    }
    
    # Convert mic positions to tuples
    mic_positions = {
        bot_id: tuple(pos) 
        for bot_id, pos in request.mic_positions.items()
    }
    
    # Convert mic pairs to tuples
    mic_pairs = [tuple(pair) for pair in request.mic_pairs]
    
    # Process audio
    result = sound_processor.process_audio_signals(
        signals=signals,
        mic_positions=mic_positions,
        mic_pairs=mic_pairs,
        mic_distances=request.mic_distances
    )
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    
    # Update Bayesian filter with sound-based measurement
    estimated_pos = localizer.update(result["position"])
    
    # Generate correlation visualization for first pair
    vis_corr = None
    if len(mic_pairs) > 0:
        first_pair = mic_pairs[0]
        tdoa, corr = sound_processor.gcc_phat(
            signals[first_pair[0]], 
            signals[first_pair[1]]
        )
        vis_corr = sound_processor.visualize_correlation(corr, tdoa)
    
    return {
        "estimated_position": {
            "x": estimated_pos[0],
            "y": estimated_pos[1]
        },
        "raw_position": {
            "x": result["position"][0],
            "y": result["position"][1]
        },
        "tdoas": result["tdoas"],
        "angles": result["angles"],
        "visualization": vis_corr
    }

@app.get("/target_history")
async def get_target_history(limit: int = 50):
    """Get target localization history"""
    return target_history[-limit:]

@app.get("/visualize_trajectory")
async def visualize_trajectory():
    """Generate visualization of target trajectory"""
    image_path = localizer.plot_trajectory(save_path="trajectory.png")
    return {"image_path": image_path}

# Server configuration endpoints
@app.get("/config")
async def get_config():
    """Get server configuration"""
    return Config.to_dict()

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": time.time(),
        "version": app.__version__
    }

# Error handling
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"error": str(exc), "type": type(exc).__name__}
    )

# Serve static files (optional, for visualizations)
app.mount("/static", StaticFiles(directory="static"), name="static")

# Run server when executed directly
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app", 
        host=Config.API_HOST, 
        port=Config.FASTAPI_PORT, 
        reload=Config.DEBUG
    )
