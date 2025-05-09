from pydantic import BaseModel, Field, validator
from typing import List, Optional
import time
import uuid
from config import Config

class Position(BaseModel):
    """2D position model with validation"""
    x: float = Field(..., ge=-100, le=100, description="X coordinate in meters")
    y: float = Field(..., ge=-100, le=100, description="Y coordinate in meters")

class SoundIntensityReading(BaseModel):
    """Sound measurement model from individual bots"""
    bot_id: str = Field(..., min_length=3, description="Unique bot identifier")
    db: float = Field(..., description="Measured sound level in dB")
    position: Position
    timestamp: float = Field(
        default_factory=time.time,
        description="Measurement timestamp in seconds since epoch"
    )

    @validator('db')
    def validate_db(cls, v):
        """Ensure dB values are within operational range"""
        if not (Config.MIN_DB <= v <= Config.MAX_DB):
            raise ValueError(
                f"Invalid dB value {v}. Must be between {Config.MIN_DB}-{Config.MAX_DB}"
            )
        return round(v, 2)

class LocalizationResult(BaseModel):
    """Localization result with confidence scoring"""
    id: str = Field(
        default_factory=lambda: str(uuid.uuid4()),
        description="Unique result identifier"
    )
    position: Position
    source_db: float = Field(
        ..., 
        ge=Config.MIN_DB, 
        le=Config.MAX_DB,
        description="Estimated source sound level"
    )
    confidence: float = Field(
        ..., 
        ge=0.0, 
        le=1.0,
        description="Estimation confidence score"
    )
    timestamp: float = Field(
        default_factory=time.time,
        description="Result generation timestamp"
    )