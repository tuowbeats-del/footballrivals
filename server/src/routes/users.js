const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { getProfile, getOnlineUsers } = require('../controllers/userController');

router.get('/online', authenticate, getOnlineUsers);
router.get('/profile/:username', authenticate, getProfile);

module.exports = router;
