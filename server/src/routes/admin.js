const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { admin } = require('../middleware/admin');
const c = require('../controllers/adminController');

router.use(authenticate, admin);

router.get('/users', c.getUsers);
router.put('/users/:id/block', c.blockUser);
router.get('/battles', c.getBattles);
router.get('/clubs', c.getClubs);
router.post('/clubs', c.createClub);
router.get('/seasons', c.getSeasons);
router.post('/seasons', c.createSeason);
router.post('/clubseasons', c.createClubSeason);
router.post('/players', c.createPlayer);
router.delete('/players/:id', c.deletePlayer);
router.post('/leaderboard/reset', c.resetLeaderboard);

module.exports = router;
