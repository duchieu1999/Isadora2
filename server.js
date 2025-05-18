const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const app = express();

// Serve static files from public directory
app.use(express.static('public'));

// Handle all routes by serving index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Game state variables
const players = {};
let gameStarted = false;
let gameEndTime = null;

// Function to get the next 21:30 time
function getNext2130() {
  const now = new Date();
  const targetTime = new Date(now);
  targetTime.setHours(21, 30, 0, 0);
  
  if (targetTime < now) {
    // If 21:30 today has passed, set to tomorrow
    targetTime.setDate(targetTime.getDate() + 1);
  }
  
  return targetTime;
}

// Set game start time to the next 21:30
const gameStartTime = getNext2130();

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  // Handle player joining
  socket.on('join', (data) => {
    players[socket.id] = {
      id: socket.id,
      username: data.username,
      score: 0
    };
    
    // Send all players list to everyone
    io.emit('playerList', Object.values(players));
    
    // Send game start time to the new player
    socket.emit('gameStartTime', { startTime: gameStartTime.getTime() });
    
    // If game is in progress, notify new player
    if (gameStarted) {
      socket.emit('gameStarted', { endTime: gameEndTime });
    }
  });
  
  // Handle score updates
  socket.on('score', (data) => {
    if (players[socket.id]) {
      players[socket.id].score = data.score;
      
      // Send updated leaderboard to all players
      io.emit('leaderboard', Object.values(players));
    }
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    delete players[socket.id];
    
    // Send updated player list
    io.emit('playerList', Object.values(players));
  });
});

// Auto-start game at 21:30
const checkAndStartGame = () => {
  const now = new Date();
  const startTime = getNext2130();
  
  // Calculate milliseconds until next game start time
  const timeUntilStart = startTime - now;
  
  if (timeUntilStart <= 0 && !gameStarted) {
    gameStarted = true;
    gameEndTime = new Date(startTime.getTime() + 10 * 60 * 1000); // 10 minutes after start
    io.emit('gameStarted', { endTime: gameEndTime });
    
    // Schedule game end
    setTimeout(() => {
      gameStarted = false;
      io.emit('gameEnded', { 
        leaderboard: Object.values(players).sort((a, b) => b.score - a.score) 
      });
      
      // Reset scores for next game
      Object.keys(players).forEach(playerId => {
        players[playerId].score = 0;
      });
    }, 10 * 60 * 1000); // 10 minutes
  }
};

// Check every minute if game should start
setInterval(checkAndStartGame, 60 * 1000);
// Also check on server start
checkAndStartGame();

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Export app for Vercel
module.exports = app;
