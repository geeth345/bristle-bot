// components/ControlPanel.js
import React, { useState, useCallback } from 'react';
import { useSwarm } from '../context/SwarmContext';
import useWebSocketOptimized, { ReadyState } from '../hooks/useWebSocketOptimized';
import usePreventMemoryLeaks from '../hooks/usePreventMemoryLeaks';
import '../styles/ControlPanel.css';

/**
 * ControlPanel component provides user controls for the swarm system
 * Includes commands for bot control and system settings
 * 
 * @returns {JSX.Element} Control panel component
 */
const ControlPanel = () => {
  const { bots, selectedBot, connectionStatus } = useSwarm();
  const [command, setCommand] = useState('');
  const [feedback, setFeedback] = useState('');
  const { isMounted, setManagedTimeout, clearManagedTimeout } = usePreventMemoryLeaks();
  const [feedbackTimer, setFeedbackTimer] = useState(null);
  
  // Initialize WebSocket connection for commands
  const { sendJsonMessage, readyState } = useWebSocketOptimized('ws://localhost:8000/ws/swarm', {
    debugMode: false,
  });
  
  /**
   * Display feedback message with auto-clear after delay
   * @param {string} message - Feedback message
   * @param {number} duration - Duration in milliseconds
   */
  const showFeedback = useCallback((message, duration = 3000) => {
    setFeedback(message);
    
    // Clear any existing timer
    if (feedbackTimer) {
      clearManagedTimeout(feedbackTimer);
    }
    
    // Set new timer
    const timerId = setManagedTimeout(() => {
      if (isMounted.current) {
        setFeedback('');
      }
    }, duration);
    
    setFeedbackTimer(timerId);
  }, [setManagedTimeout, clearManagedTimeout, isMounted, feedbackTimer]);
  
  /**
   * Send command to the selected bot or all bots
   * @param {string} actionType - Command type
   */
  const sendCommand = useCallback((actionType) => {
    if (readyState !== ReadyState.OPEN) {
      showFeedback('Command channel not connected', 5000);
      return;
    }
    
    const target = selectedBot || 'all';
    
    sendJsonMessage({
      action: actionType,
      target,
      params: command ? { command } : undefined
    });
    
    showFeedback(`Sent ${actionType} command to ${target}`);
    setCommand('');
  }, [readyState, selectedBot, command, sendJsonMessage, showFeedback]);
  
  /**
   * Handle command input change
   * @param {Object} e - Event object
   */
  const handleCommandChange = (e) => {
    setCommand(e.target.value);
  };
  
  /**
   * Handle command form submission
   * @param {Object} e - Event object
   */
  const handleSubmit = (e) => {
    e.preventDefault();
    if (command.trim()) {
      sendCommand('custom');
    }
  };
  
  const isConnected = connectionStatus === 'connected';
  const hasSelectedBot = !!selectedBot;
  
  return (
    <div className="control-panel">
      <h2>Control Panel</h2>
      
      <div className="control-panel__actions">
        <div className="control-panel__action-group">
          <h3>Movement</h3>
          
          <div className="control-panel__buttons">
            <button 
              className="control-panel__button"
              onClick={() => sendCommand('move_forward')}
              disabled={!isConnected}
            >
              Forward
            </button>
            
            <button 
              className="control-panel__button"
              onClick={() => sendCommand('move_backward')}
              disabled={!isConnected}
            >
              Backward
            </button>
            
            <button 
              className="control-panel__button"
              onClick={() => sendCommand('turn_left')}
              disabled={!isConnected}
            >
              Left
            </button>
            
            <button 
              className="control-panel__button"
              onClick={() => sendCommand('turn_right')}
              disabled={!isConnected}
            >
              Right
            </button>
            
            <button 
              className="control-panel__button control-panel__button--warning"
              onClick={() => sendCommand('stop')}
              disabled={!isConnected}
            >
              Stop
            </button>
          </div>
        </div>
        
        <div className="control-panel__action-group">
          <h3>Mode</h3>
          
          <div className="control-panel__buttons">
            <button 
              className="control-panel__button control-panel__button--primary"
              onClick={() => sendCommand('start_localization')}
              disabled={!isConnected}
            >
              Start Localization
            </button>
            
            <button 
              className="control-panel__button control-panel__button--secondary"
              onClick={() => sendCommand('return_home')}
              disabled={!isConnected}
            >
              Return Home
            </button>
          </div>
        </div>
        
        <div className="control-panel__action-group">
          <h3>Custom Command</h3>
          
          <form className="control-panel__command-form" onSubmit={handleSubmit}>
            <input 
              type="text"
              value={command}
              onChange={handleCommandChange}
              placeholder="Enter custom command"
              disabled={!isConnected}
              className="control-panel__input"
            />
            
            <button 
              type="submit"
              disabled={!isConnected || !command.trim()}
              className="control-panel__button"
            >
              Send
            </button>
          </form>
        </div>
      </div>
      
      {feedback && (
        <div className="control-panel__feedback">
          {feedback}
        </div>
      )}
      
      <div className="control-panel__footer">
        <span className="control-panel__status">
          {hasSelectedBot ? `Selected: ${selectedBot}` : 'No bot selected'}
        </span>
      </div>
    </div>
  );
};

export default React.memo(ControlPanel);
