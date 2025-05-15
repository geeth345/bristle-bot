// context/SwarmContext.js
import React, { createContext, useContext, useReducer, useCallback, useMemo, useEffect } from 'react';

/**
 * Initial state for the swarm system
 * Focused on performance with minimal default properties
 */
const initialState = {
  bots: {},
  beacons: {},
  target: null,
  connectionStatus: 'disconnected',
  selectedBot: null,
  error: null,
  lastUpdateTimestamp: {},
};

/**
 * Action types as constants to avoid string comparison overhead
 * Using constants instead of strings improves performance
 */
const ActionTypes = {
  BOT_UPDATE: 'BOT_UPDATE',
  BEACON_UPDATE: 'BEACON_UPDATE',
  TARGET_UPDATE: 'TARGET_UPDATE',
  CONNECTION_STATUS_CHANGE: 'CONNECTION_STATUS_CHANGE',
  SELECT_BOT: 'SELECT_BOT',
  SET_ERROR: 'SET_ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR',
  BATCH_UPDATE: 'BATCH_UPDATE',
};

/**
 * Performance-optimized reducer for swarm state
 * Implements selective updates and minimizes unnecessary state changes
 * 
 * @param {Object} state - Current state
 * @param {Object} action - Action to perform
 * @returns {Object} New state
 */
const swarmReducer = (state, action) => {
  switch (action.type) {
    case ActionTypes.BOT_UPDATE: {
      const { id, data } = action.payload;
      
      // Skip update if data hasn't changed significantly
      // This prevents unnecessary renders for minor position changes
      const currentBot = state.bots[id] || {};
      const hasSignificantChange = !currentBot.position || 
        !data.position ||
        Math.abs((data.position.x || 0) - (currentBot.position?.x || 0)) > 2 ||
        Math.abs((data.position.y || 0) - (currentBot.position?.y || 0)) > 2 ||
        data.battery !== currentBot.battery ||
        data.status !== currentBot.status;
      
      if (!hasSignificantChange) return state;
      
      return {
        ...state,
        bots: {
          ...state.bots,
          [id]: {
            ...currentBot,
            ...data,
            lastUpdated: Date.now(),
          },
        },
        lastUpdateTimestamp: {
          ...state.lastUpdateTimestamp,
          [`bot_${id}`]: Date.now(),
        },
      };
    }
      
    case ActionTypes.BEACON_UPDATE: {
      const { id, data } = action.payload;
      return {
        ...state,
        beacons: {
          ...state.beacons,
          [id]: {
            ...state.beacons[id],
            ...data,
            lastUpdated: Date.now(),
          },
        },
        lastUpdateTimestamp: {
          ...state.lastUpdateTimestamp,
          [`beacon_${id}`]: Date.now(),
        },
      };
    }
      
    case ActionTypes.TARGET_UPDATE:
      return {
        ...state,
        target: {
          ...action.payload,
          lastUpdated: Date.now(),
        },
        lastUpdateTimestamp: {
          ...state.lastUpdateTimestamp,
          target: Date.now(),
        },
      };
      
    case ActionTypes.CONNECTION_STATUS_CHANGE:
      return {
        ...state,
        connectionStatus: action.payload,
      };
      
    case ActionTypes.SELECT_BOT:
      return {
        ...state,
        selectedBot: action.payload,
      };
      
    case ActionTypes.SET_ERROR:
      return {
        ...state,
        error: action.payload,
      };
      
    case ActionTypes.CLEAR_ERROR:
      return {
        ...state,
        error: null,
      };
    
    // Batch updates to minimize render cycles
    case ActionTypes.BATCH_UPDATE: {
      const { updates } = action.payload;
      let newState = { ...state };
      
      updates.forEach(update => {
        newState = swarmReducer(newState, update);
      });
      
      return newState;
    }
      
    default:
      return state;
  }
};

// Create context
const SwarmContext = createContext();

/**
 * Provider component with performance optimizations
 * Implements batched updates to reduce render cycles
 * 
 * @param {Object} props - Component props
 * @returns {JSX.Element} Provider component
 */
export const SwarmProvider = ({ children }) => {
  const [state, dispatch] = useReducer(swarmReducer, initialState);
  
  // Batched updates queue for reducing render cycles
  const updateQueue = React.useRef([]);
  const updateTimeoutRef = React.useRef(null);
  
  /**
   * Process batched updates
   * Groups multiple updates into a single state change
   */
  const processBatchedUpdates = useCallback(() => {
    if (updateQueue.current.length > 0) {
      dispatch({
        type: ActionTypes.BATCH_UPDATE,
        payload: { updates: [...updateQueue.current] }
      });
      updateQueue.current = [];
    }
    updateTimeoutRef.current = null;
  }, []);
  
  /**
   * Queue update for batching
   * Adds update to queue and schedules processing
   * 
   * @param {Object} update - Update action
   */
  const queueUpdate = useCallback((update) => {
    updateQueue.current.push(update);
    
    // Only schedule processing if not already scheduled
    if (!updateTimeoutRef.current) {
      updateTimeoutRef.current = setTimeout(processBatchedUpdates, 50); // 50ms batch window
    }
  }, [processBatchedUpdates]);
  
  /**
   * Update bot data
   * @param {string} id - Bot ID
   * @param {Object} data - Bot data
   */
  const updateBot = useCallback((id, data) => {
    queueUpdate({
      type: ActionTypes.BOT_UPDATE,
      payload: { id, data },
    });
  }, [queueUpdate]);
  
  /**
   * Update beacon data
   * @param {string} id - Beacon ID
   * @param {Object} data - Beacon data
   */
  const updateBeacon = useCallback((id, data) => {
    queueUpdate({
      type: ActionTypes.BEACON_UPDATE,
      payload: { id, data },
    });
  }, [queueUpdate]);
  
  /**
   * Update target data
   * @param {Object} data - Target data
   */
  const updateTarget = useCallback((data) => {
    queueUpdate({
      type: ActionTypes.TARGET_UPDATE,
      payload: data,
    });
  }, [queueUpdate]);
  
  /**
   * Set connection status
   * This bypasses the queue for immediate updates
   * 
   * @param {string} status - Connection status
   */
  const setConnectionStatus = useCallback((status) => {
    dispatch({
      type: ActionTypes.CONNECTION_STATUS_CHANGE,
      payload: status,
    });
  }, []);
  
  /**
   * Select a bot
   * @param {string} botId - Bot ID to select
   */
  const selectBot = useCallback((botId) => {
    dispatch({
      type: ActionTypes.SELECT_BOT,
      payload: botId,
    });
  }, []);
  
  /**
   * Set error message with auto-clear
   * @param {string} error - Error message
   */
  const setError = useCallback((error) => {
    dispatch({
      type: ActionTypes.SET_ERROR,
      payload: error,
    });
    
    // Auto-clear error after 5 seconds to prevent UI clutter
    setTimeout(() => {
      dispatch({ type: ActionTypes.CLEAR_ERROR });
    }, 5000);
  }, []);
  
  /**
   * Clear error message
   */
  const clearError = useCallback(() => {
    dispatch({ type: ActionTypes.CLEAR_ERROR });
  }, []);
  
  // Cleanup batch processing on unmount
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);
  
  // Memoized context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    ...state,
    updateBot,
    updateBeacon,
    updateTarget,
    setConnectionStatus,
    selectBot,
    setError,
    clearError,
  }), [
    state,
    updateBot,
    updateBeacon,
    updateTarget,
    setConnectionStatus,
    selectBot,
    setError,
    clearError,
  ]);
  
  return (
    <SwarmContext.Provider value={contextValue}>
      {children}
    </SwarmContext.Provider>
  );
};

/**
 * Custom hook for consuming SwarmContext
 * Provides type safety and error checking
 * 
 * @returns {Object} Swarm context value
 */
export const useSwarm = () => {
  const context = useContext(SwarmContext);
  if (!context) {
    throw new Error('useSwarm must be used within a SwarmProvider');
  }
  return context;
};
