const prisma = require('../db');

const getUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      include: { profile: true },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(users);
  } catch (err) {
    return res.status(500).json({ error: 'Gebruikers ophalen mislukt' });
  }
};

const blockUser = async (req, res) => {
  const id = parseInt(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Ongeldig id' });
  const { block } = req.body;
  try {
    const user = await prisma.user.update({
      where: { id },
      data: { isBlocked: Boolean(block) },
    });
    return res.json({ message: `Gebruiker ${block ? 'geblokkeerd' : 'gedeblokkeerd'}`, user });
  } catch (err) {
    return res.status(500).json({ error: 'Gebruiker bijwerken mislukt' });
  }
};

const getBattles = async (req, res) => {
  try {
    const battles = await prisma.battle.findMany({
      include: {
        player1: { select: { username: true } },
        player2: { select: { username: true } },
        result: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return res.json(battles);
  } catch (err) {
    return res.status(500).json({ error: 'Battles ophalen mislukt' });
  }
};

const createClub = async (req, res) => {
  const { name, country } = req.body;
  if (!name || !country) return res.status(400).json({ error: 'Naam en land zijn verplicht' });
  try {
    const club = await prisma.club.create({ data: { name, country } });
    return res.status(201).json(club);
  } catch (err) {
    return res.status(500).json({ error: 'Club aanmaken mislukt' });
  }
};

const createSeason = async (req, res) => {
  const { year, label } = req.body;
  if (!year || !label) return res.status(400).json({ error: 'Jaar en label zijn verplicht' });
  try {
    const season = await prisma.season.create({ data: { year, label } });
    return res.status(201).json(season);
  } catch (err) {
    return res.status(500).json({ error: 'Seizoen aanmaken mislukt' });
  }
};

const createClubSeason = async (req, res) => {
  const { clubId, seasonId } = req.body;
  try {
    const cs = await prisma.clubSeason.create({
      data: { clubId: parseInt(clubId), seasonId: parseInt(seasonId) },
    });
    return res.status(201).json(cs);
  } catch (err) {
    return res.status(500).json({ error: 'ClubSeason aanmaken mislukt' });
  }
};

const createPlayer = async (req, res) => {
  const { name, position, rating, pace, shooting, passing, dribbling, defending, physical, nationality, clubSeasonId } = req.body;
  if (!name || !position || !clubSeasonId) return res.status(400).json({ error: 'Naam, positie en clubSeasonId zijn verplicht' });
  try {
    const player = await prisma.footballPlayer.create({
      data: {
        name,
        position,
        rating: parseInt(rating) || 75,
        pace: parseInt(pace) || 70,
        shooting: parseInt(shooting) || 70,
        passing: parseInt(passing) || 70,
        dribbling: parseInt(dribbling) || 70,
        defending: parseInt(defending) || 50,
        physical: parseInt(physical) || 70,
        nationality: nationality || 'Onbekend',
        clubSeasonId: parseInt(clubSeasonId),
      },
    });
    return res.status(201).json(player);
  } catch (err) {
    return res.status(500).json({ error: 'Speler aanmaken mislukt' });
  }
};

const deletePlayer = async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.footballPlayer.delete({ where: { id: parseInt(id) } });
    return res.json({ message: 'Speler verwijderd' });
  } catch (err) {
    return res.status(500).json({ error: 'Speler verwijderen mislukt' });
  }
};

const getClubs = async (req, res) => {
  try {
    const clubs = await prisma.club.findMany({ orderBy: { name: 'asc' } });
    return res.json(clubs);
  } catch (err) {
    return res.status(500).json({ error: 'Clubs ophalen mislukt' });
  }
};

const getSeasons = async (req, res) => {
  try {
    const seasons = await prisma.season.findMany({ orderBy: { year: 'asc' } });
    return res.json(seasons);
  } catch (err) {
    return res.status(500).json({ error: 'Seizoenen ophalen mislukt' });
  }
};

const resetLeaderboard = async (req, res) => {
  try {
    await prisma.leaderboardEntry.updateMany({
      data: { elo: 1000, wins: 0, losses: 0, winPct: 0, seasonRank: 0 },
    });
    await prisma.profile.updateMany({
      data: {
        currentElo: 1000, wins: 0, losses: 0, draws: 0, totalBattles: 0,
        currentStreak: 0, highestScore: 0, titles: 0,
      },
    });
    return res.json({ message: 'Leaderboard gereset' });
  } catch (err) {
    return res.status(500).json({ error: 'Reset mislukt' });
  }
};

module.exports = {
  getUsers, blockUser, getBattles,
  createClub, createSeason, createClubSeason,
  createPlayer, deletePlayer,
  getClubs, getSeasons,
  resetLeaderboard,
};
