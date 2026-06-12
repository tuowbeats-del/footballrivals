const prisma = require('../db');

const getBattle = async (req, res) => {
  const id = parseInt(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Ongeldig battle-id' });
  try {
    const battle = await prisma.battle.findUnique({
      where: { id },
      include: {
        player1: { select: { id: true, username: true, isBot: true } },
        player2: { select: { id: true, username: true, isBot: true } },
        rounds: {
          include: {
            picks: { include: { player: true } },
            clubSeason1: { include: { club: true, season: true } },
            clubSeason2: { include: { club: true, season: true } },
          },
          orderBy: { roundNumber: 'asc' },
        },
        result: true,
      },
    });
    if (!battle) return res.status(404).json({ error: 'Battle niet gevonden' });
    if (battle.player1Id !== req.user.id && battle.player2Id !== req.user.id) {
      return res.status(403).json({ error: 'Geen toegang tot deze battle' });
    }
    // In EXPERT-modus geen ratings/stats lekken zolang de battle loopt
    if (battle.mode === 'EXPERT' && battle.status !== 'FINISHED') {
      battle.rounds = battle.rounds.map(r => ({
        ...r,
        picks: r.picks.map(p => ({
          ...p,
          player: {
            id: p.player.id,
            name: p.player.name,
            position: p.player.position,
            nationality: p.player.nationality,
          },
        })),
      }));
    }
    return res.json(battle);
  } catch (err) {
    console.error('getBattle error:', err);
    return res.status(500).json({ error: 'Battle ophalen mislukt' });
  }
};

const getHistory = async (req, res) => {
  try {
    const battles = await prisma.battle.findMany({
      where: {
        OR: [{ player1Id: req.user.id }, { player2Id: req.user.id }],
        status: 'FINISHED',
      },
      include: {
        player1: { select: { id: true, username: true } },
        player2: { select: { id: true, username: true } },
        result: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return res.json(battles);
  } catch (err) {
    return res.status(500).json({ error: 'Geschiedenis ophalen mislukt' });
  }
};

module.exports = { getBattle, getHistory };
