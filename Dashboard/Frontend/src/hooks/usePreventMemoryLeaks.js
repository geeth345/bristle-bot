// hooks/usePreventMemoryLeaks.js
import { useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook to prevent memory leaks in components with async operations.
 * Particularly important for Raspberry Pi with limited RAM (1GB).
 * 
 * This hook provides utilities for:
 * - Tracking component mount status
 * - Safe state updates after async operations
 * - Managed timeouts that auto-clear on unmount
 * - Cancellable async operations
 * 
 * @returns {Object} Memory leak prevention utilities
 */
const usePreventMemoryLeaks = () => {
  // Reference to track if component is mounted
  const isMounted = useRef(true);
  
  // Set isMounted to false when the component unmounts
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);
  
  /**
   * Safe state update function that checks component mount status
   * before applying the update to prevent memory leaks
   * 
   * @param {Function} updateFn - Function that updates state
   */
  const safeUpdate = useCallback((updateFn) => {
    if (isMounted.current) {
      updateFn();
    }
  }, []);
  
  /**
   * Safe async function wrapper that aborts if component unmounts
   * Returns a cancellable function that won't update state if:
   * 1. Component unmounts during execution
   * 2. Function is cancelled explicitly
   * 
   * @param {Function} asyncFn - Async function to wrap
   * @returns {Function} Wrapped async function with cancel method
   */
  const safeAsync = useCallback((asyncFn) => {
    let isCancelled = false;
    
    const wrappedFn = async (...args) => {
      try {
        const result = await asyncFn(...args);
        if (!isMounted.current || isCancelled) return;
        return result;
      } catch (error) {
        if (!isMounted.current || isCancelled) return;
        throw error;
      }
    };
    
    // Attach cancel method to the wrapped function
    wrappedFn.cancel = () => {
      isCancelled = true;
    };
    
    return wrappedFn;
  }, []);
  
  // Array to track timeout IDs for automatic cleanup
  const timers = useRef([]);
  
  /**
   * Creates a timeout that is automatically cleared on component unmount
   * 
   * @param {Function} callback - Function to execute after delay
   * @param {number} delay - Delay in milliseconds
   * @returns {number} Timer ID for manual clearing
   */
  const setManagedTimeout = useCallback((callback, delay) => {
    const timerId = setTimeout(callback, delay);
    timers.current.push(timerId);
    return timerId;
  }, []);
  
  /**
   * Clears a managed timeout and removes it from tracking array
   * 
   * @param {number} timerId - Timer ID to clear
   */
  const clearManagedTimeout = useCallback((timerId) => {
    const index = timers.current.indexOf(timerId);
    if (index >= 0) {
      timers.current.splice(index, 1);
    }
    clearTimeout(timerId);
  }, []);
  
  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, []);
  
  return { 
    isMounted, 
    safeUpdate, 
    safeAsync,
    setManagedTimeout,
    clearManagedTimeout
  };
};

export default usePreventMemoryLeaks;
