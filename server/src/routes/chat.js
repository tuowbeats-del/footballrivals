const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { getLobbyChat, getBattleChat } = require('../controllers/chatController');

router.get('/lobby', authenticate, getLobbyChat);
router.get('/battle/:id', authenticate, getBattleChat);

module.exports = router;
