const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { pickLimiter } = require('../middleware/rateLimiter');
const prisma = require('../db');

// Beschikbare spelers voor een ronde (fallback naast de socket-flow)
router.get('/battles/:id/round/:round/players', authenticate, pickLimiter, async (req, res) => {
  const id = parseInt(req.params.id);
  const round = parseInt(req.params.round);
  if (Number.isNaN(id) || Number.isNaN(round)) {
    return res.status(400).json({ error: 'Ongeldige parameters' });
  }
  try {
    const battle = await prisma.battle.findUnique({ where: { id } });
    if (!battle) return res.status(404).json({ error: 'Battle niet gevonden' });
    if (battle.player1Id !== req.user.id && battle.player2Id !== req.user.id) {
      return res.status(403).json({ error: 'Geen toegang' });
    }

    const battleRound = await prisma.battleRound.findUnique({
      where: { battleId_roundNumber: { battleId: id, roundNumber: round } },
      include: {
        clubSeason1: { include: { club: true, season: true } },
        clubSeason2: { include: { club: true, season: true } },
      },
    });
    if (!battleRound) return res.status(404).json({ error: 'Ronde niet gevonden' });

    const picked = await prisma.draftPick.findMany({
      where: { battleRound: { battleId: id } },
      select: { playerId: true, player: { select: { name: true } } },
    });
    const excludeIds = picked.map(p => p.playerId);
    const excludeNames = picked.map(p => p.player.name);

    // Elke speler heeft zijn eigen club deze ronde
    const myClubSeasonId = battle.player1Id === req.user.id
      ? battleRound.clubSeason1Id
      : battleRound.clubSeason2Id;

    let players = await prisma.footballPlayer.findMany({
      where: {
        clubSeasonId: myClubSeasonId,
        ...(excludeIds.length > 0 ? { id: { notIn: excludeIds }, name: { notIn: excludeNames } } : {}),
      },
      orderBy: { rating: 'desc' },
    });

    // In EXPERT-modus geen ratings/stats lekken
    if (battle.mode === 'EXPERT' && battle.status !== 'FINISHED') {
      players = players.map(p => ({
        id: p.id, name: p.name, position: p.position, nationality: p.nationality,
      }));
    }

    return res.json({ round: battleRound, players });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Spelers ophalen mislukt' });
  }
});

module.exports = router;
