// context/SwarmContext.js

import React, { createContext, useContext, useReducer, useCallback, useMemo, useEffect } from 'react';

// Initial state for the swarm system
const initialState = {
  bots: {},
  beacons: {},
  target: null,
  connectionStatus: 'disconnected',
  selectedBot: null,
  error: null,
  lastUpdateTimestamp: {},
  intensityGrid: {},
  trajectories: {},
};

// Action types as constants
const ActionTypes = {
  BOT_UPDATE: 'BOT_UPDATE',
  BEACON_UPDATE: 'BEACON_UPDATE',
  TARGET_UPDATE: 'TARGET_UPDATE',
  CONNECTION_STATUS_CHANGE: 'CONNECTION_STATUS_CHANGE',
  SELECT_BOT: 'SELECT_BOT',
  SET_ERROR: 'SET_ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR',
  BATCH_UPDATE: 'BATCH_UPDATE',
  INTENSITY_GRID_UPDATE: 'INTENSITY_GRID_UPDATE',
  TRAJECTORY_UPDATE: 'TRAJECTORY_UPDATE',
};

// Reducer for swarm state
const swarmReducer = (state, action) => {
  switch (action.type) {
    case ActionTypes.BOT_UPDATE: {
      const { id, data } = action.payload;
      const currentBot = state.bots[id] || {};
      const hasSignificantChange =
        !currentBot.position ||
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
    case ActionTypes.INTENSITY_GRID_UPDATE:
      if (JSON.stringify(state.intensityGrid) === JSON.stringify(action.payload)) return state;
      return {
        ...state,
        intensityGrid: action.payload,
        lastUpdateTimestamp: { ...state.lastUpdateTimestamp, intensityGrid: Date.now() },
      };
    case ActionTypes.TRAJECTORY_UPDATE:
      if (JSON.stringify(state.trajectories) === JSON.stringify(action.payload)) return state;
      return {
        ...state,
        trajectories: action.payload,
        lastUpdateTimestamp: { ...state.lastUpdateTimestamp, trajectories: Date.now() },
      };
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

export const SwarmProvider = ({ children }) => {
  const [state, dispatch] = useReducer(swarmReducer, initialState);

  // Batched updates queue for reducing render cycles
  const updateQueue = React.useRef([]);
  const updateTimeoutRef = React.useRef(null);

  // Process batched updates
  const processBatchedUpdates = useCallback(() => {
    if (updateQueue.current.length > 0) {
      dispatch({
        type: ActionTypes.BATCH_UPDATE,
        payload: { updates: [...updateQueue.current] }
      });
      updateQueue.current = [];
      updateTimeoutRef.current = null;
    }
  }, []);

  // Queue update for batching
  const queueUpdate = useCallback((update) => {
    updateQueue.current.push(update);
    if (!updateTimeoutRef.current) {
      updateTimeoutRef.current = setTimeout(processBatchedUpdates, 50);
    }
  }, [processBatchedUpdates]);

  // Context update functions
  const updateBot = useCallback((id, data) => {
    queueUpdate({ type: ActionTypes.BOT_UPDATE, payload: { id, data } });
  }, [queueUpdate]);
  const updateBeacon = useCallback((id, data) => {
    queueUpdate({ type: ActionTypes.BEACON_UPDATE, payload: { id, data } });
  }, [queueUpdate]);
  const updateTarget = useCallback((data) => {
    queueUpdate({ type: ActionTypes.TARGET_UPDATE, payload: data });
  }, [queueUpdate]);
  const updateIntensityGrid = useCallback((data) => {
    queueUpdate({ type: ActionTypes.INTENSITY_GRID_UPDATE, payload: data });
  }, [queueUpdate]);
  const updateTrajectories = useCallback((data) => {
    queueUpdate({ type: ActionTypes.TRAJECTORY_UPDATE, payload: data });
  }, [queueUpdate]);

  // Immediate dispatch for status and error
  const setConnectionStatus = useCallback((status) => {
    dispatch({ type: ActionTypes.CONNECTION_STATUS_CHANGE, payload: status });
  }, []);
  const selectBot = useCallback((botId) => {
    dispatch({ type: ActionTypes.SELECT_BOT, payload: botId });
  }, []);
  const setError = useCallback((error) => {
    dispatch({ type: ActionTypes.SET_ERROR, payload: error });
    setTimeout(() => { dispatch({ type: ActionTypes.CLEAR_ERROR }); }, 5000);
  }, []);
  const clearError = useCallback(() => { dispatch({ type: ActionTypes.CLEAR_ERROR }); }, []);

  // Cleanup batch processing on unmount
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
    };
  }, []);

  const contextValue = useMemo(() => ({
    ...state,
    updateBot,
    updateBeacon,
    updateTarget,
    updateIntensityGrid,
    updateTrajectories,
    setConnectionStatus,
    selectBot,
    setError,
    clearError,
  }), [
    state,
    updateBot,
    updateBeacon,
    updateTarget,
    updateIntensityGrid,
    updateTrajectories,
    setConnectionStatus,
    selectBot,
    setError,
    clearError,
  ]);

  return <SwarmContext.Provider value={contextValue}>{children}</SwarmContext.Provider>;
};

export const useSwarm = () => {
  const context = useContext(SwarmContext);
  if (!context) throw new Error('useSwarm must be used within a SwarmProvider');
  return context;
};
