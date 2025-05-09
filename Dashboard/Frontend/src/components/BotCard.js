// components/BotCard.js
import React, { memo, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useSwarm } from '../context/SwarmContext';
import usePreventMemoryLeaks from '../hooks/usePreventMemoryLeaks';
import '../styles/BotCard.css';

// Time threshold for considering bot data stale
const STALE_THRESHOLD = 10000; // 10 seconds

/**
 * BotCard component for displaying individual bot information
 * Optimized for performance with conditional rendering and memoization
 * 
 * @param {Object} props - Component props
 * @returns {JSX.Element} Bot card component
 */
const BotCard = memo(({ botId }) => {
  const { bots, selectedBot, selectBot, lastUpdateTimestamp } = useSwarm();
  const [isStale, setIsStale] = useState(false);
  const bot = bots[botId];
  const { setManagedTimeout, clearManagedTimeout } = usePreventMemoryLeaks();
  const [staleCheckTimer, setStaleCheckTimer] = useState(null);
  
  /**
   * Check if bot data is stale based on last update timestamp
   * This helps identify disconnected bots
   */
  useEffect(() => {
    const checkFreshness = () => {
      if (!bot || !bot.lastUpdated) {
        setIsStale(true);
        return;
      }
      
      const now = Date.now();
      setIsStale(now - bot.lastUpdated > STALE_THRESHOLD);
    };
    
    // Cancel previous timer
    if (staleCheckTimer) {
      clearManagedTimeout(staleCheckTimer);
    }
    
    // Check immediately
    checkFreshness();
    
    // Set up timer to check periodically
    const timerId = setManagedTimeout(checkFreshness, 1000);
    setStaleCheckTimer(timerId);
    
    // Clean up on unmount or when bot changes
    return () => {
      if (staleCheckTimer) {
        clearManagedTimeout(staleCheckTimer);
      }
    };
  }, [bot, clearManagedTimeout, setManagedTimeout, staleCheckTimer]);
  
  /**
   * Update stale status when we receive an update for this bot
   * This ensures the UI reflects the latest data state
   */
  useEffect(() => {
    const lastUpdate = lastUpdateTimestamp[`bot_${botId}`];
    if (lastUpdate) {
      setIsStale(Date.now() - lastUpdate > STALE_THRESHOLD);
    }
  }, [lastUpdateTimestamp, botId]);
  
  /**
   * If no bot data is available, render minimal placeholder to save resources
   * This reduces DOM complexity for missing bots
   */
  if (!bot) {
    return (
      <div className="bot-card bot-card--placeholder">
        <h3>{botId}</h3>
        <div className="bot-card__status">Unavailable</div>
      </div>
    );
  }
  
  const { battery = 0, status = 'unknown', position = { x: 0, y: 0 } } = bot;
  const isSelected = selectedBot === botId;
  
  // Determine status class for styling
  let statusClass = 'bot-card__status--unknown';
  if (isStale) {
    statusClass = 'bot-card__status--stale';
  } else {
    const statusMap = {
      'active': 'bot-card__status--active',
      'inactive': 'bot-card__status--inactive',
      'searching': 'bot-card__status--searching',
      'returning': 'bot-card__status--returning'
    };
    statusClass = statusMap[status] || statusClass;
  }
  
  // Determine battery level class for styling
  let batteryClass = 'bot-card__battery--critical';
  if (battery > 70) {
    batteryClass = 'bot-card__battery--high';
  } else if (battery > 30) {
    batteryClass = 'bot-card__battery--medium';
  } else if (battery > 15) {
    batteryClass = 'bot-card__battery--low';
  }
  
  return (
    <div 
      className={`bot-card ${isSelected ? 'bot-card--selected' : ''}`}
      onClick={() => selectBot(botId)}
    >
      <div className="bot-card__header">
        <h3>{botId}</h3>
        <div className={`bot-card__status ${statusClass}`}>
          {isStale ? 'Stale' : status}
        </div>
      </div>
      
      <div className="bot-card__info">
        <div className={`bot-card__battery ${batteryClass}`}>
          <div 
            className="bot-card__battery-fill" 
            style={{ width: `${battery}%` }}
          ></div>
          <span className="bot-card__battery-text">{`${battery}%`}</span>
        </div>
        
        <div className="bot-card__position">
          <span>X: {position.x.toFixed(2)}</span>
          <span>Y: {position.y.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
});

BotCard.propTypes = {
  botId: PropTypes.string.isRequired,
};

export default BotCard;
