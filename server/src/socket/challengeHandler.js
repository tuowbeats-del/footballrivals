const prisma = require('../db');

const ACTIVE_STATUSES = ['PENDING', 'FORMATION_SELECT', 'DRAFTING'];
const VALID_MODES = ['CLASSIC', 'EXPERT'];

// Quick match wachtrij per modus: mode -> { userId, username, socketId }
const matchQueue = new Map();

// Uitdagingen verlopen client-side na 30s; ruim niet-beantwoorde PENDING battles
// op zodat ze nieuwe uitdagingen niet eeuwig blokkeren
const PENDING_TTL_MS = 45 * 1000;

async function findActiveBattle(userIds) {
  await prisma.battle.updateMany({
    where: {
      status: 'PENDING',
      createdAt: { lt: new Date(Date.now() - PENDING_TTL_MS) },
    },
    data: { status: 'CANCELLED' },
  });
  return prisma.battle.findFirst({
    where: {
      status: { in: ACTIVE_STATUSES },
      OR: userIds.flatMap(uid => [{ player1Id: uid }, { player2Id: uid }]),
    },
  });
}

async function createBattle(player1Id, player2Id, mode) {
  return prisma.battle.create({
    data: {
      player1Id,
      player2Id,
      mode: VALID_MODES.includes(mode) ? mode : 'CLASSIC',
      status: 'PENDING',
    },
  });
}

function handleChallenge(io, socket, onlineUsers, _prisma) {
  socket.on('challenge:send', async ({ targetUserId, mode = 'CLASSIC' }) => {
    try {
      const targetId = parseInt(targetUserId);
      if (Number.isNaN(targetId)) return;
      const target = onlineUsers.get(targetId);
      if (!target) return socket.emit('error', { message: 'Speler is niet online' });
      if (targetId === socket.user.id) return socket.emit('error', { message: 'Je kunt jezelf niet uitdagen' });

      const activeBattle = await findActiveBattle([socket.user.id, targetId]);
      if (activeBattle) {
        return socket.emit('error', {
          message: 'Een van de spelers is al in een battle',
          battleId: activeBattle.id,
        });
      }

      const battle = await createBattle(socket.user.id, targetId, mode);

      io.to(`user:${targetId}`).emit('challenge:received', {
        from: { id: socket.user.id, username: socket.user.username },
        battleId: battle.id,
        mode: battle.mode,
      });

      socket.emit('challenge:sent', { battleId: battle.id, to: target.username, mode: battle.mode });
    } catch (err) {
      console.error('Challenge send error:', err);
      socket.emit('error', { message: 'Uitdaging verzenden mislukt' });
    }
  });

  socket.on('challenge:accept', async ({ battleId }) => {
    try {
      const bid = parseInt(battleId);
      if (Number.isNaN(bid)) return;
      const battle = await prisma.battle.findUnique({ where: { id: bid } });
      if (!battle || battle.player2Id !== socket.user.id || battle.status !== 'PENDING') {
        return socket.emit('error', { message: 'Ongeldige uitdaging' });
      }

      await prisma.battle.update({
        where: { id: bid },
        data: { status: 'FORMATION_SELECT' },
      });

      io.to(`user:${battle.player1Id}`).emit('challenge:accepted', { battleId: bid });
      io.to(`user:${battle.player2Id}`).emit('challenge:accepted', { battleId: bid });
    } catch (err) {
      console.error('Challenge accept error:', err);
      socket.emit('error', { message: 'Accepteren mislukt' });
    }
  });

  socket.on('challenge:decline', async ({ battleId }) => {
    try {
      const bid = parseInt(battleId);
      if (Number.isNaN(bid)) return;
      const battle = await prisma.battle.findUnique({ where: { id: bid } });
      if (!battle || battle.player2Id !== socket.user.id || battle.status !== 'PENDING') return;

      await prisma.battle.update({
        where: { id: bid },
        data: { status: 'CANCELLED' },
      });

      io.to(`user:${battle.player1Id}`).emit('challenge:declined', {
        by: socket.user.username,
        battleId: bid,
      });
    } catch (err) {
      console.error('Challenge decline error:', err);
    }
  });

  // Rematch vanaf de resultpagina: zelfde spelers, zelfde modus, rollen omgedraaid
  socket.on('challenge:rematch', async ({ battleId, mode }) => {
    try {
      const bid = parseInt(battleId);
      if (Number.isNaN(bid)) return;
      const oldBattle = await prisma.battle.findUnique({ where: { id: bid } });
      if (!oldBattle || oldBattle.status !== 'FINISHED') return;
      if (oldBattle.player1Id !== socket.user.id && oldBattle.player2Id !== socket.user.id) return;

      const opponentId = oldBattle.player1Id === socket.user.id ? oldBattle.player2Id : oldBattle.player1Id;

      // Rematch tegen een bot: direct een nieuw oefenpotje op hetzelfde niveau
      const { getBotLevel } = require('../services/botService');
      const botLevel = getBotLevel(opponentId);
      if (botLevel) {
        const { createBotBattle } = require('./battleHandler');
        const botBattle = await createBotBattle(socket.user.id, mode || oldBattle.mode, botLevel);
        if (!botBattle) return socket.emit('error', { message: 'Bot niet beschikbaar' });
        if (botBattle.error) return socket.emit('error', { message: botBattle.error, battleId: botBattle.battleId });
        return io.to(`user:${socket.user.id}`).emit('queue:matched', {
          battleId: botBattle.id,
          opponent: botBattle.botUsername,
          mode: botBattle.mode,
          practice: true,
        });
      }

      if (!onlineUsers.has(opponentId)) {
        return socket.emit('error', { message: 'Je tegenstander is niet meer online' });
      }

      const activeBattle = await findActiveBattle([socket.user.id, opponentId]);
      if (activeBattle) {
        return socket.emit('error', { message: 'Een van de spelers is al in een battle' });
      }

      const battle = await createBattle(socket.user.id, opponentId, mode || oldBattle.mode);

      io.to(`user:${opponentId}`).emit('challenge:received', {
        from: { id: socket.user.id, username: socket.user.username },
        battleId: battle.id,
        mode: battle.mode,
        rematch: true,
      });
      socket.emit('challenge:sent', {
        battleId: battle.id,
        to: onlineUsers.get(opponentId).username,
        mode: battle.mode,
      });
    } catch (err) {
      console.error('Rematch error:', err);
      socket.emit('error', { message: 'Rematch starten mislukt' });
    }
  });

  // Quick match: zoek een willekeurige tegenstander in dezelfde modus
  socket.on('queue:join', async ({ mode = 'CLASSIC' }) => {
    try {
      if (!VALID_MODES.includes(mode)) mode = 'CLASSIC';

      const activeBattle = await findActiveBattle([socket.user.id]);
      if (activeBattle) {
        return socket.emit('error', { message: 'Je zit al in een battle', battleId: activeBattle.id });
      }

      const waiting = matchQueue.get(mode);
      if (waiting && waiting.userId !== socket.user.id) {
        // Match gevonden — check dat de wachtende speler nog online is
        if (!onlineUsers.has(waiting.userId)) {
          matchQueue.delete(mode);
        } else {
          matchQueue.delete(mode);
          const battle = await createBattle(waiting.userId, socket.user.id, mode);
          await prisma.battle.update({ where: { id: battle.id }, data: { status: 'FORMATION_SELECT' } });

          io.to(`user:${waiting.userId}`).emit('queue:matched', {
            battleId: battle.id,
            opponent: socket.user.username,
            mode,
          });
          io.to(`user:${socket.user.id}`).emit('queue:matched', {
            battleId: battle.id,
            opponent: waiting.username,
            mode,
          });
          return;
        }
      }

      matchQueue.set(mode, { userId: socket.user.id, username: socket.user.username, socketId: socket.id });
      socket.emit('queue:waiting', { mode });
    } catch (err) {
      console.error('Queue join error:', err);
      socket.emit('error', { message: 'Quick match mislukt' });
    }
  });

  socket.on('queue:leave', () => {
    for (const [mode, waiting] of matchQueue.entries()) {
      if (waiting.userId === socket.user.id) matchQueue.delete(mode);
    }
    socket.emit('queue:left');
  });

  socket.on('disconnect', () => {
    for (const [mode, waiting] of matchQueue.entries()) {
      if (waiting.socketId === socket.id) matchQueue.delete(mode);
    }
  });
}

module.exports = { handleChallenge };
