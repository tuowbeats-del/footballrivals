function handleLobby(io, socket, onlineUsers, prisma) {
  socket.on('lobby:join', () => {
    socket.join('lobby');
    // Send current users to the joining socket
    const users = Array.from(onlineUsers.entries()).map(([uid, u]) => ({
      id: uid,
      username: u.username,
    }));
    socket.emit('lobby:users', users);
  });

  socket.on('lobby:leave', () => {
    socket.leave('lobby');
  });

  socket.on('lobby:chat', async ({ message }) => {
    if (!message || typeof message !== 'string') return;
    const clean = message.trim().slice(0, 300);
    if (!clean) return;

    try {
      const saved = await prisma.chatMessage.create({
        data: {
          userId: socket.user.id,
          message: clean,
          type: 'LOBBY',
        },
        include: { user: { select: { username: true } } },
      });

      io.to('lobby').emit('lobby:message', {
        id: saved.id,
        username: saved.user.username,
        message: saved.message,
        time: saved.createdAt,
      });
    } catch (err) {
      console.error('Lobby chat error:', err);
    }
  });
}

module.exports = { handleLobby };
