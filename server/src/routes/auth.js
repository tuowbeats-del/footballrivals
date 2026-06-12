const router = require('express').Router();
const { body } = require('express-validator');
const { register, login, logout, me } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');

router.post('/register', authLimiter, [
  body('username').trim().isLength({ min: 3, max: 20 }).matches(/^[a-zA-Z0-9_]+$/).withMessage('Gebruikersnaam: 3-20 tekens, alleen letters/cijfers/_'),
  body('email').isEmail().normalizeEmail().withMessage('Ongeldig e-mailadres'),
  body('password').isLength({ min: 6 }).withMessage('Wachtwoord minimaal 6 tekens'),
], register);

router.post('/login', authLimiter, [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], login);

router.post('/logout', authenticate, logout);
router.get('/me', authenticate, me);

module.exports = router;
