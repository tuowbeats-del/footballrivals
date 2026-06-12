const bcrypt = require('bcrypt');
const crypto = require('crypto');
const prisma = require('../db');
const { findSlotForPlayer, FORMATION_NAMES, FORMATIONS, POSITION_GROUPS } = require('./gameService');

/**
 * Oefenbots in drie niveaus. Botgames zijn oefenpotjes:
 * geen ELO, geen stats, geen achievements.
 */
// Het e-mailadres is de stabiele sleutel (verandert nooit) zodat een
// hernoeming de bestaande bot-accounts bijwerkt in plaats van nieuwe aan te maken
const BOTS = [
  { username: 'RookieAmorim', level: 'easy',   email: 'rookierik@footballrivals.bot' },
  { username: 'CoachRicky',   level: 'medium', email: 'coachcarlo@footballrivals.bot' },
  { username: 'DonCox',       level: 'hard',   email: 'donpep@footballrivals.bot' },
];

const botIdByLevel = new Map();   // 'easy' -> userId
const botLevelById = new Map();   // userId -> 'easy'

/**
 * Zorgt dat de bot-accounts bestaan (upsert bij serverstart).
 * Werkt dus ook op een bestaande productie-database zonder reseed.
 */
async function ensureBots() {
  for (const bot of BOTS) {
    // Bots loggen nooit in; willekeurig wachtwoord
    const passwordHash = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10);
    const user = await prisma.user.upsert({
      where: { email: bot.email },
      update: { isBot: true, username: bot.username },
      create: {
        username: bot.username,
        email: bot.email,
        passwordHash,
        isBot: true,
        profile: { create: {} },
      },
    });
    botIdByLevel.set(bot.level, user.id);
    botLevelById.set(user.id, bot.level);
  }
  console.log(`🤖 ${BOTS.length} oefenbots klaar (${BOTS.map(b => b.username).join(', ')})`);
}

function getBotId(level) {
  return botIdByLevel.get(level) || null;
}

function getBotLevel(userId) {
  return botLevelById.get(userId) || null;
}

function isBotId(userId) {
  return botLevelById.has(userId);
}

// Bots kiezen een formatie die bij hun stijl past
function chooseBotFormation(level) {
  if (level === 'easy') return FORMATION_NAMES[Math.floor(Math.random() * FORMATION_NAMES.length)];
  if (level === 'medium') return Math.random() < 0.5 ? '4-4-2' : '4-3-3';
  return Math.random() < 0.5 ? '4-3-3' : '3-5-2'; // Don Cox houdt van middenveld
}

/**
 * Kies een speler uit de beschikbare selectie, afhankelijk van het niveau.
 * - easy:   willekeurige passende speler
 * - medium: hoogste rating die past
 * - hard:   hoogste rating mét bonus voor exacte positie en schaarse slots (GK eerst)
 */
function chooseBotPick(players, formation, filledSlots, level) {
  const fitting = players.filter(p => findSlotForPlayer(formation, filledSlots, p.position) !== -1);
  if (fitting.length === 0) return null;

  if (level === 'easy') {
    return fitting[Math.floor(Math.random() * fitting.length)];
  }

  if (level === 'medium') {
    return fitting.reduce((best, p) => (p.rating > best.rating ? p : best));
  }

  // hard: scoor elke passende speler
  const form = FORMATIONS[formation];
  const openPositions = form.slots.filter(s => !filledSlots.has(s.slot)).map(s => s.position);
  const gkOpen = openPositions.includes('GK');

  let best = null;
  let bestScore = -Infinity;
  for (const p of fitting) {
    let score = p.rating;
    if (openPositions.includes(p.position)) score += 3;          // exacte positiematch
    if (p.position === 'GK' && gkOpen) score += 5;               // keepers zijn schaars: pak ze als het kan
    if (POSITION_GROUPS[p.position] === 'ATT') score += 1;       // lichte voorkeur voor aanvallende kwaliteit
    if (score > bestScore) { bestScore = score; best = p; }
  }
  return best;
}

module.exports = { BOTS, ensureBots, getBotId, getBotLevel, isBotId, chooseBotFormation, chooseBotPick };
