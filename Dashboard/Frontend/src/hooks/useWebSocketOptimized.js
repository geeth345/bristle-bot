import { useState, useEffect, useRef, useCallback } from 'react';
import usePreventMemoryLeaks from './usePreventMemoryLeaks';

export const ReadyState = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
  UNINSTANTIATED: -1,
};

const useWebSocketOptimized = (url, options = {}) => {
  // Connection throttling refs
  const lastConnectAttempt = useRef(0);
  const MIN_RECONNECT_INTERVAL = 2000;
  const isFirstMount = useRef(true);

  const {
    onOpen,
    onClose,
    onMessage,
    onError,
    reconnectAttempts = 5,
    reconnectInterval = 1000,
    maxReconnectInterval = 30000,
    reconnectFactor = 1.5,
    throttleMs = 100,
    manual = false,
    protocols = [],
    debugMode = false,
  } = options;

  // Memory leak prevention utilities
  const { isMounted } = usePreventMemoryLeaks();
  
  // Connection state tracking
  const [readyState, setReadyState] = useState(ReadyState.UNINSTANTIATED);
  const [lastMessage, setLastMessage] = useState(null);
  const [lastJsonMessage, setLastJsonMessage] = useState(null);
  const reconnectCount = useRef(0);
  const socket = useRef(null);
  const reconnectTimeoutId = useRef(null);
  
  // Backpressure management
  const MAX_QUEUE_SIZE = 50;
  const messageQueue = useRef([]);
  const processingQueue = useRef(false);
  const lastMessageByType = useRef({});
  const lastProcessTime = useRef(Date.now());

  // Debug logging based on debug flag
  const log = useCallback((...args) => {
    if (debugMode) console.log(`[WebSocket]`, ...args);
  }, [debugMode]);

  // Process message queue with throttling and backpressure handling
  const processMessageQueue = useCallback(() => {
    if (!isMounted.current || messageQueue.current.length === 0) {
      processingQueue.current = false;
      return;
    }

    const now = Date.now();
    const timeSinceLastProcess = now - lastProcessTime.current;
    
    // Dynamically adjust throttling based on queue size
    const dynamicThrottle = Math.max(
      throttleMs, 
      Math.min(throttleMs * (messageQueue.current.length / 10), 500)
    );
    
    if (timeSinceLastProcess < dynamicThrottle) {
      setTimeout(processMessageQueue, dynamicThrottle - timeSinceLastProcess);
      return;
    }

    processingQueue.current = true;
    lastProcessTime.current = now;
    
    // Process oldest message in the queue
    const message = messageQueue.current.shift();
    
    try {
      // Update last message state only if component is mounted
      if (isMounted.current) {
        setLastMessage(message);
        
        // Parse JSON if possible
        if (message.data) {
          try {
            const jsonData = JSON.parse(message.data);
            setLastJsonMessage(jsonData);
            
            if (jsonData.type) {
              lastMessageByType.current[jsonData.type] = jsonData;
            }
          } catch (e) {
            // Not JSON data, ignore parsing error
          }
        }
      }
    } catch (err) {
      log('Error processing message:', err);
    }

    setTimeout(processMessageQueue, dynamicThrottle);
  }, [throttleMs, log, isMounted]);

  // Add message to queue with backpressure handling
  const queueMessage = useCallback((event) => {
    try {
      // Enforce maximum queue size
      while (messageQueue.current.length >= MAX_QUEUE_SIZE) {
        messageQueue.current.shift();
        log('Queue overflow - dropping oldest message');
      }

      const data = JSON.parse(event.data);
      const msgType = data.type;
      
      // Message deduplication and filtering logic
      if (msgType && (msgType.includes('update') || msgType.includes('position'))) {
        const lastMsg = lastMessageByType.current[msgType];
        if (lastMsg && data.position && lastMsg.position) {
          const dx = Math.abs((data.position.x || 0) - (lastMsg.position.x || 0));
          const dy = Math.abs((data.position.y || 0) - (lastMsg.position.y || 0));
          
          const significantChange = dx > 5 || dy > 5;
          const updateInterval = {
            'bot_update': 500,
            'target_update': 200,
            'beacon_update': 1000,
          }[msgType] || 300;
          
          const timeSinceLastUpdate = Date.now() - (lastMsg._timestamp || 0);
          
          if (!significantChange && timeSinceLastUpdate < updateInterval) {
            return;
          }
          
          data._timestamp = Date.now();
        }
        
        lastMessageByType.current[msgType] = data;
      }
      
      const modifiedEvent = {
        ...event,
        data: JSON.stringify(data)
      };
      
      messageQueue.current.push(modifiedEvent);
    } catch (e) {
      // Non-JSON message handling with queue size check
      if (messageQueue.current.length >= MAX_QUEUE_SIZE) {
        messageQueue.current.shift();
      }
      messageQueue.current.push(event);
    }
    
    if (!processingQueue.current) {
      processMessageQueue();
    }
  }, [processMessageQueue, log, MAX_QUEUE_SIZE]);

  // Reconnection logic with exponential backoff
  const getReconnectDelay = useCallback(() => {
    const baseDelay = reconnectInterval * Math.pow(reconnectFactor, reconnectCount.current);
    const maxDelay = maxReconnectInterval;
    const jitter = Math.random() * 0.5 * baseDelay;
    return Math.min(baseDelay + jitter, maxDelay);
  }, [reconnectInterval, reconnectFactor, maxReconnectInterval]);

  // Modified connect function with throttling and valid close codes
  const connect = useCallback(() => {
    if (!url || !isMounted.current) return;
    
    const now = Date.now();
    if (!isFirstMount.current && now - lastConnectAttempt.current < MIN_RECONNECT_INTERVAL) {
      log(`Throttling connection attempt - only ${now - lastConnectAttempt.current}ms since last try`);
      return;
    }
    
    lastConnectAttempt.current = now;
    isFirstMount.current = false;

    // Cleanup pending connections
    if (reconnectTimeoutId.current) {
      clearTimeout(reconnectTimeoutId.current);
      reconnectTimeoutId.current = null;
    }

    // Close existing connection if any
    if (socket.current) {
      if (socket.current.readyState === WebSocket.CONNECTING) {
        socket.current.close(1000, 'Connection aborted');
      }
      else if (socket.current.readyState < 2) {
        socket.current.close(1000, 'Reconnecting');
      }
    }

    try {
      log('Connecting to', url);
      if (isMounted.current) setReadyState(ReadyState.CONNECTING);
      
      socket.current = new WebSocket(url, protocols);

      socket.current.onopen = (event) => {
        if (!isMounted.current) return;
        log('Connection established');
        setReadyState(ReadyState.OPEN);
        reconnectCount.current = 0;
        onOpen?.(event, socket.current);
      };

      socket.current.onclose = (event) => {
        if (!isMounted.current) return;
        log('Connection closed', event.code, event.reason);
        setReadyState(ReadyState.CLOSED);
        onClose?.(event, socket.current);
        
        const shouldReconnect = reconnectCount.current < reconnectAttempts && event.code !== 1000;
        if (shouldReconnect) {
          const delay = getReconnectDelay();
          log(`Reconnecting in ${delay}ms (attempt ${reconnectCount.current + 1}/${reconnectAttempts})`);
          reconnectTimeoutId.current = setTimeout(() => {
            reconnectCount.current += 1;
            connect();
          }, delay);
        }
      };

      socket.current.onmessage = (event) => {
        if (!isMounted.current) return;
        onMessage?.(event, socket.current);
        queueMessage(event);
      };

      socket.current.onerror = (event) => {
        if (!isMounted.current) return;
        log('WebSocket error', event);
        onError?.(event, socket.current);
      };
    } catch (error) {
      log('Failed to create WebSocket:', error);
    }
  }, [
    url, protocols, onOpen, onClose, onMessage, onError,
    reconnectAttempts, getReconnectDelay, queueMessage, log, isMounted
  ]);

  // Define sendMessage function
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
  }, [log, ReadyState]);

  // Define sendJsonMessage function
  const sendJsonMessage = useCallback((data) => {
    return sendMessage(data);
  }, [sendMessage]);

  // Cleanup function with valid close codes
  const disconnect = useCallback(() => {
    if (socket.current) {
      log('Manually disconnecting WebSocket');
      reconnectCount.current = reconnectAttempts;
      
      if (socket.current.readyState === WebSocket.CONNECTING) {
        socket.current.close(1000, 'Connection aborted');
      } else {
        socket.current.close(1000, 'Closed by client');
      }
    }
    
    if (reconnectTimeoutId.current) {
      clearTimeout(reconnectTimeoutId.current);
      reconnectTimeoutId.current = null;
    }
  }, [reconnectAttempts, log]);

  // Initialize connection with proper cleanup
  useEffect(() => {
    if (!manual) connect();

    return () => {
      // Handle connection cleanup with valid close codes
      if (socket.current?.readyState === WebSocket.CONNECTING) {
        try {
          socket.current.close(1000, 'Component unmounted');
        } catch (e) {
          log('Error closing connecting socket:', e);
        }
      }
      
      if (socket.current?.readyState === WebSocket.OPEN) {
        try {
          socket.current.close(1000, 'Component unmounted');
        } catch (e) {
          log('Error closing open socket:', e);
        }
      }
      
      if (reconnectTimeoutId.current) {
        clearTimeout(reconnectTimeoutId.current);
        reconnectTimeoutId.current = null;
      }
    };
  }, [connect, manual]);

  return {
    sendMessage,
    sendJsonMessage,
    lastMessage,
    lastJsonMessage,
    readyState,
    connect: useCallback(() => {
      log('Manual reconnection triggered');
      reconnectCount.current = 0;
      connect();
    }, [connect, log]),
    disconnect,
  };
};

export default useWebSocketOptimized;
