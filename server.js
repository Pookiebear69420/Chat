const WebSocket = require("ws");
const http = require('http');

// Use environment variable for port, with fallback
const PORT = process.env.PORT || 8080;

// Create HTTP and WebSocket servers
const server = http.createServer();
const wss = new WebSocket.Server({ server });

// Centralized state management
const state = {
  users: new Set(),
  clients: new Map()
};

// Advanced logging utility with process and container info
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  console.log(JSON.stringify({
    timestamp,
    pid: process.pid,
    type: type.toUpperCase(),
    message,
    containerID: process.env.HOSTNAME || 'unknown'
  }));
}

// Broadcast to all connected clients
function broadcast(message, excludeClient = null) {
  try {
    wss.clients.forEach(client => {
      if (client !== excludeClient && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  } catch (error) {
    log(`Broadcast error: ${error.message}`, 'error');
  }
}

// Heartbeat mechanism to detect connection health
function noop() {}

function heartbeat() {
  this.isAlive = true;
}

// Main WebSocket connection handler
wss.on("connection", (ws) => {
  log('New WebSocket connection established');

  // Add heartbeat properties
  ws.isAlive = true;
  ws.on('pong', heartbeat);

  let username = null;

  ws.on("message", (messageData) => {
    try {
      const data = JSON.parse(messageData);

      switch(data.type) {
        case "join":
          username = data.username;
          state.users.add(username);
          state.clients.set(username, ws);
          
          log(`User joined: ${username}`);
          
          // Broadcast updated user list
          broadcast({ 
            type: "user-list", 
            users: Array.from(state.users) 
          });
          break;

        case "chat-message":
          if (data.recipient) {
            // Direct Message
            const recipientClient = state.clients.get(data.recipient);
            if (recipientClient) {
              recipientClient.send(JSON.stringify({
                type: "direct-message",
                from: username,
                text: data.text
              }));
            }
          } else {
            // Global Message
            broadcast({
              type: "chat-message",
              author: username,
              text: data.text
            }, ws);
          }
          break;
      }
    } catch (error) {
      log(`Message parsing error: ${error.message}`, 'error');
    }
  });

  ws.on("close", () => {
    if (username) {
      state.users.delete(username);
      state.clients.delete(username);
      
      log(`User disconnected: ${username}`);
      
      // Broadcast updated user list
      broadcast({ 
        type: "user-list", 
        users: Array.from(state.users) 
      });
    }
  });

  ws.on("error", (error) => {
    log(`WebSocket error: ${error.message}`, 'error');
  });
});

// Periodic connection health check
const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    
    ws.isAlive = false;
    ws.ping(noop);
  });
}, 30000);

// Start the server
server.listen(PORT, () => {
  log(`WebSocket server running on port ${PORT}`);
  log(`Server startup details:`, 'info', {
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    memoryUsage: process.memoryUsage()
  });
});

// Graceful shutdown
process.on('SIGINT', () => {
  log('SIGINT received. Closing WebSocket server.');
  
  clearInterval(interval);

  // Close WebSocket server
  wss.close(() => {
    log('WebSocket server closed.');
    
    // Close HTTP server
    server.close(() => {
      log('HTTP server closed.');
      process.exit(0);
    });
  });
});

// Handle unhandled promises
process.on('unhandledRejection', (reason, promise) => {
  log(`Unhandled Rejection at: ${promise}, reason: ${reason}`, 'error');
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  log(`Uncaught Exception: ${error.message}`, 'error');
  // Attempt graceful shutdown
  process.exit(1);
});
