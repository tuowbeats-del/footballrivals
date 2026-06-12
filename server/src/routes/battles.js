const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { getBattle, getHistory } = require('../controllers/battleController');

router.get('/history', authenticate, getHistory);
router.get('/:id', authenticate, getBattle);

module.exports = router;
