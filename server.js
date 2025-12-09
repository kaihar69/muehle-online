const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// --- SPEICHER ---
let players = {}; // Speichert: { socketId: { color: 'white', name: 'Kai' } }
let hallOfFame = []; // Speichert die Gewinner: [{name: 'Kai', date: '...'}]
let activePlayerCount = 0;

io.on('connection', (socket) => {
    console.log('Neuer Spieler: ' + socket.id);

    // Hall of Fame sofort an den Neuen senden
    socket.emit('updateHallOfFame', hallOfFame);

    // Wenn voll ist -> Zuschauer
    if (activePlayerCount >= 2) {
        socket.emit('spectator', true);
    }

    // --- EREIGNISSE ---

    // Spieler tritt bei (mit Name und Wunsch-Farbe oder automatisch)
    socket.on('joinGame', (playerName) => {
        if (activePlayerCount >= 2) return;

        activePlayerCount++;
        const assignedColor = activePlayerCount === 1 ? 'white' : 'black';
        
        players[socket.id] = { color: assignedColor, name: playerName };

        // Dem Spieler sagen, wer er ist
        socket.emit('player-assignment', { color: assignedColor, name: playerName });
        
        // Allen sagen, wer alles da ist (Namen updaten)
        io.emit('updatePlayerNames', Object.values(players));
    });

    socket.on('playerAction', (data) => {
        io.emit('updateBoard', data);
    });

    // Ein Spieler meldet einen Sieg (für die Hall of Fame)
    socket.on('reportWin', (winnerColor) => {
        // Finde den Namen des Gewinners
        let winnerName = "Unbekannt";
        for (let id in players) {
            if (players[id].color === winnerColor) {
                winnerName = players[id].name;
                break;
            }
        }

        // In die Liste eintragen (Maximal die letzten 10)
        const entry = { name: winnerName, time: new Date().toLocaleTimeString('de-DE', {hour: '2-digit', minute:'2-digit'}) };
        hallOfFame.unshift(entry); // Vorne anfügen
        if (hallOfFame.length > 10) hallOfFame.pop(); // Liste kurz halten

        io.emit('updateHallOfFame', hallOfFame);
    });

    socket.on('gameStart', (startColor) => {
        io.emit('resetGame', startColor);
    });

    socket.on('disconnect', () => {
        if (players[socket.id]) {
            activePlayerCount--;
            delete players[socket.id];
            io.emit('updatePlayerNames', Object.values(players)); // Namen entfernen
            io.emit('opponentLeft');
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server läuft auf Port ${PORT}`);
});
