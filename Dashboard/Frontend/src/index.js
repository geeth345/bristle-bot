import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// Get the root element from the DOM
const rootElement = document.getElementById('root');
// Create a root using the new React 18 API
const root = createRoot(rootElement);

// Render your app to the root
root.render(
  //<React.StrictMode>
    <App />
 // </React.StrictMode>
);
