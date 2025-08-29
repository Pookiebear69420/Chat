const WebSocket = require("ws");

// Use environment variable for port, with fallback
const PORT = process.env.PORT || 8080;

// Create WebSocket server
const wss = new WebSocket.Server({ port: PORT });

// Centralized state management
const state = {
  users: new Set(),
  clients: new Map()
};

// Logging utility
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${type.toUpperCase()}] ${message}`);
}

// Broadcast to all connected clients
function broadcast(message, excludeClient = null) {
  wss.clients.forEach(client => {
    if (client !== excludeClient && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

// Main WebSocket connection handler
wss.on("connection", (ws) => {
  let username = null;

  log('New WebSocket connection established');

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

// Graceful shutdown
process.on('SIGINT', () => {
  log('SIGINT received. Closing WebSocket server.');
  wss.close(() => {
    log('WebSocket server closed.');
    process.exit(0);
  });
});

log(`WebSocket server running on port ${PORT}`);
