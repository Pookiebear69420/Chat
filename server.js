const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// Store connected users
const users = new Map();

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Root route serves index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Handle user joining
    socket.on('join', (username) => {
        // Check if username is already taken
        const existingUser = Array.from(users.values()).find(user => user.username === username);
        if (existingUser) {
            socket.emit('username_taken');
            return;
        }

        // Add user to users map
        users.set(socket.id, { 
            username: username, 
            socketId: socket.id 
        });

        socket.emit('joined');
        
        // Update user count and list for all clients
        io.emit('userCount', users.size);
        io.emit('userList', Array.from(users.values()).map(user => user.username));
        
        console.log(`${username} joined the chat`);
    });

    // Handle messages
    socket.on('message', (data) => {
        const user = users.get(socket.id);
        if (user) {
            // Broadcast message to all connected clients
            io.emit('message', {
                username: user.username,
                message: data.message,
                timestamp: data.timestamp
            });
        }
    });

    // Handle typing indicators
    socket.on('typing', (data) => {
        socket.broadcast.emit('userTyping', data);
    });

    socket.on('stopTyping', (data) => {
        socket.broadcast.emit('userStoppedTyping', data);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        const user = users.get(socket.id);
        if (user) {
            console.log(`${user.username} disconnected`);
            users.delete(socket.id);
            
            // Update user count and list for all clients
            io.emit('userCount', users.size);
            io.emit('userList', Array.from(users.values()).map(user => user.username));
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
