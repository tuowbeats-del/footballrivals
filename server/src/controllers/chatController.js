const prisma = require('../db');

const getLobbyChat = async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  try {
    const messages = await prisma.chatMessage.findMany({
      where: { type: 'LOBBY' },
      include: { user: { select: { username: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return res.json(messages.reverse());
  } catch (err) {
    return res.status(500).json({ error: 'Chat ophalen mislukt' });
  }
};

const getBattleChat = async (req, res) => {
  const id = parseInt(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Ongeldig battle-id' });
  try {
    const battle = await prisma.battle.findUnique({ where: { id } });
    if (!battle) return res.status(404).json({ error: 'Battle niet gevonden' });
    if (battle.player1Id !== req.user.id && battle.player2Id !== req.user.id) {
      return res.status(403).json({ error: 'Geen toegang' });
    }
    const messages = await prisma.chatMessage.findMany({
      where: { battleId: id, type: 'BATTLE' },
      include: { user: { select: { username: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return res.json(messages);
  } catch (err) {
    return res.status(500).json({ error: 'Battle chat ophalen mislukt' });
  }
};

module.exports = { getLobbyChat, getBattleChat };
