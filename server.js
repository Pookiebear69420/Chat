const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
  cors: {
    origin: '*',
  },
  path: '/api/socket' // Vercel requires a specific path for WebSocket
});

const users = {};
const usernames = new Set();

// Serve static files from the public folder
app.use(express.static('public'));

// Handle root route to ensure index.html is served
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Socket.io logic
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join', (username) => {
    if (usernames.has(username)) {
      socket.emit('username_taken');
    } else {
      users[socket.id] = username;
      usernames.add(username);
      socket.emit('joined');
      io.emit('userList', Array.from(usernames));
      io.emit('userCount', usernames.size);
      console.log(`User joined: ${username}`);
    }
  });

  socket.on('message', (data) => {
    if (data.message.startsWith('/pm ')) {
      const parts = data.message.split(' ');
      const targetUsername = parts[1];
      const privateMessage = parts.slice(2).join(' ');
      const targetSocket = Object.keys(users).find(id => users[id] === targetUsername);
      if (targetSocket) {
        io.to(targetSocket).emit('message', {
          username: `${data.username} (Private)`,
          message: privateMessage,
          timestamp: data.timestamp
        });
        socket.emit('message', {
          username: `${data.username} (Private to ${targetUsername})`,
          message: privateMessage,
          timestamp: data.timestamp
        });
        console.log(`Private message from ${data.username} to ${targetUsername}`);
      } else {
        socket.emit('message', { username: 'System', message: 'User not found', timestamp: Date.now() });
        console.log(`User not found for PM from ${data.username}`);
      }
    } else {
      io.emit('message', data);
      console.log(`Broadcast message from ${data.username}: ${data.message}`);
    }
  });

  socket.on('typing', (data) => {
    socket.broadcast.emit('userTyping', data);
    console.log(`${data.username} is typing`);
  });

  socket.on('stopTyping', (data) => {
    socket.broadcast.emit('userStoppedTyping', data);
    console.log(`${data.username} stopped typing`);
  });

  socket.on('disconnect', () => {
    const username = users[socket.id];
    if (username) {
      usernames.delete(username);
      delete users[socket.id];
      io.emit('userList', Array.from(usernames));
      io.emit('userCount', usernames.size);
      console.log(`User disconnected: ${username}`);
    }
  });

  socket.on('error', (error) => {
    console.error('Socket error:', error.message);
  });
});

// Vercel uses PORT from environment, fallback to 3000 for local
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
