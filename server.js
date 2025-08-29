const WebSocket = require("ws");

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

let users = new Set();
let clients = new Map(); // Track WebSocket connections by username

wss.on("connection", (ws) => {
  let username = null;

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);

      switch(data.type) {
        case "join":
          username = data.username;
          users.add(username);
          clients.set(username, ws);
          broadcastUserList();
          break;

        case "chat-message":
          if (data.recipient) {
            // Direct Message
            const recipientClient = clients.get(data.recipient);
            if (recipientClient) {
              recipientClient.send(JSON.stringify({
                type: "direct-message",
                from: username,
                text: data.text
              }));
              // Send confirmation to sender
              ws.send(JSON.stringify({
                type: "direct-message",
                from: username,
                text: data.text,
                recipient: data.recipient,
                self: true
              }));
            }
          } else {
            // Broadcast to all
            broadcast(JSON.stringify({
              type: "chat-message",
              author: username,
              text: data.text
            }));
          }
          break;
      }
    } catch (e) {
      console.error("Invalid message", e);
    }
  });

  ws.on("close", () => {
    if (username) {
      users.delete(username);
      clients.delete(username);
      broadcastUserList();
    }
  });
});

function broadcast(msg) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

function broadcastUserList() {
  const msg = JSON.stringify({ 
    type: "user-list", 
    users: Array.from(users) 
  });
  broadcast(msg);
}

console.log(`WebSocket server running on port ${PORT}`);
