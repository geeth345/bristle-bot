// App.js
import React, { lazy, Suspense } from 'react';
import { SwarmProvider } from './context/SwarmContext';
import SwarmDataManager from './components/SwarmDataManager';
import SwarmOverview from './components/SwarmOverview';
import LoadingIndicator from './components/LoadingIndicator';
import ErrorBoundary from './components/ErrorBoundary';
import './styles/App.css';

// Lazy load non-critical components to improve initial loading time
const Map = lazy(() => import('./components/Map'));
const BotsList = lazy(() => import('./components/BotsList'));
const ControlPanel = lazy(() => import('./components/ControlPanel'));

/**
 * Main App component
 * Orchestrates the complete swarm dashboard interface
 * 
 * @returns {JSX.Element} App component
 */
const App = () => {
  return (
    <ErrorBoundary fallback={<div className="error-fallback">Something went wrong. Please refresh.</div>}>
      <SwarmProvider>
        <div className="app">
          <header className="app-header">
            <h1>Swarm Robotics Dashboard</h1>
            <span className="system-date">
              {new Date().toLocaleString('en-GB', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                timeZoneName: 'short'
              })}
            </span>
          </header>
          
          <main className="app-content">
            <div className="app-map-container">
              <Suspense fallback={<LoadingIndicator message="Loading map visualization..." />}>
                <Map width={800} height={600} />
              </Suspense>
            </div>
            
            <div className="app-sidebar">
              <SwarmOverview />
              
              <Suspense fallback={<LoadingIndicator message="Loading control panel..." />}>
                <ControlPanel />
              </Suspense>
              
              <Suspense fallback={<LoadingIndicator message="Loading bots list..." />}>
                <BotsList />
              </Suspense>
            </div>
          </main>
          
          {/* WebSocket connection and data sync component */}
          <SwarmDataManager />
        </div>
      </SwarmProvider>
    </ErrorBoundary>
  );
};

export default App;