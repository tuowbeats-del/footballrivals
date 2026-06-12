const { Server } = require('socket.io');
const { verifyToken } = require('../utils/jwt');
const prisma = require('../db');
const { handleLobby } = require('./lobbyHandler');
const { handleChallenge } = require('./challengeHandler');
const { handleBattle } = require('./battleHandler');

// userId -> { username, connections } — meerdere tabbladen per gebruiker mogelijk
const onlineUsers = new Map();

function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL
        ? process.env.CLIENT_URL.split(',')
        : ['http://localhost:5173', 'http://localhost:3001'],
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Auth middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('Geen token'));
      const payload = verifyToken(token);
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, username: true, role: true, isBlocked: true },
      });
      if (!user) return next(new Error('Gebruiker niet gevonden'));
      if (user.isBlocked) return next(new Error('Account geblokkeerd'));
      socket.user = user;
      next();
    } catch (e) {
      next(new Error('Ongeldig token'));
    }
  });

  io.on('connection', (socket) => {
    const { id, username } = socket.user;

    // Persoonlijke room zodat events alle tabbladen van een gebruiker bereiken
    socket.join(`user:${id}`);

    // BELANGRIJK: handlers synchroon registreren vóór enige await —
    // events die tijdens een async gap binnenkomen worden anders stil gedropt
    handleLobby(io, socket, onlineUsers, prisma);
    handleChallenge(io, socket, onlineUsers, prisma);
    handleBattle(io, socket, onlineUsers, prisma);

    const existing = onlineUsers.get(id);
    if (existing) {
      existing.connections += 1;
    } else {
      onlineUsers.set(id, { username, connections: 1 });
      prisma.user.update({
        where: { id },
        data: { isOnline: true, lastSeen: new Date() },
      }).catch(() => {}).finally(() => broadcastOnlineUsers(io));
    }

    socket.on('disconnect', async () => {
      const entry = onlineUsers.get(id);
      if (!entry) return;
      entry.connections -= 1;
      // Pas offline als het laatste tabblad sluit
      if (entry.connections <= 0) {
        onlineUsers.delete(id);
        try {
          await prisma.user.update({
            where: { id },
            data: { isOnline: false, lastSeen: new Date() },
          });
        } catch {}
        broadcastOnlineUsers(io);
      }
    });
  });

  return io;
}

function broadcastOnlineUsers(io) {
  const list = Array.from(onlineUsers.entries()).map(([uid, u]) => ({
    id: uid,
    username: u.username,
  }));
  io.emit('lobby:users', list);
}

module.exports = { initSocket };
