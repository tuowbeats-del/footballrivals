const bcrypt = require('bcrypt');
const prisma = require('../db');
const { signToken } = require('../utils/jwt');
const { validationResult } = require('express-validator');

const register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { username, email, password } = req.body;
  try {
    const exists = await prisma.user.findFirst({
      where: { OR: [{ username }, { email }] },
    });
    if (exists) return res.status(409).json({ error: 'Gebruikersnaam of e-mail is al in gebruik' });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash,
        profile: { create: {} },
        leaderboard: { create: {} },
      },
    });

    const token = signToken({ userId: user.id, role: user.role });
    return res.status(201).json({
      token,
      user: { id: user.id, username: user.username, role: user.role },
    });
  } catch (err) {
    // Unieke constraint: twee registraties met dezelfde naam/e-mail tegelijk
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Gebruikersnaam of e-mail is al in gebruik' });
    }
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Registratie mislukt' });
  }
};

const login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { email, password } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Ongeldige inloggegevens' });
    if (user.isBlocked) return res.status(403).json({ error: 'Account is geblokkeerd' });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Ongeldige inloggegevens' });

    const token = signToken({ userId: user.id, role: user.role });
    return res.json({
      token,
      user: { id: user.id, username: user.username, role: user.role },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Inloggen mislukt' });
  }
};

const logout = async (req, res) => {
  try {
    await prisma.user.update({
      where: { id: req.user.id },
      data: { lastSeen: new Date() },
    });
    return res.json({ message: 'Uitgelogd' });
  } catch (err) {
    return res.status(500).json({ error: 'Uitloggen mislukt' });
  }
};

const me = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        profile: true,
      },
    });
    return res.json(user);
  } catch (err) {
    return res.status(500).json({ error: 'Gebruiker ophalen mislukt' });
  }
};

module.exports = { register, login, logout, me };
