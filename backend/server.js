const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    // Faster ghost detection: check every 10s, timeout after 15s
    pingInterval: 10000,
    pingTimeout: 15000,
});

// Track which room each socket is in
let socketRooms = {};

// Helper: purge dead/ghost sockets from a room
function purgeGhosts(roomCode) {
    const room = io.sockets.adapter.rooms.get(roomCode);
    if (!room) return;

    for (const socketId of room) {
        const s = io.sockets.sockets.get(socketId);
        if (!s || s.disconnected) {
            console.log(`GHOST PURGED: ${socketId} from room ${roomCode}`);
            room.delete(socketId);
            delete socketRooms[socketId];
        }
    }
    // If room is now empty, adapter auto-cleans it
}

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // 1. Join a specific "Tracking Room" (MAX 2 PEOPLE)
    socket.on('join', (roomCode) => {
        // Purge any ghost sockets before checking capacity
        purgeGhosts(roomCode);

        const room = io.sockets.adapter.rooms.get(roomCode);
        const numClients = room ? room.size : 0;

        if (numClients >= 2) {
            console.log(`REJECTED join for ${roomCode}: Room Full (${numClients} clients)`);
            socket.emit('error', 'Room is Full (Max 2 People)');
            return;
        }

        socket.join(roomCode);
        socketRooms[socket.id] = roomCode;
        console.log(`User ${socket.id} joined room: ${roomCode} (${numClients + 1}/2)`);

        // Confirm to Self
        socket.emit('join_success');

        // Notify others a partner connected
        socket.to(roomCode).emit('partner_connected');
    });

    // 2. The Tracker requests location (Remote Wake Request)
    socket.on('request_location', (roomCode) => {
        console.log(`Location requested for room ${roomCode}`);
        socket.to(roomCode).emit('wake_up_and_send_location');
    });

    // 3. The Target sends their location
    socket.on('send_location', ({ roomCode, location }) => {
        console.log(`Location received in ${roomCode}`);
        socket.to(roomCode).emit('update_map', location);
    });

    // 4. Emergency / Call Me Alert
    socket.on('emergency_alert', ({ roomCode, location, phoneNumber }) => {
        console.log(`EMERGENCY ALERT in ${roomCode}`);
        socket.to(roomCode).emit('receive_alert', { location, phoneNumber });
    });

    // 5. Stop Tracking signal
    socket.on('stop_tracking', (roomCode) => {
        io.to(roomCode).emit('sleep');
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        const roomCode = socketRooms[socket.id];
        if (roomCode) {
            socket.to(roomCode).emit('partner_disconnected');
            delete socketRooms[socket.id];
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`SERVER RUNNING on *:${PORT}`);
    console.log('Your Switchboard is ready. (V7 - Ghost Purge)');
});

