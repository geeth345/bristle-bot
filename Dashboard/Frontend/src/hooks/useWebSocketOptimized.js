// hooks/useWebSocketOptimized.js
import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * WebSocket connection states for better code readability
 * These constants match the native WebSocket readyState values
 */
export const ReadyState = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
  UNINSTANTIATED: -1,
};

/**
 * Custom hook for WebSocket communication optimized for Raspberry Pi performance
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Message throttling to prevent CPU overload
 * - Smart deduplication of similar position updates
 * - Connection state tracking
 * - Robust error handling
 * 
 * @param {string} url - WebSocket server URL (ws:// or wss://)
 * @param {Object} options - Configuration options
 * @returns {Object} WebSocket interface with methods and state
 */
const useWebSocketOptimized = (url, options = {}) => {
  const {
    // Connection handlers
    onOpen,
    onClose,
    onMessage,
    onError,
    
    // Reconnection options
    reconnectAttempts = 5,
    reconnectInterval = 1000,
    maxReconnectInterval = 30000,
    reconnectFactor = 1.5,
    
    // Performance options
    throttleMs = 100,
    
    // Control options
    manual = false,
    protocols = [],
    debugMode = false,
  } = options;

  // Connection state tracking
  const [readyState, setReadyState] = useState(ReadyState.UNINSTANTIATED);
  const [lastMessage, setLastMessage] = useState(null);
  const [lastJsonMessage, setLastJsonMessage] = useState(null);
  const reconnectCount = useRef(0);
  const socket = useRef(null);
  const reconnectTimeoutId = useRef(null);
  
  // Message throttling implementation
  const messageQueue = useRef([]);
  const processingQueue = useRef(false);
  const lastMessageByType = useRef({});
  const lastProcessTime = useRef(Date.now());

  // Debug logging based on debug flag to save resources when not needed
  const log = useCallback((...args) => {
    if (debugMode) console.log(`[WebSocket]`, ...args);
  }, [debugMode]);

  /**
   * Process message queue with throttling to avoid overwhelming the Raspberry Pi
   * Uses dynamic throttling based on queue size to adapt to load
   */
  const processMessageQueue = useCallback(() => {
    if (messageQueue.current.length === 0) {
      processingQueue.current = false;
      return;
    }

    const now = Date.now();
    const timeSinceLastProcess = now - lastProcessTime.current;
    
    // Dynamically adjust throttling based on queue size
    // Minimum throttle is the configured value, maximum is 500ms
    const dynamicThrottle = Math.max(
      throttleMs, 
      Math.min(throttleMs * (messageQueue.current.length / 10), 500)
    );
    
    if (timeSinceLastProcess < dynamicThrottle) {
      // Schedule next processing based on dynamic throttle
      setTimeout(processMessageQueue, dynamicThrottle - timeSinceLastProcess);
      return;
    }

    processingQueue.current = true;
    lastProcessTime.current = now;
    
    // Process oldest message in the queue
    const message = messageQueue.current.shift();
    
    try {
      // Update last message state
      setLastMessage(message);
      
      // Parse JSON if possible
      if (message.data) {
        try {
          const jsonData = JSON.parse(message.data);
          setLastJsonMessage(jsonData);
          
          // Store message by type for deduplication
          if (jsonData.type) {
            lastMessageByType.current[jsonData.type] = jsonData;
          }
        } catch (e) {
          // Not JSON data, ignore parsing error
          log('Non-JSON message received', message.data.slice(0, 50));
        }
      }
    } catch (err) {
      log('Error processing message:', err);
    }

    // Schedule next processing with dynamic throttling
    setTimeout(processMessageQueue, dynamicThrottle);
  }, [throttleMs, log]);

  /**
   * Add message to queue with smart deduplication
   * Filters out insignificant position updates to reduce processing load
   */
  const queueMessage = useCallback((event) => {
    try {
      const data = JSON.parse(event.data);
      const msgType = data.type;
      
      // For position updates, use a smarter approach to reduce updates
      if (msgType && (msgType.includes('update') || msgType.includes('position'))) {
        // Skip messages that don't represent significant changes
        const lastMsg = lastMessageByType.current[msgType];
        if (lastMsg && data.position && lastMsg.position) {
          // Calculate position change as percentage of movement area
          const dx = Math.abs((data.position.x || 0) - (lastMsg.position.x || 0));
          const dy = Math.abs((data.position.y || 0) - (lastMsg.position.y || 0));
          
          // If change is minimal, only update occasionally based on type
          const significantChange = dx > 5 || dy > 5;
          const updateInterval = {
            'bot_update': 500,      // Update bots every 500ms max
            'target_update': 200,   // Update target more frequently
            'beacon_update': 1000,  // Beacons rarely move
          }[msgType] || 300;
          
          const timeSinceLastUpdate = Date.now() - (lastMsg._timestamp || 0);
          
          if (!significantChange && timeSinceLastUpdate < updateInterval) {
            return; // Skip this update
          }
          
          // Add timestamp for update interval tracking
          data._timestamp = Date.now();
        }
        
        // Store message by type
        lastMessageByType.current[msgType] = data;
      }
      
      // Rebuild the event with potentially modified data
      const modifiedEvent = {
        ...event,
        data: JSON.stringify(data)
      };
      
      messageQueue.current.push(modifiedEvent);
    } catch (e) {
      // Not JSON or other error, queue original message
      messageQueue.current.push(event);
    }
    
    if (!processingQueue.current) {
      processMessageQueue();
    }
  }, [processMessageQueue]);

  /**
   * Calculate reconnection delay with exponential backoff and jitter
   * Prevents reconnection storms after network failures
   */
  const getReconnectDelay = useCallback(() => {
    const baseDelay = reconnectInterval * Math.pow(reconnectFactor, reconnectCount.current);
    const maxDelay = maxReconnectInterval;
    // Add random jitter (0-50%) to prevent reconnection thundering herd
    const jitter = Math.random() * 0.5 * baseDelay;
    return Math.min(baseDelay + jitter, maxDelay);
  }, [reconnectInterval, reconnectFactor, maxReconnectInterval]);

  /**
   * Connect to WebSocket with robust error handling
   * Handles reconnection and manages socket lifecycle
   */
  const connect = useCallback(() => {
    if (!url) return;

    // Clear any existing reconnect timeout
    if (reconnectTimeoutId.current) {
      clearTimeout(reconnectTimeoutId.current);
      reconnectTimeoutId.current = null;
    }

    // Close existing connection if any
    if (socket.current && socket.current.readyState < 2) {
      socket.current.close();
    }

    try {
      log('Connecting to', url);
      setReadyState(ReadyState.CONNECTING);
      
      socket.current = new WebSocket(url, protocols);

      socket.current.onopen = (event) => {
        log('Connection established');
        setReadyState(ReadyState.OPEN);
        reconnectCount.current = 0;
        if (onOpen) onOpen(event, socket.current);
      };

      socket.current.onclose = (event) => {
        log('Connection closed', event.code, event.reason);
        setReadyState(ReadyState.CLOSED);
        if (onClose) onClose(event, socket.current);
        
        // Only reconnect on abnormal closure or if we haven't reached max attempts
        const shouldReconnect = 
          reconnectCount.current < reconnectAttempts && 
          event.code !== 1000; // 1000 is normal closure
        
        if (shouldReconnect) {
          const delay = getReconnectDelay();
          log(`Reconnecting in ${delay}ms (attempt ${reconnectCount.current + 1}/${reconnectAttempts})`);
          
          reconnectTimeoutId.current = setTimeout(() => {
            reconnectCount.current += 1;
            connect();
          }, delay);
        } else if (reconnectCount.current >= reconnectAttempts) {
          log('Max reconnection attempts reached');
        }
      };

      socket.current.onmessage = (event) => {
        if (onMessage) onMessage(event, socket.current);
        queueMessage(event);
      };

      socket.current.onerror = (event) => {
        log('WebSocket error', event);
        if (onError) onError(event, socket.current);
      };
    } catch (error) {
      log('Failed to create WebSocket:', error);
    }
  }, [
    url, protocols, onOpen, onClose, onMessage, onError, 
    reconnectAttempts, getReconnectDelay, queueMessage, log
  ]);

  /**
   * Controlled disconnection method
   * Ensures cleanup of resources and prevents auto reconnect
   */
  const disconnect = useCallback(() => {
    if (socket.current) {
      log('Manually disconnecting WebSocket');
      // Prevent auto reconnect
      reconnectCount.current = reconnectAttempts;
      socket.current.close(1000, 'Closed by client');
    }
    
    if (reconnectTimeoutId.current) {
      clearTimeout(reconnectTimeoutId.current);
      reconnectTimeoutId.current = null;
    }
  }, [reconnectAttempts, log]);

  /**
   * Manual reconnection method
   * Resets reconnect counter and attempts to connect
   */
  const reconnect = useCallback(() => {
    log('Manual reconnection triggered');
    reconnectCount.current = 0;
    connect();
  }, [connect, log]);

  /**
   * Send message with error handling
   * @param {string|Object} data - Data to send
   * @returns {boolean} Success status
   */
  const sendMessage = useCallback((data) => {
    if (!socket.current || socket.current.readyState !== ReadyState.OPEN) {
      log('Cannot send message, socket not connected');
      return false;
    }
    
    try {
      const message = typeof data === 'string' ? data : JSON.stringify(data);
      socket.current.send(message);
      return true;
    } catch (error) {
      log('Failed to send message:', error);
      return false;
    }
  }, [log]);

  /**
   * Convenience method for sending JSON data
   * @param {Object} data - Object to send as JSON
   * @returns {boolean} Success status
   */
  const sendJsonMessage = useCallback((data) => {
    return sendMessage(JSON.stringify(data));
  }, [sendMessage]);

  // Initialize connection when component mounts or URL changes
  useEffect(() => {
    if (!manual) {
      connect();
    }

    // Cleanup function
    return () => {
      if (socket.current) {
        socket.current.close(1000, 'Component unmounted');
      }
      
      if (reconnectTimeoutId.current) {
        clearTimeout(reconnectTimeoutId.current);
      }
    };
  }, [connect, manual]);

  /**
   * Detect page visibility change for reconnection
   * This helps save resources when tab is not visible and
   * ensures reconnection when user returns to the tab
   */
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && 
          readyState === ReadyState.CLOSED && 
          reconnectCount.current < reconnectAttempts) {
        log('Page became visible, reconnecting WebSocket');
        reconnect();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [readyState, reconnectAttempts, reconnect, log]);

  return {
    sendMessage,
    sendJsonMessage,
    lastMessage,
    lastJsonMessage,
    readyState,
    connect: reconnect,
    disconnect,
  };
};

export default useWebSocketOptimized;
