const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
  cors: {
    origin: '*',
  }
});

const users = {}; // {socket.id: username}
const usernames = new Set(); // For quick uniqueness check

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

io.on('connection', (socket) => {
  console.log('User connected');

  socket.on('join', (username) => {
    if (usernames.has(username)) {
      socket.emit('username_taken');
    } else {
      users[socket.id] = username;
      usernames.add(username);
      socket.emit('joined');
      io.emit('userList', Array.from(usernames));
      io.emit('userCount', usernames.size);
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
      } else {
        socket.emit('message', { username: 'System', message: 'User not found', timestamp: Date.now() });
      }
    } else {
      io.emit('message', data);
    }
  });

  socket.on('typing', (data) => {
    socket.broadcast.emit('userTyping', data);
  });

  socket.on('stopTyping', (data) => {
    socket.broadcast.emit('userStoppedTyping', data);
  });

  socket.on('disconnect', () => {
    const username = users[socket.id];
    if (username) {
      usernames.delete(username);
      delete users[socket.id];
      io.emit('userList', Array.from(usernames));
      io.emit('userCount', usernames.size);
    }
    console.log('User disconnected');
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
