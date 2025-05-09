const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

// Create Express app
const app = express();
const port = process.env.PORT || 8000;

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocket.Server({ server, path: '/ws/swarm' });
const cmdWss = new WebSocket.Server({ server, path: '/ws/command' });

// Client state tracking for reconnection
const clientStates = new Map();

// Packet loss simulation
const PACKET_LOSS_RATE = 0.05; // 5% packet loss for simulation

// Serve static files (optional)
app.use(express.static(path.join(__dirname, 'public')));

// Allow CORS for development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Sample data
const bots = {
  'Alpha': { position: { x: 70, y: 120 }, battery: 92, status: 'active' },
  'Bravo': { position: { x: 210, y: 220 }, battery: 54, status: 'searching' },
  'Charlie': { position: { x: 120, y: 80 }, battery: 28, status: 'returning' },
  'Delta': { position: { x: 260, y: 90 }, battery: 76, status: 'active' },
  'Echo': { position: { x: 40, y: 270 }, battery: 15, status: 'inactive' }
};

const beacons = {
  '1': { position: { x: 120, y: 40 } },
  '2': { position: { x: 650, y: 40 } },
  '3': { position: { x: 380, y: 380 } }
};

let target = { position: { x: 380, y: 200 }, confidence: 0.85 };

// Add at the top with other sample data
const soundIntensities = {};  // Store sound intensity at grid positions
const trajectoryHistory = {}; // Store movement history for each bot
const historyLength = 20;     // Number of positions to store per bot

// Initialize trajectory history for each bot
Object.keys(bots).forEach(id => {
  trajectoryHistory[id] = [bots[id].position];
});

// Create intensity grid (simulate sound propagation)
function updateSoundIntensityGrid() {
  // Create a 20x15 grid covering 800x600 space
  const gridSize = { x: 20, y: 15 };
  const cellWidth = 800 / gridSize.x;
  const cellHeight = 600 / gridSize.y;
  
  // Source position (use target as sound source)
  const sourceX = target.position.x;
  const sourceY = target.position.y;
  
  // Generate intensity based on distance from source
  for (let x = 0; x < gridSize.x; x++) {
    for (let y = 0; y < gridSize.y; y++) {
      const cellX = x * cellWidth + cellWidth/2;
      const cellY = y * cellHeight + cellHeight/2;
      
      // Calculate distance from source
      const dx = cellX - sourceX;
      const dy = cellY - sourceY;
      const distance = Math.sqrt(dx*dx + dy*dy);
      
      // Intensity follows inverse square law with some noise
      const baseIntensity = Math.min(1, 10000 / (distance*distance + 100));
      const noise = (Math.random() - 0.5) * 0.1;
      
      // Add pulsing effect (inspired by firefly synchronization)
      const time = Date.now() / 1000;
      const pulse = 0.2 * Math.sin(time * 2) * baseIntensity;
      
      // Store intensity with temporal variation
      soundIntensities[`${x},${y}`] = Math.max(0, Math.min(1, baseIntensity + noise + pulse));
    }
  }
  
  return soundIntensities;
}

// Add Lévy walk movement pattern
function levyWalk(currentPosition, bounds = { width: 800, height: 600 }) {
  // Parameters for Lévy distribution
  const mu = 1.5;  // Characteristic exponent (1 < mu <= 3)
  
  // Generate step length from power law distribution
  const u = Math.random();
  const stepLength = Math.pow(u, -1/mu) % 50;  // Limit maximum step
  
  // Random direction
  const angle = Math.random() * 2 * Math.PI;
  
  // Calculate new position
  const dx = stepLength * Math.cos(angle);
  const dy = stepLength * Math.sin(angle);
  
  // Apply bounds
  const newX = Math.min(Math.max(currentPosition.x + dx, 0), bounds.width);
  const newY = Math.min(Math.max(currentPosition.y + dy, 0), bounds.height);
  
  return { x: newX, y: newY };
}

// Function to simulate packet loss
function shouldDropPacket() {
  return Math.random() < PACKET_LOSS_RATE;
}

// Add REST API endpoints for initial state and recovery
app.get('/api/state', (req, res) => {
  const clientId = req.query.clientId;
  if (clientId && clientStates.has(clientId)) {
    res.json(clientStates.get(clientId));
  } else {
    res.status(404).json({ error: 'No state found' });
  }
});

app.get('/api/bots', (req, res) => {
  res.json(bots);
});

app.get('/api/beacons', (req, res) => {
  res.json(beacons);
});

app.get('/api/target', (req, res) => {
  res.json(target);
});

app.get('/api/intensities', (req, res) => {
  res.json(updateSoundIntensityGrid());
});

app.get('/api/trajectories', (req, res) => {
  res.json(trajectoryHistory);
});

// Handle WebSocket connections
wss.on('connection', (ws, req) => {
  // Extract client ID from request (could be in query params or headers)
  let clientId = null;
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    clientId = url.searchParams.get('clientId');
  } catch (error) {
    console.log('Error parsing URL:', error);
  }
  
  console.log(`Client connected to swarm websocket. ID: ${clientId || 'unknown'}`);
  
  // Store client ID with the connection
  ws.clientId = clientId;
  
  // If reconnecting with known client ID, restore previous state
  let isReconnection = false;
  if (clientId && clientStates.has(clientId)) {
    isReconnection = true;
    console.log(`Client ${clientId} reconnected. Restoring state...`);
    
    // Send reconnection acknowledgment
    ws.send(JSON.stringify({
      type: 'reconnection_successful',
      timestamp: Date.now()
    }));
  }
  
  // Send initial data for bots and beacons
  Object.entries(bots).forEach(([id, data]) => {
    ws.send(JSON.stringify({
      type: 'bot_update',
      id,
      ...data
    }));
  });
  
  Object.entries(beacons).forEach(([id, data]) => {
    ws.send(JSON.stringify({
      type: 'beacon_update',
      id,
      ...data
    }));
  });
  
  // Send initial target data
  ws.send(JSON.stringify({
    type: 'target_update',
    ...target
  }));
  
  // Send initial intensity grid and trajectory data
  ws.send(JSON.stringify({
    type: 'intensity_grid',
    data: updateSoundIntensityGrid()
  }));
  
  ws.send(JSON.stringify({
    type: 'trajectory_history',
    data: trajectoryHistory
  }));
  
  // Simulate real-time updates with more detailed movement logic
  const interval = setInterval(() => {
    if (ws.readyState !== WebSocket.OPEN) return;
    
    // Update bot positions with Lévy walk
    Object.entries(bots).forEach(([id, bot]) => {
      if (bot.status !== 'inactive') {
        // Use Lévy walk for searching bots, more direct movement for others
        let newPosition;
        if (bot.status === 'searching') {
          // Lévy walk for exploration
          newPosition = levyWalk(bot.position);
        } else if (bot.status === 'returning') {
          // Return toward origin with some noise
          const dx = 0 - bot.position.x;
          const dy = 0 - bot.position.y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          const step = Math.min(5, dist);
          const normX = dx / dist || 0;
          const normY = dy / dist || 0;
          
          newPosition = {
            x: bot.position.x + normX * step + (Math.random() - 0.5) * 2,
            y: bot.position.y + normY * step + (Math.random() - 0.5) * 2
          };
        } else {
          // Active bots move toward sound source with intensity-based speed
          const cellX = Math.floor(bot.position.x / 40);
          const cellY = Math.floor(bot.position.y / 40);
          const intensity = soundIntensities[`${cellX},${cellY}`] || 0.1;
          
          const dx = target.position.x - bot.position.x;
          const dy = target.position.y - bot.position.y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          
          // Speed depends on intensity (stronger signal = faster movement)
          const step = Math.min(intensity * 10, dist);
          const normX = dx / dist || 0;
          const normY = dy / dist || 0;
          
          newPosition = {
            x: bot.position.x + normX * step + (Math.random() - 0.5) * 3,
            y: bot.position.y + normY * step + (Math.random() - 0.5) * 3
          };
        }
        
        // Apply bounds
        bot.position.x = Math.min(Math.max(newPosition.x, 0), 800);
        bot.position.y = Math.min(Math.max(newPosition.y, 0), 600);
        
        // Update trajectory history
        trajectoryHistory[id].push({...bot.position});
        if (trajectoryHistory[id].length > historyLength) {
          trajectoryHistory[id].shift();
        }
        
        // Calculate intensity at bot's location
        const cellX = Math.floor(bot.position.x / 40);
        const cellY = Math.floor(bot.position.y / 40);
        const intensity = soundIntensities[`${cellX},${cellY}`] || 0;
        
        // Add intensity to the bot data
        bot.intensity = intensity;
        
        // Simulate battery drain (higher intensity = higher drain)
        bot.battery = Math.max(0, bot.battery - (0.01 + intensity * 0.05));
        
        // Send update with simulated packet loss
        if (!shouldDropPacket()) {
          ws.send(JSON.stringify({
            type: 'bot_update',
            id,
            ...bot
          }));
        } else {
          console.log(`Simulated packet loss for bot ${id}`);
        }
      }
    });
    
    // Update target with some randomness (mimicking a moving sound source)
    if (Math.random() < 0.1) {
      // Move target
      target.position.x += (Math.random() - 0.5) * 20;
      target.position.y += (Math.random() - 0.5) * 20;
      
      // Keep within bounds
      target.position.x = Math.min(Math.max(target.position.x, 0), 800);
      target.position.y = Math.min(Math.max(target.position.y, 0), 600);
      
      // Vary confidence to simulate measurement uncertainty
      target.confidence = Math.min(0.95, Math.max(0.6, target.confidence + (Math.random() - 0.5) * 0.1));
      
      // Send target update
      ws.send(JSON.stringify({
        type: 'target_update',
        ...target
      }));
      
      // Update and send intensity grid
      ws.send(JSON.stringify({
        type: 'intensity_grid',
        data: updateSoundIntensityGrid()
      }));
    }
    
    // Send trajectory updates periodically
    if (Math.random() < 0.2) {
      ws.send(JSON.stringify({
        type: 'trajectory_history',
        data: trajectoryHistory
      }));
    }
  }, 200); // More frequent updates for smoother animation
  
  // Add periodic state saving for reconnection
  const stateInterval = setInterval(() => {
    if (ws.clientId) {
      clientStates.set(ws.clientId, {
        bots,
        target,
        trajectoryHistory,
        lastUpdate: Date.now()
      });
    }
  }, 1000);
  
  // Handle client disconnect
  ws.on('close', () => {
    console.log(`Client disconnected from swarm websocket: ${ws.clientId || 'unknown'}`);
    clearInterval(interval);
    clearInterval(stateInterval);
    
    // Keep state for reconnection for up to 5 minutes
    if (ws.clientId) {
      setTimeout(() => {
        if (clientStates.has(ws.clientId)) {
          console.log(`Removing stored state for client ${ws.clientId}`);
          clientStates.delete(ws.clientId);
        }
      }, 5 * 60 * 1000);
    }
  });
});

// Handle command WebSocket connections
cmdWss.on('connection', (ws) => {
  console.log('Client connected to command websocket');
  
  // Handle incoming commands
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('Received command:', data);
      
      // Echo the command back for confirmation
      ws.send(JSON.stringify({
        type: 'command_confirmation',
        success: true,
        command: data
      }));
      
      // If it's a status change command, update the bot status
      if (data.action && data.target && data.target !== 'all') {
        const statusMap = {
          'start_localization': 'active',
          'stop': 'inactive',
          'return_home': 'returning'
        };
        
        if (statusMap[data.action] && bots[data.target]) {
          bots[data.target].status = statusMap[data.action];
          
          // Broadcast to all swarm connections
          wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'bot_update',
                id: data.target,
                ...bots[data.target]
              }));
            }
          });
        }
      }
    } catch (error) {
      console.error('Error parsing command:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Invalid command format'
      }));
    }
  });
  
  // Handle disconnect
  ws.on('close', () => {
    console.log('Client disconnected from command websocket');
  });
});

// Start server
server.listen(port, () => {
  console.log(`Mock server running on http://localhost:${port}`);
  console.log(`WebSocket endpoints:`);
  console.log(`- ws://localhost:${port}/ws/swarm (data stream)`);
  console.log(`- ws://localhost:${port}/ws/command (command channel)`);
});