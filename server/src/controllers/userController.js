const prisma = require('../db');

const getProfile = async (req, res) => {
  try {
    const { username } = req.params;
    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        isOnline: true,
        lastSeen: true,
        createdAt: true,
        profile: true,
        achievements: { include: { achievement: true } },
      },
    });
    if (!user) return res.status(404).json({ error: 'Gebruiker niet gevonden' });
    return res.json(user);
  } catch (err) {
    return res.status(500).json({ error: 'Profiel ophalen mislukt' });
  }
};

const getOnlineUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { isOnline: true },
      select: {
        id: true,
        username: true,
        isOnline: true,
        lastSeen: true,
        profile: { select: { currentElo: true } },
      },
    });
    return res.json(users);
  } catch (err) {
    return res.status(500).json({ error: 'Online gebruikers ophalen mislukt' });
  }
};

module.exports = { getProfile, getOnlineUsers };
