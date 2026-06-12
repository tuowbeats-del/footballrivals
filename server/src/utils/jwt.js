const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET;
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

if (!SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET ontbreekt. Zet deze in je .env voordat je de server start.');
  }
  console.warn('⚠️  JWT_SECRET niet gezet — onveilige dev-fallback actief. Niet gebruiken in productie!');
}

const DEV_FALLBACK = 'dev_only_secret_do_not_use_in_production';

const signToken = (payload) => jwt.sign(payload, SECRET || DEV_FALLBACK, { expiresIn: EXPIRES_IN });
const verifyToken = (token) => jwt.verify(token, SECRET || DEV_FALLBACK);

module.exports = { signToken, verifyToken };
