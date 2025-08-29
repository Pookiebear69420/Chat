const WebSocket = require("ws");

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

let users = new Set();

wss.on("connection", (ws) => {
  let username = null;

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === "join" && data.username) {
        username = data.username;
        users.add(username);
        broadcastUserList();
      } else if (data.type === "chat-message" && data.author && data.text) {
        // Broadcast chat message to all clients
        broadcast(JSON.stringify(data));
      }
    } catch (e) {
      console.error("Invalid message", e);
    }
  });

  ws.on("close", () => {
    if (username) {
      users.delete(username);
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
  const msg = JSON.stringify({ type: "user-list", users: Array.from(users) });
  broadcast(msg);
}

console.log(`WebSocket server running on port ${PORT}`);
