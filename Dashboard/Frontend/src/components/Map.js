// components/Map.js
import React, { useRef, useEffect, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useSwarm } from '../context/SwarmContext';
import '../styles/Map.css';

/**
 * Map visualization component for sound localization system
 * Uses Canvas for optimal rendering performance on Raspberry Pi
 * 
 * @param {Object} props - Component props
 * @returns {JSX.Element} Map component
 */
const Map = ({ width = 800, height = 600, gridSize = 50 }) => {
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const { bots, beacons, target, connectionStatus } = useSwarm();
  
  /**
   * Main drawing function - separated from data updates for performance
   * Uses requestAnimationFrame for smooth animation
   */
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Clear canvas with a single operation
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw grid (optimized to reduce context switches)
    drawGrid(ctx, canvas.width, canvas.height, gridSize);
    
    // Draw beacons
    Object.entries(beacons).forEach(([id, beacon]) => {
      drawBeacon(ctx, id, beacon.position);
    });
    
    // Draw target if exists
    if (target && target.position) {
      drawTarget(ctx, target.position, target.confidence);
    }
    
    // Draw bots (sorted by status to ensure active bots render on top)
    const sortedBots = Object.entries(bots).sort(([, a], [, b]) => {
      const statusOrder = { active: 3, searching: 2, returning: 1, inactive: 0 };
      return (statusOrder[b.status] || 0) - (statusOrder[a.status] || 0);
    });
    
    sortedBots.forEach(([id, bot]) => {
      if (bot.position) drawBot(ctx, id, bot);
    });
    
    // Request next frame using RAF for smooth animation
    animationFrameRef.current = requestAnimationFrame(draw);
  }, [bots, beacons, target, gridSize]);
  
  // Initial setup and cleanup
  useEffect(() => {
    // Set canvas dimensions with device pixel ratio for sharper rendering
    const canvas = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    
    // Scale context to match CSS dimensions
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    
    // Start animation loop
    animationFrameRef.current = requestAnimationFrame(draw);
    
    // Cleanup animation on unmount to prevent memory leaks
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [width, height, draw]);
  
  /**
   * Grid drawing function - optimized for fewer context changes
   * Draws all lines in single path, minimizes style changes
   */
  const drawGrid = (ctx, width, height, gridSize) => {
    ctx.beginPath();
    ctx.strokeStyle = '#2c2c2c';
    ctx.lineWidth = 1;
    
    // Draw all vertical lines in one path
    for (let x = 0; x <= width; x += gridSize) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    
    // Draw all horizontal lines in same path
    for (let y = 0; y <= height; y += gridSize) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    
    // Single stroke operation for all lines
    ctx.stroke();
    
    // Draw coordinates with single style setting
    ctx.fillStyle = '#6c6c6c';
    ctx.font = '12px Arial';
    ctx.textAlign = 'start';
    
    // X coordinates
    for (let x = 0; x <= width; x += gridSize) {
      if (x % (gridSize * 2) === 0) { // Only label every other line for readability
        ctx.fillText((x / gridSize).toString(), x + 5, 15);
      }
    }
    
    // Y coordinates
    for (let y = 0; y <= height; y += gridSize) {
      if (y % (gridSize * 2) === 0) {
        ctx.fillText((y / gridSize).toString(), 5, y + 15);
      }
    }
  };
  
  /**
   * Beacon drawing function
   * Creates visual representation of a fixed sound beacon
   */
  const drawBeacon = (ctx, id, position) => {
    if (!position) return;
    const { x, y } = position;
    
    // Draw beacon with glow effect for visibility
    ctx.beginPath();
    const gradient = ctx.createRadialGradient(x, y, 2, x, y, 15);
    gradient.addColorStop(0, '#4287f5');
    gradient.addColorStop(1, 'rgba(66, 135, 245, 0)');
    ctx.fillStyle = gradient;
    ctx.arc(x, y, 15, 0, 2 * Math.PI);
    ctx.fill();
    
    // Draw beacon core
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, 2 * Math.PI);
    ctx.fillStyle = '#85b3ff';
    ctx.fill();
    
    // Draw label
    ctx.font = '14px Arial';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.fillText(`Beacon ${id}`, x, y - 15);
  };
  
  /**
   * Bot drawing function with visual indicators
   * Creates visual representation of a mobile bot with status and battery
   */
  const drawBot = (ctx, id, bot) => {
    const { position, battery = 100, status = 'inactive' } = bot;
    if (!position) return;
    const { x, y } = position;
    
    // Determine color based on status
    const statusColors = {
      active: '#4caf50',    // Green
      searching: '#ff9800', // Orange
      returning: '#2196f3', // Blue
      inactive: '#9e9e9e',  // Grey
    };
    const color = statusColors[status] || '#f44336'; // Red fallback
    
    // Draw directional bot shape
    ctx.save();
    ctx.translate(x, y);
    
    // Add subtle animation based on status
    if (status === 'searching') {
      const time = Date.now() / 1000;
      const scale = 1 + Math.sin(time * 5) * 0.05;
      ctx.scale(scale, scale);
    }
    
    // Bot body
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(10, 8);
    ctx.lineTo(-10, 8);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    
    // Bot outline for better visibility
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Battery indicator background
    ctx.beginPath();
    ctx.rect(-15, 12, 30, 5);
    ctx.fillStyle = '#333333';
    ctx.fill();
    
    // Battery level fill
    const batteryWidth = Math.max(0, Math.min(30 * (battery / 100), 30));
    if (batteryWidth > 0) {
      ctx.beginPath();
      ctx.rect(-15, 12, batteryWidth, 5);
      
      // Color based on battery level
      if (battery > 70) ctx.fillStyle = '#4caf50';
      else if (battery > 30) ctx.fillStyle = '#ff9800';
      else ctx.fillStyle = '#f44336';
      
      ctx.fill();
    }
    
    // Bot label with contrasting outline for readability
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.strokeText(id, 0, -2);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(id, 0, -2);
    
    ctx.restore();
  };
  
  /**
   * Target drawing function with confidence visualization
   * Creates visual representation of detected sound source with
   * visual indication of confidence level
   */
  const drawTarget = (ctx, position, confidence = 0.8) => {
    const { x, y } = position;
    
    // Draw target with confidence visualization
    const maxRadius = 50;
    const precisionRadius = maxRadius * (1 - confidence);
    
    // Outer confidence area
    ctx.beginPath();
    ctx.arc(x, y, maxRadius, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(255, 0, 0, 0.1)';
    ctx.fill();
    
    // Middle confidence area
    ctx.beginPath();
    ctx.arc(x, y, maxRadius - precisionRadius/2, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
    ctx.fill();
    
    // Inner confidence area
    ctx.beginPath();
    ctx.arc(x, y, precisionRadius, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
    ctx.fill();
    
    // Center point with pulsing animation
    const time = Date.now() / 1000;
    const pulseScale = 1 + Math.sin(time * 3) * 0.2;
    const centerSize = 4 * pulseScale;
    
    ctx.beginPath();
    ctx.arc(x, y, centerSize, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
    ctx.fill();
    
    // Crosshairs for precise location
    ctx.beginPath();
    ctx.moveTo(x - 10, y);
    ctx.lineTo(x + 10, y);
    ctx.moveTo(x, y - 10);
    ctx.lineTo(x, y + 10);
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Coordinates with confidence
    ctx.font = '14px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(`(${x.toFixed(2)}, ${y.toFixed(2)})`, x, y - 20);
    ctx.fillText(`Confidence: ${(confidence * 100).toFixed(0)}%`, x, y - 40);
  };
  
  return (
    <div className="map-container">
      <canvas 
        ref={canvasRef} 
        style={{ width: `${width}px`, height: `${height}px` }}
      />
      {connectionStatus !== 'connected' && (
        <div className="map-overlay">
          <span>Connecting to sound localization system...</span>
        </div>
      )}
    </div>
  );
};

Map.propTypes = {
  width: PropTypes.number,
  height: PropTypes.number,
  gridSize: PropTypes.number,
};

// Use React.memo to prevent unnecessary re-renders when props haven't changed
export default React.memo(Map);
