const WebSocket = require('ws');
const http = require('http');

// Render provides a PORT environment variable
const PORT = process.env.PORT || 8080;
const server = http.createServer();
const wss = new WebSocket.Server({ server });

// Room storage
const rooms = new Map();

wss.on('connection', (ws) => {
    let currentRoom = null;
    let playerId = null;

    ws.on('message', (message) => {
        const data = JSON.parse(message);

        switch (data.type) {
            case 'host':
                const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
                currentRoom = roomCode;
                playerId = 'p1';
                
                rooms.set(roomCode, {
                    p1: ws,
                    p2: null,
                    state: { status: 'waiting', turn: 'p1' }
                });
                
                ws.send(JSON.stringify({ type: 'hosted', code: roomCode }));
                console.log(`Room created: ${roomCode}`);
                break;

            case 'join':
                const code = data.code.toUpperCase();
                const room = rooms.get(code);

                if (room && !room.p2) {
                    currentRoom = code;
                    playerId = 'p2';
                    room.p2 = ws;
                    room.state.status = 'setup';
                    
                    // Notify both players
                    const joinMsg = JSON.stringify({ type: 'joined', role: 'p2' });
                    const startMsg = JSON.stringify({ type: 'sync', state: room.state });
                    
                    ws.send(joinMsg);
                    room.p1.send(startMsg);
                    ws.send(startMsg);
                    console.log(`Player 2 joined room: ${code}`);
                } else {
                    ws.send(JSON.stringify({ type: 'error', message: 'Room not found or full' }));
                }
                break;

            case 'update':
                // Sync data between players
                if (currentRoom && rooms.has(currentRoom)) {
                    const roomObj = rooms.get(currentRoom);
                    const opponent = playerId === 'p1' ? roomObj.p2 : roomObj.p1;
                    
                    if (opponent && opponent.readyState === WebSocket.OPEN) {
                        opponent.send(JSON.stringify({ 
                            type: 'sync', 
                            data: data.payload,
                            sender: playerId 
                        }));
                    }
                }
                break;
        }
    });

    ws.on('close', () => {
        if (currentRoom && rooms.has(currentRoom)) {
            const roomObj = rooms.get(currentRoom);
            const opponent = playerId === 'p1' ? roomObj.p2 : roomObj.p1;
            if (opponent) {
                opponent.send(JSON.stringify({ type: 'error', message: 'Opponent disconnected' }));
            }
            rooms.delete(currentRoom);
            console.log(`Room closed: ${currentRoom}`);
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});