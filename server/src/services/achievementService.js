const prisma = require('../db');

/**
 * Controleert en kent achievements toe na een battle.
 * ctx (optioneel): { season, won, oppElo, myEloBefore }
 *   season: { wins, draws, losses, gf, ga, points } van het gesimuleerde seizoen
 */
async function checkAndAward(userId, ctx = {}) {
  try {
    const profile = await prisma.profile.findUnique({ where: { userId } });
    if (!profile) return [];

    const achievements = await prisma.achievement.findMany();
    const userAchs = await prisma.userAchievement.findMany({
      where: { userId },
      select: { achievementId: true },
    });
    const owned = new Set(userAchs.map(a => a.achievementId));
    const season = ctx.season || null;
    const unlocked = [];

    for (const ach of achievements) {
      if (owned.has(ach.id)) continue;
      let earned = false;

      switch (ach.condition) {
        case 'wins_1':        earned = profile.wins >= 1; break;
        case 'wins_10':       earned = profile.wins >= 10; break;
        case 'wins_50':       earned = profile.wins >= 50; break;
        case 'streak_5':      earned = profile.highestStreak >= 5; break;
        case 'elo_1500':      earned = profile.currentElo >= 1500; break;
        case 'battles_100':   earned = profile.totalBattles >= 100; break;
        case 'titles_5':      earned = profile.titles >= 5; break;
        case 'season_90':     earned = !!season && season.points >= 90; break;
        case 'season_100':    earned = !!season && season.points >= 100; break;
        case 'unbeaten':      earned = !!season && season.losses === 0; break;
        case 'perfect':       earned = !!season && season.wins === 38; break;
        case 'goals_100':     earned = !!season && season.gf >= 100; break;
        case 'clean_defense': earned = !!season && season.ga <= 20; break;
        case 'giant_killer':
          earned = !!ctx.won && typeof ctx.oppElo === 'number'
            && typeof ctx.myEloBefore === 'number'
            && ctx.oppElo - ctx.myEloBefore >= 200;
          break;
      }

      if (earned) {
        await prisma.userAchievement.create({
          data: { userId, achievementId: ach.id },
        });
        unlocked.push({ name: ach.name, description: ach.description, icon: ach.icon });
      }
    }

    return unlocked;
  } catch (err) {
    console.error('Achievement check error:', err);
    return [];
  }
}

module.exports = { checkAndAward };
