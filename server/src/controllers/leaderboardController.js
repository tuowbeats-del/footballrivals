const prisma = require('../db');

const getLeaderboard = async (req, res) => {
  const { sort = 'elo' } = req.query;
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 100);
  try {
    const orderBy =
      sort === 'wins' ? { wins: 'desc' }
      : sort === 'winPct' ? { winPct: 'desc' }
      : { elo: 'desc' };

    const entries = await prisma.leaderboardEntry.findMany({
      where: { user: { isBot: false, isBlocked: false } },
      include: {
        user: { select: { username: true, isOnline: true } },
      },
      orderBy,
      take: limit,
    });
    return res.json(entries);
  } catch (err) {
    return res.status(500).json({ error: 'Leaderboard ophalen mislukt' });
  }
};

module.exports = { getLeaderboard };
