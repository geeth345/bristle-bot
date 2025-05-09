// components/LoadingIndicator.js
import React from 'react';
import PropTypes from 'prop-types';
import '../styles/LoadingIndicator.css';

/**
 * LoadingIndicator component displays a loading spinner
 * Used during lazy loading or async operations
 * 
 * @param {Object} props - Component props
 * @returns {JSX.Element} Loading indicator component
 */
const LoadingIndicator = ({ message = 'Loading...' }) => {
  return (
    <div className="loading-indicator">
      <div className="loading-indicator__spinner"></div>
      <p className="loading-indicator__message">{message}</p>
    </div>
  );
};

LoadingIndicator.propTypes = {
  message: PropTypes.string,
};

export default LoadingIndicator;
