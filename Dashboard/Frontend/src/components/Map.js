// components/Map.js
import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useSwarm } from '../context/SwarmContext';
import '../styles/Map.css';

const Map = ({ width = 800, height = 600, gridSize = 50 }) => {
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const trailCanvasRef = useRef(null);
  const [timeWindow, setTimeWindow] = useState(60);
  
  const { bots, beacons, target, connectionStatus, heatmapData, trajectories } = useSwarm();

  // Heatmap implementation
  const drawHeatmap = useCallback((ctx, data) => {
    if (!data || data.length === 0) return;
    
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    
    data.forEach(point => {
      const radius = point.radius || 40;
      const intensity = point.intensity || point.value || 1;
      
      const gradient = ctx.createRadialGradient(
        point.x, point.y, 0,
        point.x, point.y, radius
      );
      gradient.addColorStop(0, `rgba(255, 0, 0, ${Math.min(intensity/100, 0.8)})`);
      gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
      
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
    });
    
    ctx.restore();
  }, []);

  // Trajectories with null check
  const drawTrajectories = useCallback((ctx, mainCtx) => {
    const now = Date.now();
    trailCanvasRef.current.width = mainCtx.canvas.width;
    trailCanvasRef.current.height = mainCtx.canvas.height;
    const trailCtx = trailCanvasRef.current.getContext('2d');
    
    trailCtx.fillStyle = 'rgba(0, 0, 0, 0.05)';
    trailCtx.fillRect(0, 0, trailCanvasRef.current.width, trailCanvasRef.current.height);

    Object.entries(trajectories || {}).forEach(([botId, positions]) => {
      const validPositions = (positions || []).filter(pos => 
        pos.timestamp > now - timeWindow * 1000
      );
      
      if (validPositions.length > 1) {
        trailCtx.beginPath();
        trailCtx.strokeStyle = `hsla(${botId.charCodeAt(0) * 30}, 70%, 50%, 0.7)`;
        trailCtx.lineWidth = 2;
        
        validPositions.forEach((pos, index) => {
          index === 0 ? trailCtx.moveTo(pos.x, pos.y) : trailCtx.lineTo(pos.x, pos.y);
        });
        trailCtx.stroke();
      }
    });

    mainCtx.drawImage(trailCanvasRef.current, 0, 0);
  }, [timeWindow, trajectories]);

  // Target confidence
  const drawTargetConfidence = useCallback((ctx, position, confidence) => {
    const gradient = ctx.createRadialGradient(
      position.x, position.y, 0,
      position.x, position.y, 100
    );
    gradient.addColorStop(0, `rgba(255, 50, 50, ${confidence})`);
    gradient.addColorStop(1, `rgba(255, 50, 50, 0)`);
    
    ctx.beginPath();
    ctx.arc(position.x, position.y, 100, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
    
    ctx.beginPath();
    ctx.moveTo(position.x - 10, position.y);
    ctx.lineTo(position.x + 10, position.y);
    ctx.moveTo(position.x, position.y - 10);
    ctx.lineTo(position.x, position.y + 10);
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    ctx.font = '14px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(`(${position.x.toFixed(2)}, ${position.y.toFixed(2)})`, position.x, position.y - 20);
    ctx.fillText(`Confidence: ${(confidence * 100).toFixed(0)}%`, position.x, position.y - 40);
  }, []);

  // Main draw function
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawHeatmap(ctx, heatmapData);
    drawTrajectories(ctx, ctx);
    drawGrid(ctx, canvas.width, canvas.height, gridSize);

    Object.entries(beacons || {}).forEach(([id, beacon]) => {
      drawBeacon(ctx, id, beacon.position);
    });

    if (target?.position) {
      drawTargetConfidence(ctx, target.position, target.confidence);
    }

    const sortedBots = Object.entries(bots || {}).sort(([, a], [, b]) => {
      const statusOrder = { active: 3, searching: 2, returning: 1, inactive: 0 };
      return (statusOrder[b.status] || 0) - (statusOrder[a.status] || 0);
    });
    
    sortedBots.forEach(([id, bot]) => {
      if (bot?.position) drawBot(ctx, id, bot);
    });

    animationFrameRef.current = requestAnimationFrame(draw);
  }, [bots, beacons, target, gridSize, heatmapData, drawTrajectories, drawTargetConfidence, drawHeatmap]);

  // Initialization useEffect
  useEffect(() => {
    const canvas = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const trailCanvas = trailCanvasRef.current;
    trailCanvas.width = width * dpr;
    trailCanvas.height = height * dpr;
    const trailCtx = trailCanvas.getContext('2d');
    trailCtx.scale(dpr, dpr);

    animationFrameRef.current = requestAnimationFrame(draw);
    
    return () => {
      animationFrameRef.current && cancelAnimationFrame(animationFrameRef.current);
    };
  }, [width, height, draw]);

  // Helper functions remain unchanged
  const drawGrid = (ctx, width, height, gridSize) => {
    ctx.beginPath();
    ctx.strokeStyle = '#2c2c2c';
    ctx.lineWidth = 1;
    
    for (let x = 0; x <= width; x += gridSize) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    
    for (let y = 0; y <= height; y += gridSize) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    
    ctx.stroke();
    
    ctx.fillStyle = '#6c6c6c';
    ctx.font = '12px Arial';
    ctx.textAlign = 'start';
    
    for (let x = 0; x <= width; x += gridSize) {
      if (x % (gridSize * 2) === 0) {
        ctx.fillText((x / gridSize).toString(), x + 5, 15);
      }
    }
    
    for (let y = 0; y <= height; y += gridSize) {
      if (y % (gridSize * 2) === 0) {
        ctx.fillText((y / gridSize).toString(), 5, y + 15);
      }
    }
  };

  const drawBeacon = (ctx, id, position) => {
    if (!position) return;
    const { x, y } = position;
    
    const gradient = ctx.createRadialGradient(x, y, 2, x, y, 15);
    gradient.addColorStop(0, '#4287f5');
    gradient.addColorStop(1, 'rgba(66, 135, 245, 0)');
    
    ctx.beginPath();
    ctx.arc(x, y, 15, 0, 2 * Math.PI);
    ctx.fillStyle = gradient;
    ctx.fill();
    
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, 2 * Math.PI);
    ctx.fillStyle = '#85b3ff';
    ctx.fill();
    
    ctx.font = '14px Arial';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.fillText(`Beacon ${id}`, x, y - 15);
  };

  const drawBot = (ctx, id, bot) => {
    const { position, battery = 100, status = 'inactive' } = bot;
    if (!position) return;
    const { x, y } = position;
    
    const statusColors = {
      active: '#4caf50',
      searching: '#ff9800',
      returning: '#2196f3',
      inactive: '#9e9e9e',
    };
    
    const color = statusColors[status] || '#f44336';
    
    ctx.save();
    ctx.translate(x, y);
    
    if (status === 'searching') {
      const time = Date.now() / 1000;
      const scale = 1 + Math.sin(time * 5) * 0.05;
      ctx.scale(scale, scale);
    }
    
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(10, 8);
    ctx.lineTo(-10, 8);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    ctx.beginPath();
    ctx.rect(-15, 12, 30, 5);
    ctx.fillStyle = '#333333';
    ctx.fill();
    
    const batteryWidth = Math.max(0, Math.min(30 * (battery / 100), 30));
    if (batteryWidth > 0) {
      ctx.beginPath();
      ctx.rect(-15, 12, batteryWidth, 5);
      ctx.fillStyle = battery > 70 ? '#4caf50' : battery > 30 ? '#ff9800' : '#f44336';
      ctx.fill();
    }
    
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

  return (
    <div className="map-container">
      <canvas ref={canvasRef} className="main-canvas" />
      <canvas ref={trailCanvasRef} style={{ display: 'none' }} />
      
      <div className="time-controls">
        <input
          type="range"
          min="10"
          max="300"
          value={timeWindow}
          onChange={(e) => setTimeWindow(Number(e.target.value))}
        />
        <span>Time Window: {timeWindow}s</span>
      </div>
      
      {connectionStatus !== 'connected' && (
        <div className="map-overlay">
          <span>{connectionStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}</span>
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

export default Map;
