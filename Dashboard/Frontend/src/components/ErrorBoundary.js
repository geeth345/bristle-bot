// components/ErrorBoundary.js
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import '../styles/ErrorBoundary.css';

/**
 * ErrorBoundary component catches JavaScript errors in child components
 * Prevents entire app from crashing if one component fails
 * 
 * @extends Component
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  /**
   * Update state when error occurs
   * @param {Error} error - Error that was thrown
   * @returns {Object} Updated state
   */
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  /**
   * Log error information when caught
   * @param {Error} error - Error that was thrown
   * @param {React.ErrorInfo} errorInfo - React error info object
   */
  componentDidCatch(error, errorInfo) {
    console.error('Error caught by ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
    
    // Log error to monitoring service in production
    if (process.env.NODE_ENV === 'production') {
      // Example: logErrorToService(error, errorInfo);
    }
  }

  /**
   * Reset error state to allow retry
   */
  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback } = this.props;

    if (hasError) {
      // If a custom fallback is provided, use it
      if (fallback) {
        return typeof fallback === 'function' 
          ? fallback(error, errorInfo, this.handleReset)
          : fallback;
      }
      
      // Otherwise render default error UI
      return (
        <div className="error-boundary">
          <h2 className="error-boundary__heading">Something went wrong</h2>
          <p className="error-boundary__message">
            {error?.toString() || 'An unexpected error occurred'}
          </p>
          <button 
            className="error-boundary__button"
            onClick={this.handleReset}
          >
            Try Again
          </button>
          {process.env.NODE_ENV !== 'production' && errorInfo && (
            <details className="error-boundary__details">
              <summary>Error Details</summary>
              <pre className="error-boundary__stack">
                {errorInfo.componentStack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return children;
  }
}

ErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired,
  fallback: PropTypes.oneOfType([
    PropTypes.node,
    PropTypes.func,
  ]),
};

export default ErrorBoundary;
