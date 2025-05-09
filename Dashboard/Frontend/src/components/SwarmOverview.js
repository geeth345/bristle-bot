// components/SwarmOverview.js
import React, { useMemo } from 'react';
import { useSwarm } from '../context/SwarmContext';
import '../styles/SwarmOverview.css';

/**
 * SwarmOverview component displays summary statistics about the swarm
 * Includes active bots count, average battery, and target position
 * 
 * @returns {JSX.Element} Swarm overview component
 */
const SwarmOverview = () => {
  const { bots, target, connectionStatus } = useSwarm();
  
  // Compute statistics from bot data
  // Using useMemo to prevent recalculating on every render
  const stats = useMemo(() => {
    const botsList = Object.values(bots);
    const activeBots = botsList.filter(bot => bot.status === 'active' || bot.status === 'searching');
    const totalBots = botsList.length;
    
    // Calculate average battery level
    const batterySum = botsList.reduce((sum, bot) => sum + (bot.battery || 0), 0);
    const avgBattery = totalBots > 0 ? (batterySum / totalBots).toFixed(1) : 0;
    
    return {
      activeBots: activeBots.length,
      totalBots,
      avgBattery,
    };
  }, [bots]);
  
  return (
    <div className="swarm-overview">
      <h2>Swarm Overview</h2>
      
      <div className="swarm-overview__stats">
        <div className="swarm-overview__stat">
          <span className="swarm-overview__label">Active Bots:</span>
          <span className="swarm-overview__value">
            {stats.activeBots}/{stats.totalBots}
          </span>
        </div>
        
        <div className="swarm-overview__stat">
          <span className="swarm-overview__label">Avg Battery:</span>
          <span className="swarm-overview__value">
            {stats.avgBattery}%
          </span>
        </div>
        
        <div className="swarm-overview__stat">
          <span className="swarm-overview__label">Target:</span>
          <span className="swarm-overview__value">
            {target && target.position 
              ? `(${target.position.x.toFixed(2)}, ${target.position.y.toFixed(2)})`
              : 'No target'}
          </span>
        </div>
        
        <div className="swarm-overview__stat">
          <span className="swarm-overview__label">Status:</span>
          <span className={`swarm-overview__value swarm-overview__status--${connectionStatus}`}>
            {connectionStatus.charAt(0).toUpperCase() + connectionStatus.slice(1)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default React.memo(SwarmOverview);
