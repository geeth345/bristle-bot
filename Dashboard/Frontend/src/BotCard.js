import React from 'react';
import './BotCard.css';

const BotCard = ({ bot }) => {
  return (
    <div className="bot-card">
      <h3>Bot #{bot.id}</h3>
      <div className="content">
        <p>X: {bot.x.toFixed(2)}</p>
        <p>Y: {bot.y.toFixed(2)}</p>
      </div>
    </div>
  );
};

export default BotCard;
