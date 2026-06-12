const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { getLeaderboard } = require('../controllers/leaderboardController');

router.get('/', authenticate, getLeaderboard);

module.exports = router;
