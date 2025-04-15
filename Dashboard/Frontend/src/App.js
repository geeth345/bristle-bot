import React, { useState, useEffect } from 'react';
import BotCard from './BotCard';
import './App.css';

const App = () => {
  const [bots, setBots] = useState([]);
  const [target, setTarget] = useState({ x: 0, y: 0 });
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [botsRes, targetRes] = await Promise.all([
          fetch('http://localhost:5000/get_bot_states'),
          fetch('http://localhost:8000/localize_target')
        ]);
        
        if (!botsRes.ok) throw new Error('Failed to fetch bots');
        if (!targetRes.ok) throw new Error('Failed to fetch target');
        
        const botsData = await botsRes.json();
        const targetData = await targetRes.json();
        
        setBots(botsData);
        setTarget(targetData);
      } catch (err) {
        setError(err.message);
      }
    };

    fetchData();
    
    // Set up periodic data refresh
    const intervalId = setInterval(fetchData, 5000);
    return () => clearInterval(intervalId);
  }, []);

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  return (
    <div className="container">
      <h1 className="header">Swarm Control Dashboard</h1>
      
      <div className="grid">
        {bots.map(bot => (
          <BotCard key={bot.id} bot={bot} />
        ))}
      </div>

      <div className="target">
        <h2>Target Position</h2>
        <p>X: {target.x.toFixed(2)}</p>
        <p>Y: {target.y.toFixed(2)}</p>
      </div>
    </div>
  );
};

export default App;

