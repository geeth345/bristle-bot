const WebSocket = require('ws');
const http = require('http');
const { URL } = require('url');

// ###################################################
// #               Swarm State Management            #
// ###################################################
const bots = {
  'Alpha': { position: { x: 70, y: 120 }, battery: 92, status: 'active' },
  'Bravo': { position: { x: 210, y: 220 }, battery: 54, status: 'searching' },
  'Charlie': { position: { x: 150, y: 350 }, battery: 78, status: 'returning' },
  'Delta': { position: { x: 300, y: 400 }, battery: 23, status: 'inactive' }
};

const beacons = {
  'Beacon1': { position: { x: 100, y: 100 } },
  'Beacon2': { position: { x: 400, y: 300 } },
  'Beacon3': { position: { x: 250, y: 200 } }
};

let target = {
  position: { x: 200, y: 200 },
  confidence: 0.75
};

// ###################################################
// #               Position Validation               #
// ###################################################
function sanitizePosition(pos, defaultValue = 0, minValue = 0, maxValue = 500) {
  if (pos === undefined || pos === null || Number.isNaN(Number(pos)) || !Number.isFinite(Number(pos))) {
    return defaultValue;
  }
  const posNum = Number(pos);
  return Math.max(minValue, Math.min(maxValue, posNum));
}

// ###################################################
// #               Server Infrastructure             #
// ###################################################
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Swarm Control WebSocket Server\n');
});

const wss = new WebSocket.Server({ 
  noServer: true,
});

// ###################################################
// #               Logging Utilities                 #
// ###################################################
function log(...args) {
  console.log(`[${new Date().toISOString()}]`, ...args);
}

// ###################################################
// #               CORS & Upgrade Handling           #
// ###################################################
server.on('upgrade', (request, socket, head) => {
  log(`Upgrade request received for: ${request.url}`);
  
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS, UPGRADE',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  if (request.method === 'OPTIONS') {
    socket.write('HTTP/1.1 204 No Content\r\n' +
      Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join('\r\n') +
      '\r\n\r\n');
    socket.destroy();
    return;
  }

  try {
    const parsedUrl = new URL(request.url, `http://${request.headers.host}`);
    const path = parsedUrl.pathname;
    if (path !== '/ws/swarm' && path !== '/ws/swarm/') {
      log(`Path validation failed: ${path}`);
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      log('Connection upgraded successfully');
      wss.emit('connection', ws, request);
    });
  } catch (err) {
    log('Error during connection upgrade:', err);
    socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
    socket.destroy();
  }
});

// ###################################################
// #              Connection Management              #
// ###################################################
const CONNECTION_TIMEOUT = 30000; // 30 seconds

wss.on('connection', (ws, req) => {
  // Add connection grace period
  const connectionGracePeriod = 1000; // 1 second
  const clientId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  
  setTimeout(() => {
    if (ws.readyState !== WebSocket.OPEN) return;

    log(`Client ${clientId} connected`);
    ws.isAlive = true;
    ws.clientId = clientId;
    ws.connectTime = Date.now();
    ws.lastMessageTime = Date.now();

    try {
      sendToClient(ws, {
        type: 'connection_ack',
        clientId,
        message: 'Connected to Swarm Control System',
        timestamp: Date.now()
      });
    } catch (e) {
      log(`Initial connection ACK failed for ${clientId}:`, e);
      ws.close(1011, 'Server error');
      return;
    }

    // Send initial state with error handling
    const sendInitialState = () => {
      try {
        if (ws.readyState === WebSocket.OPEN) {
          sendToClient(ws, {
            type: 'full_state',
            bots,
            beacons,
            target,
            timestamp: Date.now()
          });
        }
      } catch (e) {
        log(`Initial state send failed for ${clientId}:`, e);
        ws.close(1011, 'Server error');
      }
    };
    setTimeout(sendInitialState, 200);

    ws.on('pong', () => {
      ws.isAlive = true;
      ws.lastMessageTime = Date.now();
      log(`Received pong from client ${clientId}`);
    });

    ws.on('message', (data) => {
      ws.lastMessageTime = Date.now();
      try {
        let message;
        try {
          message = JSON.parse(data);
        } catch (e) {
          if (data.toString() === 'ping') {
            sendToClient(ws, 'pong');
            return;
          }
          throw new Error('Invalid JSON format');
        }
        
        switch(message.type) {
          case 'ping':
            sendToClient(ws, { 
              type: 'pong', 
              timestamp: Date.now(),
              original: message.timestamp 
            });
            break;
            
          case 'request_update':
            sendToClient(ws, {
              type: 'full_state',
              bots,
              beacons,
              target,
              timestamp: Date.now()
            });
            break;
            
          default:
            log(`Unknown message type from ${clientId}: ${message.type}`);
            sendToClient(ws, {
              type: 'error',
              message: `Unsupported message type: ${message.type}`,
              timestamp: Date.now()
            });
        }
      } catch (e) {
        log(`Error processing message from ${clientId}:`, e);
        sendToClient(ws, {
          type: 'error',
          message: 'Server error processing message',
          timestamp: Date.now()
        });
      }
    });

    // Modified close handler
    ws.on('close', (code, reason) => {
      if (code === 1001) {
        log(`Client ${clientId} navigation close (normal browser tab closure)`);
      } else {
        log(`Client ${clientId} disconnected: ${code} ${reason || ''}`);
      }
    });

    ws.on('error', (error) => {
      log(`Error with client ${clientId}:`, error);
    });
  }, connectionGracePeriod);
});

// ###################################################
// #              Connection Health Monitoring       #
// ###################################################
const heartbeatInterval = 15000;
const connectionChecker = setInterval(() => {
  log(`Checking ${wss.clients.size} connections...`);
  
  wss.clients.forEach((ws) => {
    const now = Date.now();
    
    // Check for zombie connections
    if (now - ws.lastMessageTime > CONNECTION_TIMEOUT) {
      log(`Terminating zombie client ${ws.clientId || 'unknown'}`);
      return ws.terminate();
    }
    
    if (ws.isAlive === false) {
      log(`Terminating inactive client ${ws.clientId || 'unknown'}`);
      return ws.terminate();
    }
    
    ws.isAlive = false;
    
    try {
      // Protocol-level ping only
      ws.ping();
    } catch (err) {
      log(`Error sending ping to ${ws.clientId || 'unknown'}:`, err);
      ws.terminate();
    }
  });
}, heartbeatInterval);

// ###################################################
// #              State Simulation Engine            #
// ###################################################
function simulateSwarm() {
  if (wss.clients.size === 0) return;

  Object.entries(bots).forEach(([name, bot]) => {
    bot.position.x = sanitizePosition(
      bot.position.x + (Math.random() - 0.5) * 8,
      0, 0, 500
    );
    bot.position.y = sanitizePosition(
      bot.position.y + (Math.random() - 0.5) * 8,
      0, 0, 500
    );
    bot.battery = sanitizePosition(
      bot.battery - 0.1 + (Math.random() > 0.95 ? 2 : 0),
      0, 0, 100
    );
    
    if (Math.random() > 0.97) {
      bot.status = ['active', 'searching', 'returning', 'inactive'][
        Math.floor(Math.random() * 4)
      ];
    }
  });

  target.confidence = sanitizePosition(
    target.confidence + (Math.random() - 0.5) * 0.08,
    0.5, 0.1, 0.95
  );
  target.position.x = sanitizePosition(
    target.position.x + (Math.random() - 0.5) * 6,
    200, 0, 500
  );
  target.position.y = sanitizePosition(
    target.position.y + (Math.random() - 0.5) * 6,
    200, 0, 500
  );

  try {
    broadcast({
      type: 'state_update',
      bots,
      target,
      timestamp: Date.now()
    });
  } catch (e) {
    log('Error broadcasting state update:', e);
  }
  
  if (Math.random() > 0.8) {
    try {
      broadcast({
        type: 'beacon_update',
        beacons,
        timestamp: Date.now()
      });
    } catch (e) {
      log('Error broadcasting beacon update:', e);
    }
  }
}

function broadcast(data) {
  const message = JSON.stringify(data);
  let clientCount = 0;
  
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
        clientCount++;
      } catch (e) {
        log(`Error broadcasting to ${client.clientId || 'unknown'}:`, e);
      }
    }
  });
  
  if (clientCount > 0) {
    log(`Broadcasted ${data.type} to ${clientCount} clients`);
  }
}

// ###################################################
// #              Server Lifecycle Management        #
// ###################################################
process.on('SIGINT', () => {
  log('Server shutting down...');
  clearInterval(connectionChecker);
  
  wss.clients.forEach(client => {
    try {
      sendToClient(client, {
        type: 'system_message',
        message: 'Server shutting down',
        timestamp: Date.now()
      });
      client.close(1001, 'Server shutdown');
    } catch (e) {
      log(`Error closing client ${client.clientId || 'unknown'}:`, e);
    }
  });
  
  setTimeout(() => {
    server.close(() => {
      log('Server stopped');
      process.exit(0);
    });
  }, 500);
});

server.listen(8000, () => {
  log(`Swarm server operational on ws://localhost:8000/ws/swarm`);
  setInterval(simulateSwarm, 250);
});

function sendToClient(ws, data) {
  if (ws.readyState !== WebSocket.OPEN) return;
  
  try {
    const message = typeof data === 'string' ? data : JSON.stringify(data);
    ws.send(message);
  } catch (err) {
    log(`Error sending to ${ws.clientId || 'unknown'}:`, err);
    ws.terminate();
  }
}
