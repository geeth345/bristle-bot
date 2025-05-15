import { useEffect, useCallback, useRef } from 'react';
import useWebSocketOptimized, { ReadyState } from '../hooks/useWebSocketOptimized';
import { useSwarm } from '../context/SwarmContext';
import usePreventMemoryLeaks from '../hooks/usePreventMemoryLeaks';

/**
 * Component that manages data flow between WebSocket and Swarm state
 * This component doesn't render anything visible but handles
 * all the communication with the backend
 */
const SwarmDataManager = () => {
  console.log('SwarmDataManager rendering');

  // Strict Mode handling refs
  const isComponentMounted = useRef(true);
  const connectionId = useRef(0);

  const {
    swarmState, // Added for stale closure prevention
    updateBot,
    updateBeacon,
    updateTarget,
    updateHeatmap,
    updateTrajectory,
    setConnectionStatus,
    setError,
    updateEntireSwarm // Added for batch updates
  } = useSwarm();
  
  const { isMounted, safeUpdate } = usePreventMemoryLeaks();
  const statusUpdateTimeoutRef = useRef(null);
  const lastMessageTime = useRef(Date.now());

  // Component mount tracking
  useEffect(() => {
    console.log('SwarmDataManager mounted');
    return () => {
      isComponentMounted.current = false;
      console.log('SwarmDataManager unmounted');
    };
  }, []);

  /**
   * Maps WebSocket ready state to connection status string
   * for use in the UI
   */
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

  // WebSocket handlers
  const handleOpen = useCallback(() => {
    console.log('WebSocket connected');
    lastMessageTime.current = Date.now();
  }, []);

  const handleClose = useCallback(() => {
    console.log('WebSocket disconnected');
  }, []);

  const handleError = useCallback((error) => {
    console.error('WebSocket error:', error);
    safeUpdate(() => {
      setError('Connection error: ' + (error.message || 'Unknown error'));
    });
  }, [setError, safeUpdate]);

  /**
   * Process WebSocket messages with state batching and fresh state references
   */
  const handleMessage = useCallback((event) => {
    try {
      lastMessageTime.current = Date.now();
      const data = JSON.parse(event.data);
      
      // Use current swarm state for any comparisons
      const currentState = swarmState.current;

      switch (data.type) {
        case 'bot_update':
          // Compare with current state before updating
          if (currentState.bots[data.id]?.position !== data.position) {
            updateBot(data.id, {
              position: data.position,
              battery: data.battery,
              status: data.status,
            });
          }
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
          
        case 'heatmap_update':
          updateHeatmap(data.points);
          break;
          
        case 'trajectory_update':
          updateTrajectory(data.botId, data.position);
          break;
          
        case 'state_update':
        case 'full_state':
          // Batched update implementation
          const batchUpdate = {};
          
          if (data.bots) {
            batchUpdate.bots = data.bots;
          }
          
          if (data.target) {
            batchUpdate.target = data.target;
          }
          
          if (data.beacons) {
            batchUpdate.beacons = data.beacons;
          }
          
          if (Object.keys(batchUpdate).length > 0) {
            updateEntireSwarm(batchUpdate);
          }
          break;
          
        case 'error':
          safeUpdate(() => {
            setError(data.message || 'Unknown error');
          });
          break;
          
        case 'connection_ack':
        case 'pong':
          break;
          
        default:
          console.warn('Unknown message type:', data.type);
      }
    } catch (e) {
      console.error('Failed to parse WebSocket message:', e);
    }
  }, [swarmState, updateBot, updateBeacon, updateTarget, updateHeatmap, 
      updateTrajectory, setError, updateEntireSwarm, safeUpdate]);

  /**
   * Initialize WebSocket with performance optimizations
   */
  const { readyState, sendMessage } = useWebSocketOptimized('ws://localhost:8080', {
    onOpen: handleOpen,
    onClose: handleClose,
    onMessage: handleMessage,
    onError: handleError,
    reconnectAttempts: 10,
    reconnectInterval: 1000,
    throttleMs: 100,
    debugMode: false,
  });

  // WebSocket lifecycle management with Strict Mode protection
  useEffect(() => {
    if (!isComponentMounted.current) return;
    
    const currentConnectionId = ++connectionId.current;
    console.log('Initializing WebSocket connection', currentConnectionId);

    // Request updates periodically when connected
    if (readyState === ReadyState.OPEN) {
      const checkInterval = setInterval(() => {
        const timeSinceLastMessage = Date.now() - lastMessageTime.current;
        if (timeSinceLastMessage > 5000) {
          sendMessage(JSON.stringify({ 
            type: 'request_update',
            timestamp: Date.now()
          }));
        }
      }, 5000);
      
      return () => {
        console.log('Cleaning up WebSocket connection', currentConnectionId);
        if (connectionId.current === currentConnectionId) {
          clearInterval(checkInterval);
          console.log('WebSocket cleanup completed for', currentConnectionId);
        }
      };
    }
  }, [readyState, sendMessage]);

  // Update connection status with safe updates
  useEffect(() => {
    if (!isMounted.current) return;
    
    if (statusUpdateTimeoutRef.current) {
      clearTimeout(statusUpdateTimeoutRef.current);
    }
    
    statusUpdateTimeoutRef.current = setTimeout(() => {
      safeUpdate(() => {
        setConnectionStatus(mapReadyStateToStatus(readyState));
      });
    }, 50);
    
    return () => {
      if (statusUpdateTimeoutRef.current) {
        clearTimeout(statusUpdateTimeoutRef.current);
      }
    };
  }, [readyState, setConnectionStatus, mapReadyStateToStatus, isMounted, safeUpdate]);

  return null;
};

export default SwarmDataManager;
