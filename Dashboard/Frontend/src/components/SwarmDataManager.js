// components/SwarmDataManager.js
import React, { useEffect, useCallback, useMemo } from 'react';
import { debounce } from 'lodash';
import useWebSocketOptimized, { ReadyState } from '../hooks/useWebSocketOptimized';
import { useSwarm } from '../context/SwarmContext';
import usePreventMemoryLeaks from '../hooks/usePreventMemoryLeaks';

const SwarmDataManager = () => {
  const {
    updateBot,
    updateBeacon,
    updateTarget,
    updateIntensityGrid,
    updateTrajectories,
    setConnectionStatus,
    setError
  } = useSwarm();
  
  const { isMounted } = usePreventMemoryLeaks();

  const generateClientId = () => {
    return localStorage.getItem('clientId') || 
      `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const debouncedSetIntensityGrid = useMemo(
    () => debounce((data) => {
      if (isMounted.current) updateIntensityGrid(data);
    }, 100),
    [updateIntensityGrid, isMounted]
  );

  const mapReadyStateToStatus = useCallback((readyState) => {
    const statusMap = {
      [ReadyState.CONNECTING]: 'connecting',
      [ReadyState.OPEN]: 'connected',
      [ReadyState.CLOSING]: 'closing',
      [ReadyState.CLOSED]: 'disconnected',
      [ReadyState.UNINSTANTIATED]: 'disconnected',
    };
    return statusMap[readyState] || 'disconnected';
  }, []);

  const handleMessage = useCallback((event) => {
    try {
      const data = JSON.parse(event.data);
      switch (data.type) {
        case 'bot_update':
          updateBot(data.id, {
            position: data.position,
            battery: data.battery,
            status: data.status,
            intensity: data.intensity,
          });
          break;
        case 'beacon_update':
          updateBeacon(data.id, { position: data.position });
          break;
        case 'target_update':
          updateTarget({
            position: data.position,
            confidence: data.confidence,
          });
          break;
        case 'intensity_grid':
          debouncedSetIntensityGrid(data.data);
          break;
        case 'trajectory_history':
          updateTrajectories(data.data);
          break;
        case 'reconnection_successful':
          setError(null);
          break;
        case 'error':
          setError(data.message || 'Unknown error');
          break;
        default:
          console.warn('Unknown message type:', data.type);
      }
    } catch (e) {
      console.error('Failed to parse WebSocket message:', e);
    }
  }, [updateBot, updateBeacon, updateTarget, updateTrajectories, debouncedSetIntensityGrid, setError]);

  useEffect(() => {
    const clientId = generateClientId();
    localStorage.setItem('clientId', clientId);
    
    const { readyState } = useWebSocketOptimized(
      `ws://localhost:8000/ws/swarm?clientId=${clientId}`,
      {
        onOpen: () => console.log('WebSocket connected'),
        onClose: () => console.log('WebSocket disconnected'),
        onMessage: handleMessage,
        onError: (error) => {
          console.error('WebSocket error:', error);
          setError('Connection error: ' + (error.message || 'Unknown error'));
        },
        reconnectAttempts: 10,
        reconnectInterval: 1000,
        throttleMs: 100,
        debugMode: false,
      }
    );
    
    setConnectionStatus(mapReadyStateToStatus(readyState));
  }, [handleMessage, setConnectionStatus, mapReadyStateToStatus]);

  return null;
};

export default SwarmDataManager;
