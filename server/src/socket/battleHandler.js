const prisma = require('../db');
const {
  FORMATION_NAMES, POSITION_GROUPS, calculateScore, findSlotForPlayer, teamHasFittingPick,
} = require('../services/gameService');
const { simulateSeason, getTier, determineWinner } = require('../services/seasonService');
const { calculateElo } = require('../services/eloService');
const { checkAndAward } = require('../services/achievementService');
const { getBotId, getBotLevel, isBotId, chooseBotFormation, chooseBotPick } = require('../services/botService');

const TOTAL_ROUNDS = 11;
const PICK_TIMEOUT_MS = 60000;

// In-memory cache per battle; altijd herop te bouwen vanuit de database
const battleStates = new Map();

function emptyState(battle) {
  return {
    battleId: battle.id,
    player1Id: battle.player1Id,
    player2Id: battle.player2Id,
    mode: battle.mode,
    formation1: battle.formation1 || null,
    formation2: battle.formation2 || null,
    currentRound: battle.currentRound || 0,
    roundId: null,
    // Elke speler draft uit zijn eigen club-seizoen
    clubSeason1Id: null,
    clubSeason2Id: null,
    used1: [],
    used2: [],
    picks: {},            // `${round}_${userId}` -> { playerId, slot, pending? }
    filled1: new Set(),   // bezette slots speler 1
    filled2: new Set(),
    advancing: false,     // guard tegen dubbele ronde-start / finalize
    finalizing: false,
    timer: null,
    deadline: null,
    // Oefenpotje tegen een bot: geen ELO, geen stats
    botId: isBotId(battle.player2Id) ? battle.player2Id : (isBotId(battle.player1Id) ? battle.player1Id : null),
  };
}

/**
 * Herbouw de battle-state vanuit de database (na server-herstart of late join).
 */
async function loadState(battleId) {
  if (battleStates.has(battleId)) return battleStates.get(battleId);

  const battle = await prisma.battle.findUnique({
    where: { id: battleId },
    include: {
      rounds: { include: { picks: true }, orderBy: { roundNumber: 'asc' } },
    },
  });
  if (!battle) return null;

  const state = emptyState(battle);
  for (const round of battle.rounds) {
    state.used1.push(round.clubSeason1Id);
    state.used2.push(round.clubSeason2Id);
    if (round.roundNumber === battle.currentRound) {
      state.roundId = round.id;
      state.clubSeason1Id = round.clubSeason1Id;
      state.clubSeason2Id = round.clubSeason2Id;
    }
    for (const pick of round.picks) {
      state.picks[`${round.roundNumber}_${pick.userId}`] = { playerId: pick.playerId, slot: pick.slot };
      if (pick.userId === battle.player1Id) state.filled1.add(pick.slot);
      else state.filled2.add(pick.slot);
    }
  }
  battleStates.set(battleId, state);
  return state;
}

// In EXPERT-modus krijgen spelers geen ratings of stats te zien tijdens het draften
function sanitizePlayer(player, mode) {
  if (mode === 'EXPERT') {
    return { id: player.id, name: player.name, position: player.position, nationality: player.nationality };
  }
  return player;
}

// CLASSIC: beste eerst. EXPERT: op positie/naam, anders verraadt de volgorde de ratings
const GROUP_ORDER = { GK: 0, DEF: 1, MID: 2, ATT: 3 };
function sortForMode(players, mode) {
  const sorted = [...players];
  if (mode === 'EXPERT') {
    sorted.sort((a, b) =>
      (GROUP_ORDER[POSITION_GROUPS[a.position]] - GROUP_ORDER[POSITION_GROUPS[b.position]])
      || a.name.localeCompare(b.name));
  } else {
    sorted.sort((a, b) => b.rating - a.rating);
  }
  return sorted;
}

function pickKey(round, userId) {
  return `${round}_${userId}`;
}

function bothPicked(state) {
  const k1 = state.picks[pickKey(state.currentRound, state.player1Id)];
  const k2 = state.picks[pickKey(state.currentRound, state.player2Id)];
  return k1 && !k1.pending && k2 && !k2.pending;
}

function clearTimer(state) {
  if (state.timer) {
    clearTimeout(state.timer);
    state.timer = null;
  }
  state.deadline = null;
}

function handleBattle(io, socket, onlineUsers, _prisma) {

  socket.on('battle:join', async ({ battleId }) => {
    const bid = parseInt(battleId);
    if (Number.isNaN(bid)) return socket.emit('battle:error', { message: 'Ongeldige battle' });
    try {
      const battle = await prisma.battle.findUnique({
        where: { id: bid },
        include: {
          player1: { select: { id: true, username: true } },
          player2: { select: { id: true, username: true } },
        },
      });
      if (!battle) return socket.emit('battle:error', { message: 'Battle niet gevonden' });
      if (battle.player1Id !== socket.user.id && battle.player2Id !== socket.user.id) {
        return socket.emit('battle:error', { message: 'Geen toegang tot deze battle' });
      }

      socket.join(`battle:${bid}`);
      const state = await loadState(bid);

      const isP1 = battle.player1Id === socket.user.id;
      const myFilled = isP1 ? state.filled1 : state.filled2;

      // Verzamel picks van beide spelers (gesorteerd per ronde) voor herstel na refresh
      const allPicks = await prisma.draftPick.findMany({
        where: { battleRound: { battleId: bid } },
        include: { player: true },
        orderBy: { pickOrder: 'asc' },
      });
      const hideStats = state.mode === 'EXPERT' && battle.status !== 'FINISHED';
      const mapPick = (p) => ({
        slot: p.slot,
        round: p.pickOrder,
        player: hideStats ? sanitizePlayer(p.player, 'EXPERT') : p.player,
      });
      const myPicks = allPicks.filter(p => p.userId === socket.user.id).map(mapPick);
      const oppPicks = allPicks.filter(p => p.userId !== socket.user.id).map(mapPick);

      // Herstel: beide picks binnen maar de ronde is nooit doorgeschoven
      // (bv. server-crash op precies dat moment)
      if (battle.status === 'DRAFTING' && state.currentRound > 0 && bothPicked(state) && !state.advancing) {
        state.advancing = true;
        try {
          if (state.currentRound >= TOTAL_ROUNDS) await finalizeBattle(io, state);
          else await startNextRound(io, state);
        } finally {
          state.advancing = false;
        }
      }

      // Lopende ronde meesturen als er nog gepickt moet worden
      let round = null;
      if (battle.status === 'DRAFTING' && state.currentRound > 0 && !bothPicked(state)) {
        const roundRow = await prisma.battleRound.findUnique({
          where: { battleId_roundNumber: { battleId: bid, roundNumber: state.currentRound } },
          include: {
            clubSeason1: { include: { club: true, season: true } },
            clubSeason2: { include: { club: true, season: true } },
          },
        });
        if (roundRow) {
          state.roundId = roundRow.id;
          state.clubSeason1Id = roundRow.clubSeason1Id;
          state.clubSeason2Id = roundRow.clubSeason2Id;
          const myClubSeason = isP1 ? roundRow.clubSeason1 : roundRow.clubSeason2;
          const oppClubSeason = isP1 ? roundRow.clubSeason2 : roundRow.clubSeason1;
          const pickedIds = allPicks.map(p => p.playerId);
          const players = await prisma.footballPlayer.findMany({
            where: { clubSeasonId: myClubSeason.id, id: { notIn: pickedIds } },
          });
          // Geen timer actief (bv. na herstart)? Start een nieuwe
          if (!state.timer) startPickTimer(io, state);
          round = {
            round: state.currentRound,
            club: myClubSeason.club.name,
            clubCountry: myClubSeason.club.country,
            season: myClubSeason.season.label,
            oppClub: oppClubSeason.club.name,
            oppSeason: oppClubSeason.season.label,
            players: sortForMode(players, state.mode).map(p => sanitizePlayer(p, state.mode)),
            deadline: state.deadline,
          };
        }
      }

      // Bot vergeten te picken (bv. na server-herstart)? Opnieuw inplannen
      if (battle.status === 'DRAFTING' && state.botId && state.currentRound > 0) {
        const botEntry = state.picks[pickKey(state.currentRound, state.botId)];
        if (!botEntry) scheduleBotPick(io, state);
      }

      const myPickEntry = state.picks[pickKey(state.currentRound, socket.user.id)];
      socket.emit('battle:state', {
        battleId: bid,
        status: battle.status,
        mode: battle.mode,
        practice: !!state.botId,
        formation1: state.formation1,
        formation2: state.formation2,
        currentRound: state.currentRound,
        totalRounds: TOTAL_ROUNDS,
        player1: battle.player1,
        player2: battle.player2,
        myPicks,
        oppPicks,
        myFilledSlots: Array.from(myFilled),
        iHavePicked: !!(myPickEntry && !myPickEntry.pending),
        round,
      });
    } catch (err) {
      console.error('battle:join error:', err);
      socket.emit('battle:error', { message: 'Battle ophalen mislukt' });
    }
  });

  socket.on('battle:formation', async ({ battleId, formation }) => {
    const bid = parseInt(battleId);
    if (Number.isNaN(bid)) return;
    if (!FORMATION_NAMES.includes(formation)) {
      return socket.emit('battle:error', { message: 'Ongeldige formatie' });
    }

    try {
      const battle = await prisma.battle.findUnique({ where: { id: bid } });
      if (!battle) return socket.emit('battle:error', { message: 'Battle niet gevonden' });
      if (battle.status !== 'FORMATION_SELECT' && battle.status !== 'PENDING') {
        return socket.emit('battle:error', { message: 'Kan formatie nu niet instellen' });
      }
      if (battle.player1Id !== socket.user.id && battle.player2Id !== socket.user.id) {
        return socket.emit('battle:error', { message: 'Geen toegang' });
      }

      const state = await loadState(bid);
      const isP1 = battle.player1Id === socket.user.id;

      if ((isP1 && state.formation1) || (!isP1 && state.formation2)) {
        return socket.emit('battle:error', { message: 'Formatie al ingesteld' });
      }

      if (isP1) state.formation1 = formation;
      else state.formation2 = formation;

      await prisma.battle.update({
        where: { id: bid },
        data: isP1 ? { formation1: formation } : { formation2: formation },
      });

      io.to(`battle:${bid}`).emit('battle:formation:set', {
        userId: socket.user.id,
        username: socket.user.username,
        formation,
      });

      // Beide formaties gekozen → eerste ronde. De currentRound-check plus de
      // advancing-guard voorkomen een dubbele start als beide spelers vrijwel
      // tegelijk bevestigen (er zit een await tussen het zetten en deze check).
      if (state.formation1 && state.formation2 && state.currentRound === 0 && !state.advancing) {
        state.advancing = true;
        try {
          await startNextRound(io, state);
        } finally {
          state.advancing = false;
        }
      }
    } catch (err) {
      console.error('battle:formation error:', err);
      socket.emit('battle:error', { message: 'Formatie instellen mislukt' });
    }
  });

  socket.on('battle:pick', async ({ battleId, playerId }) => {
    const bid = parseInt(battleId);
    const pid = parseInt(playerId);
    if (Number.isNaN(bid) || Number.isNaN(pid)) return;
    try {
      const state = await loadState(bid);
      if (!state) return socket.emit('battle:error', { message: 'Battle niet gevonden' });
      if (state.player1Id !== socket.user.id && state.player2Id !== socket.user.id) {
        return socket.emit('battle:error', { message: 'Geen toegang' });
      }
      await makePick(io, state, socket.user.id, pid, socket);
    } catch (err) {
      console.error('battle:pick error:', err);
      socket.emit('battle:error', { message: 'Pick mislukt' });
    }
  });

  // Oefenpotje tegen een bot starten
  socket.on('battle:bot', async ({ mode = 'CLASSIC', level = 'medium' }) => {
    try {
      const battle = await createBotBattle(socket.user.id, mode, level);
      if (!battle) {
        return socket.emit('error', { message: 'Bot niet beschikbaar' });
      }
      if (battle.error) {
        return socket.emit('error', { message: battle.error, battleId: battle.battleId });
      }
      io.to(`user:${socket.user.id}`).emit('queue:matched', {
        battleId: battle.id,
        opponent: battle.botUsername,
        mode: battle.mode,
        practice: true,
      });
    } catch (err) {
      console.error('battle:bot error:', err);
      socket.emit('error', { message: 'Botgame starten mislukt' });
    }
  });

  // Battle opgeven/annuleren (bv. tegenstander reageert niet in de formatie-fase)
  socket.on('battle:forfeit', async ({ battleId }) => {
    const bid = parseInt(battleId);
    if (Number.isNaN(bid)) return;
    try {
      const battle = await prisma.battle.findUnique({ where: { id: bid } });
      if (!battle) return;
      if (battle.player1Id !== socket.user.id && battle.player2Id !== socket.user.id) return;
      if (battle.status === 'FINISHED' || battle.status === 'CANCELLED') return;

      const state = battleStates.get(bid);
      if (state) clearTimer(state);
      battleStates.delete(bid);

      await prisma.battle.update({ where: { id: bid }, data: { status: 'CANCELLED' } });
      io.to(`battle:${bid}`).emit('battle:cancelled', {
        by: socket.user.username,
        message: `${socket.user.username} heeft de battle verlaten`,
      });
    } catch (err) {
      console.error('battle:forfeit error:', err);
    }
  });

  socket.on('battle:chat', async ({ battleId, message }) => {
    const bid = parseInt(battleId);
    if (Number.isNaN(bid)) return;
    if (!message || typeof message !== 'string') return;
    const clean = message.trim().slice(0, 300);
    if (!clean) return;

    try {
      const battle = await prisma.battle.findUnique({ where: { id: bid } });
      if (!battle) return;
      if (battle.player1Id !== socket.user.id && battle.player2Id !== socket.user.id) return;

      const saved = await prisma.chatMessage.create({
        data: {
          userId: socket.user.id,
          battleId: bid,
          message: clean,
          type: 'BATTLE',
        },
        include: { user: { select: { username: true } } },
      });

      io.to(`battle:${bid}`).emit('battle:chat:message', {
        id: saved.id,
        userId: socket.user.id,
        username: saved.user.username,
        message: saved.message,
        time: saved.createdAt,
      });
    } catch (err) {
      console.error('battle:chat error:', err);
    }
  });
}

/**
 * Maak een oefenbattle aan tegen een bot. De bot kiest meteen zijn formatie,
 * dus zodra de speler de zijne bevestigt start ronde 1.
 */
async function createBotBattle(userId, mode = 'CLASSIC', level = 'medium') {
  if (!['CLASSIC', 'EXPERT'].includes(mode)) mode = 'CLASSIC';
  if (!['easy', 'medium', 'hard'].includes(level)) level = 'medium';

  const botId = getBotId(level);
  if (!botId) return null;

  // Speler mag niet al in een battle zitten (bots zelf wel: die multitasken)
  const active = await prisma.battle.findFirst({
    where: {
      status: { in: ['PENDING', 'FORMATION_SELECT', 'DRAFTING'] },
      OR: [{ player1Id: userId }, { player2Id: userId }],
    },
  });
  if (active) return { error: 'Je zit al in een battle', battleId: active.id };

  const botFormation = chooseBotFormation(level);
  const battle = await prisma.battle.create({
    data: {
      player1Id: userId,
      player2Id: botId,
      mode,
      status: 'FORMATION_SELECT',
      formation2: botFormation,
    },
  });

  const bot = await prisma.user.findUnique({ where: { id: botId }, select: { username: true } });
  return { ...battle, botUsername: bot.username };
}

/**
 * Bot pickt met menselijke vertraging, volgens zijn niveau.
 */
function scheduleBotPick(io, state) {
  if (!state.botId) return;
  const roundNum = state.currentRound;
  const delay = 1200 + Math.random() * 2500;

  setTimeout(async () => {
    try {
      // Ronde al voorbij of al gepickt? Niets doen
      if (state.currentRound !== roundNum) return;
      if (state.picks[pickKey(roundNum, state.botId)]) return;

      const isP1 = state.botId === state.player1Id;
      const formation = isP1 ? state.formation1 : state.formation2;
      const filled = isP1 ? state.filled1 : state.filled2;
      const clubSeasonId = isP1 ? state.clubSeason1Id : state.clubSeason2Id;

      const pickedIds = await prisma.draftPick.findMany({
        where: { battleRound: { battleId: state.battleId } },
        select: { playerId: true },
      });
      const available = await prisma.footballPlayer.findMany({
        where: { clubSeasonId, id: { notIn: pickedIds.map(p => p.playerId) } },
      });

      const choice = chooseBotPick(available, formation, filled, getBotLevel(state.botId) || 'medium');
      if (choice) await makePick(io, state, state.botId, choice.id);
    } catch (err) {
      console.error('scheduleBotPick error:', err);
    }
  }, delay);
}

/**
 * Eén pick uitvoeren (door speler of autopick). Race-veilig:
 * de in-memory claim gebeurt synchroon vóór de database-writes, en de
 * unique constraints (ronde+speler, ronde+voetballer) vangen de rest af.
 */
async function makePick(io, state, userId, playerId, socket = null) {
  const emitError = (message) => {
    if (socket) socket.emit('battle:error', { message });
  };

  if (state.currentRound < 1 || !state.roundId) return emitError('Geen actieve ronde');

  const key = pickKey(state.currentRound, userId);
  if (state.picks[key]) return emitError('Je hebt al gekozen deze ronde');
  state.picks[key] = { pending: true }; // synchrone claim tegen dubbelklikken

  try {
    const isP1 = userId === state.player1Id;
    const myClubSeasonId = isP1 ? state.clubSeason1Id : state.clubSeason2Id;

    const player = await prisma.footballPlayer.findUnique({ where: { id: playerId } });
    if (!player || player.clubSeasonId !== myClubSeasonId) {
      delete state.picks[key];
      return emitError('Ongeldige speler voor jouw club deze ronde');
    }

    // Zelfde club kan in een latere ronde opnieuw voorkomen (bij de andere
    // speler) — een voetballer mag maar in één team belanden
    const alreadyPicked = await prisma.draftPick.findFirst({
      where: { battleRound: { battleId: state.battleId }, playerId },
    });
    if (alreadyPicked) {
      delete state.picks[key];
      return emitError('Die speler is al gekozen in deze battle');
    }

    const formation = isP1 ? state.formation1 : state.formation2;
    const filled = isP1 ? state.filled1 : state.filled2;

    const slot = findSlotForPlayer(formation, filled, player.position);
    if (slot === -1) {
      delete state.picks[key];
      return emitError(`Een ${player.position} past niet meer op een open positie in jouw ${formation}`);
    }

    try {
      await prisma.draftPick.create({
        data: {
          battleRoundId: state.roundId,
          playerId,
          userId,
          pickOrder: state.currentRound,
          slot,
        },
      });
    } catch (err) {
      delete state.picks[key];
      if (err.code === 'P2002') return emitError('Die speler is net gekozen');
      throw err;
    }

    state.picks[key] = { playerId, slot };
    filled.add(slot);

    io.to(`battle:${state.battleId}`).emit('battle:pick:made', {
      round: state.currentRound,
      userId,
      slot,
      player: sanitizePlayer(player, state.mode),
    });

    if (bothPicked(state) && !state.advancing) {
      state.advancing = true;
      clearTimer(state);
      try {
        if (state.currentRound >= TOTAL_ROUNDS) {
          await finalizeBattle(io, state);
        } else {
          await startNextRound(io, state);
        }
      } finally {
        state.advancing = false;
      }
    }
  } catch (err) {
    if (state.picks[key] && state.picks[key].pending) delete state.picks[key];
    console.error('makePick error:', err);
    emitError('Pick mislukt');
  }
}

/**
 * Dubbele spin: elke speler krijgt zijn EIGEN willekeurige club-seizoen,
 * gefilterd op "heeft nog een passende speler voor mijn open posities".
 * Beide spelers krijgen in dezelfde ronde altijd verschillende clubs.
 */
async function startNextRound(io, state) {
  try {
    const battleId = state.battleId;

    const allPicked = await prisma.draftPick.findMany({
      where: { battleRound: { battleId } },
      select: { playerId: true },
    });
    const pickedIds = allPicked.map(p => p.playerId);

    const candidates = await prisma.clubSeason.findMany({
      include: {
        club: true,
        season: true,
        players: { where: pickedIds.length > 0 ? { id: { notIn: pickedIds } } : {} },
      },
    });

    const pickClubFor = (formation, filled, usedIds, excludeId = null) => {
      const fits = (cs) => teamHasFittingPick(formation, filled, cs.players.map(p => p.position));
      // Voorkeur: nog niet gebruikt door deze speler én niet de club van de tegenstander
      let pool = candidates.filter(cs => cs.id !== excludeId && !usedIds.includes(cs.id) && fits(cs));
      // Vangnet 1: hergebruik van eerdere clubs toestaan
      if (pool.length === 0) pool = candidates.filter(cs => cs.id !== excludeId && fits(cs));
      // Vangnet 2: desnoods dezelfde club als de tegenstander
      if (pool.length === 0) pool = candidates.filter(fits);
      if (pool.length === 0) return null;
      return pool[Math.floor(Math.random() * pool.length)];
    };

    const club1 = pickClubFor(state.formation1, state.filled1, state.used1);
    const club2 = club1
      ? pickClubFor(state.formation2, state.filled2, state.used2, club1.id)
      : null;

    if (!club1 || !club2) {
      io.to(`battle:${battleId}`).emit('battle:error', {
        message: 'Geen club-seizoenen beschikbaar. Voer de seed uit (npm run seed).',
      });
      return;
    }

    state.used1.push(club1.id);
    state.used2.push(club2.id);
    state.currentRound += 1;
    state.clubSeason1Id = club1.id;
    state.clubSeason2Id = club2.id;

    const [, round] = await prisma.$transaction([
      prisma.battle.update({
        where: { id: battleId },
        data: { currentRound: state.currentRound, status: 'DRAFTING' },
      }),
      prisma.battleRound.create({
        data: {
          battleId,
          roundNumber: state.currentRound,
          clubSeason1Id: club1.id,
          clubSeason2Id: club2.id,
        },
      }),
    ]);
    state.roundId = round.id;

    startPickTimer(io, state);

    // Elke speler krijgt zijn eigen club + selectie (via zijn persoonlijke room)
    const sendRound = (userId, mine, theirs) => {
      io.to(`user:${userId}`).emit('battle:round:start', {
        round: state.currentRound,
        totalRounds: TOTAL_ROUNDS,
        roundId: round.id,
        club: mine.club.name,
        clubCountry: mine.club.country,
        season: mine.season.label,
        oppClub: theirs.club.name,
        oppSeason: theirs.season.label,
        players: sortForMode(mine.players, state.mode).map(p => sanitizePlayer(p, state.mode)),
        deadline: state.deadline,
      });
    };
    sendRound(state.player1Id, club1, club2);
    sendRound(state.player2Id, club2, club1);

    // Bot in deze battle? Die kiest na een menselijke denkpauze
    scheduleBotPick(io, state);
  } catch (err) {
    console.error('startNextRound error:', err);
    io.to(`battle:${state.battleId}`).emit('battle:error', { message: 'Ronde starten mislukt' });
  }
}

/**
 * 60 seconden per ronde; daarna kiest het systeem automatisch de best
 * passende speler uit de eigen club voor wie nog niet gekozen heeft.
 */
function startPickTimer(io, state) {
  clearTimer(state);
  state.deadline = Date.now() + PICK_TIMEOUT_MS;

  const roundNum = state.currentRound;
  state.timer = setTimeout(async () => {
    state.timer = null;
    try {
      // Battle kan intussen geannuleerd/afgerond zijn — dan stoppen en opruimen
      const battle = await prisma.battle.findUnique({
        where: { id: state.battleId },
        select: { status: true },
      });
      if (!battle || battle.status !== 'DRAFTING') {
        battleStates.delete(state.battleId);
        return;
      }
      for (const userId of [state.player1Id, state.player2Id]) {
        // De eerste autopick kan de ronde afronden; dan niet doorpicken in de nieuwe ronde
        if (state.currentRound !== roundNum) break;
        const entry = state.picks[pickKey(roundNum, userId)];
        if (entry && !entry.pending) continue;

        const pickedIds = await prisma.draftPick.findMany({
          where: { battleRound: { battleId: state.battleId } },
          select: { playerId: true },
        });
        const isP1 = userId === state.player1Id;
        const formation = isP1 ? state.formation1 : state.formation2;
        const filled = isP1 ? state.filled1 : state.filled2;
        const myClubSeasonId = isP1 ? state.clubSeason1Id : state.clubSeason2Id;

        const available = await prisma.footballPlayer.findMany({
          where: {
            clubSeasonId: myClubSeasonId,
            id: { notIn: pickedIds.map(p => p.playerId) },
          },
          orderBy: { rating: 'desc' },
        });
        const best = available.find(p => findSlotForPlayer(formation, filled, p.position) !== -1);
        if (best) {
          io.to(`battle:${state.battleId}`).emit('battle:autopick', { userId });
          await makePick(io, state, userId, best.id);
        }
      }
    } catch (err) {
      console.error('autopick error:', err);
    }
  }, PICK_TIMEOUT_MS);
}

async function finalizeBattle(io, state) {
  if (state.finalizing) return;
  state.finalizing = true;
  const battleId = state.battleId;

  try {
    const battle = await prisma.battle.findUnique({ where: { id: battleId } });
    if (!battle || battle.status === 'FINISHED') return;

    await prisma.battle.update({ where: { id: battleId }, data: { status: 'CALCULATING' } });

    const picks = await prisma.draftPick.findMany({
      where: { battleRound: { battleId } },
      include: { player: true },
      orderBy: { pickOrder: 'asc' },
    });

    // Teams indexeren op slot (positie in de formatie)
    const team1 = new Array(11).fill(null);
    const team2 = new Array(11).fill(null);
    for (const p of picks) {
      if (p.userId === battle.player1Id) team1[p.slot] = p.player;
      else team2[p.slot] = p.player;
    }

    const formation1 = state.formation1 || '4-3-3';
    const formation2 = state.formation2 || '4-3-3';

    const score1 = calculateScore(team1, formation1);
    const score2 = calculateScore(team2, formation2);

    // Het hoogtepunt: beide elftallen spelen een volledig PL-seizoen
    const season1 = simulateSeason(score1.strength);
    const season2 = simulateSeason(score2.strength);
    const tier1 = getTier(season1);
    const tier2 = getTier(season2);
    const winnerId = determineWinner(season1, season2, battle.player1Id, battle.player2Id);

    const practice = !!state.botId;

    const [p1Profile, p2Profile] = await Promise.all([
      prisma.profile.findUnique({ where: { userId: battle.player1Id } }),
      prisma.profile.findUnique({ where: { userId: battle.player2Id } }),
    ]);

    const eloScore1 = winnerId === null ? 0.5 : winnerId === battle.player1Id ? 1 : 0;
    // Oefenpotjes tegen bots tellen nergens voor mee
    const { change1, change2 } = practice
      ? { change1: 0, change2: 0 }
      : calculateElo(p1Profile.currentElo, p2Profile.currentElo, eloScore1);

    const profileData = (profile, season, tier, eloChange, outcome) => {
      const newElo = Math.max(100, profile.currentElo + eloChange);
      const newStreak = outcome === 'W' ? profile.currentStreak + 1 : 0;
      const isTitle = tier === 'Champion' || tier === 'Invincible' || tier === 'Perfect Season';
      return {
        totalBattles: profile.totalBattles + 1,
        wins: profile.wins + (outcome === 'W' ? 1 : 0),
        losses: profile.losses + (outcome === 'L' ? 1 : 0),
        draws: profile.draws + (outcome === 'D' ? 1 : 0),
        currentElo: newElo,
        highestElo: Math.max(profile.highestElo, newElo),
        currentStreak: newStreak,
        highestStreak: Math.max(profile.highestStreak, newStreak),
        highestScore: Math.max(profile.highestScore, season.points),
        titles: profile.titles + (isTitle ? 1 : 0),
      };
    };

    const outcome1 = winnerId === null ? 'D' : winnerId === battle.player1Id ? 'W' : 'L';
    const outcome2 = winnerId === null ? 'D' : winnerId === battle.player2Id ? 'W' : 'L';
    const data1 = profileData(p1Profile, season1, tier1, change1, outcome1);
    const data2 = profileData(p2Profile, season2, tier2, change2, outcome2);

    const leaderboardData = (d) => ({
      elo: d.currentElo,
      wins: d.wins,
      losses: d.losses,
      winPct: d.totalBattles > 0 ? d.wins / d.totalBattles : 0,
    });

    // Alles-of-niets: resultaat, status, profielen en leaderboard in één transactie.
    // Bij een oefenpotje slaan we profiel-, leaderboard- en achievement-updates over.
    const writes = [
      prisma.battleResult.create({
        data: {
          battleId,
          player1Score:     season1.points,
          player2Score:     season2.points,
          player1Rating:    score1.totalRating,
          player2Rating:    score2.totalRating,
          player1Attack:    score1.attack,
          player2Attack:    score2.attack,
          player1Midfield:  score1.midfield,
          player2Midfield:  score2.midfield,
          player1Defense:   score1.defense,
          player2Defense:   score2.defense,
          player1Chemistry: score1.chemistry,
          player2Chemistry: score2.chemistry,
          player1Tier:      tier1,
          player2Tier:      tier2,
          player1Pts:       season1.points,
          player2Pts:       season2.points,
          season1,
          season2,
          winnerId,
          eloChange1: change1,
          eloChange2: change2,
        },
      }),
      prisma.battle.update({ where: { id: battleId }, data: { status: 'FINISHED', winner: winnerId } }),
    ];
    if (!practice) {
      writes.push(
        prisma.profile.update({ where: { userId: battle.player1Id }, data: data1 }),
        prisma.profile.update({ where: { userId: battle.player2Id }, data: data2 }),
        prisma.leaderboardEntry.update({ where: { userId: battle.player1Id }, data: leaderboardData(data1) }),
        prisma.leaderboardEntry.update({ where: { userId: battle.player2Id }, data: leaderboardData(data2) }),
      );
    }
    const [result] = await prisma.$transaction(writes);

    const [unlocked1, unlocked2] = practice ? [[], []] : await Promise.all([
      checkAndAward(battle.player1Id, {
        season: season1, won: outcome1 === 'W',
        oppElo: p2Profile.currentElo, myEloBefore: p1Profile.currentElo,
      }),
      checkAndAward(battle.player2Id, {
        season: season2, won: outcome2 === 'W',
        oppElo: p1Profile.currentElo, myEloBefore: p2Profile.currentElo,
      }),
    ]);

    io.to(`battle:${battleId}`).emit('battle:finished', {
      battleId,
      resultId: result.id,
      practice,
      winnerId,
      season1,
      season2,
      tier1,
      tier2,
      score1,
      score2,
      eloChange1: change1,
      eloChange2: change2,
      formation1,
      formation2,
      team1,
      team2,
      achievements: {
        [battle.player1Id]: unlocked1,
        [battle.player2Id]: unlocked2,
      },
    });

    clearTimer(state);
    battleStates.delete(battleId);
  } catch (err) {
    console.error('finalizeBattle error:', err);
    io.to(`battle:${battleId}`).emit('battle:error', { message: 'Battle afronden mislukt' });
  } finally {
    state.finalizing = false;
  }
}

module.exports = { handleBattle, createBotBattle };
