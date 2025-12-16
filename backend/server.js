const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Store active users: { "socketId": { role: "tracker/target", id: "userA" } }
let users = {};

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // 1. Join a specific "Tracking Room" (MAX 2 PEOPLE)
    socket.on('join', (roomCode) => {
        const room = io.sockets.adapter.rooms.get(roomCode);
        const numClients = room ? room.size : 0;

        if (numClients >= 2) {
            console.log(`REJECTED join for ${roomCode}: Room Full`);
            socket.emit('error', 'Room is Full (Max 2 People)');
            return;
        }

        socket.join(roomCode);
        console.log(`User ${socket.id} joined room: ${roomCode} (${numClients + 1}/2)`);

        // Confirm to Self
        socket.emit('join_success');

        // Notify others a partner connected
        socket.to(roomCode).emit('partner_connected');
    });

    // 2. The Tracker requests location (Remote Wake Request)
    socket.on('request_location', (roomCode) => {
        console.log(`Location requested for room ${roomCode}`);
        // Broadcast to everyone in room (specifically the target) to wake up
        io.to(roomCode).emit('wake_up_and_send_location');
    });

    // 3. The Target sends their location
    socket.on('send_location', ({ roomCode, location }) => {
        console.log(`Location received in ${roomCode}`);
        // Forward to the Tracker
        socket.to(roomCode).emit('update_map', location);
    });

    // 4. Emergency / Call Me Alert
    socket.on('emergency_alert', ({ roomCode, location, phoneNumber }) => {
        console.log(`EMERGENCY ALERT in ${roomCode}`);
        // Broadcast to everyone (except sender)
        socket.to(roomCode).emit('receive_alert', { location, phoneNumber });
    });

    // 5. Stop Tracking signal
    socket.on('stop_tracking', (roomCode) => {
        io.to(roomCode).emit('sleep');
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

server.listen(3000, () => {
    console.log('SERVER RUNNING on *:3000');
    console.log('Your Switchboard is ready.');
});
