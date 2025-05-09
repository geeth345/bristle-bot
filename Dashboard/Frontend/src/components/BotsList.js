// components/BotsList.js
import React, { useMemo } from 'react';
import { useSwarm } from '../context/SwarmContext';
import BotCard from './BotCard';
import '../styles/BotsList.css';

/**
 * BotsList component displays a list of all bots in the system
 * Optimized with useMemo to prevent unnecessary rendering
 * 
 * @returns {JSX.Element} Bots list component
 */
const BotsList = () => {
  const { bots } = useSwarm();
  
  // Use useMemo to prevent recreating the sorted list on every render
  const sortedBotIds = useMemo(() => {
    return Object.keys(bots).sort((a, b) => {
      // Sort by status first (active > searching > returning > inactive)
      const statusOrder = {
        active: 3,
        searching: 2,
        returning: 1,
        inactive: 0,
      };
      
      const statusA = bots[a]?.status || 'inactive';
      const statusB = bots[b]?.status || 'inactive';
      
      const statusDiff = (statusOrder[statusB] || 0) - (statusOrder[statusA] || 0);
      
      // If status is the same, sort alphabetically
      if (statusDiff === 0) {
        return a.localeCompare(b);
      }
      
      return statusDiff;
    });
  }, [bots]);
  
  // Render empty state if no bots
  if (sortedBotIds.length === 0) {
    return (
      <div className="bots-list">
        <h2>Bots</h2>
        <div className="bots-list__empty">
          No bots detected
        </div>
      </div>
    );
  }
  
  return (
    <div className="bots-list">
      <h2>Bots</h2>
      <div className="bots-list__grid">
        {sortedBotIds.map(botId => (
          <BotCard key={botId} botId={botId} />
        ))}
      </div>
    </div>
  );
};

export default React.memo(BotsList);
