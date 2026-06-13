const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const { generalLimiter } = require('./middleware/rateLimiter');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const battleRoutes = require('./routes/battles');
const draftRoutes = require('./routes/draft');
const leaderboardRoutes = require('./routes/leaderboard');
const chatRoutes = require('./routes/chat');
const adminRoutes = require('./routes/admin');

const app = express();

// Achter een reverse proxy (productie) is dit nodig zodat rate limiting per gebruiker werkt
app.set('trust proxy', 1);

app.use(helmet({
  // De React-build wordt door deze server zelf geserveerd; CSP zou inline Vite-assets breken
  contentSecurityPolicy: false,
}));

const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(',')
  : ['http://localhost:5173', 'http://localhost:3001'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      const err = new Error('Not allowed by CORS');
      err.status = 403;
      callback(err);
    }
  },
  credentials: true,
}));

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true }));
app.use(generalLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/battles', battleRoutes);
app.use('/api/draft', draftRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/admin', adminRoutes);

// Serveer de gebouwde client wanneer die aanwezig is (productie én lokaal)
const publicDir = path.join(__dirname, '..', 'public');
if (process.env.NODE_ENV === 'production' || fs.existsSync(path.join(publicDir, 'index.html'))) {
  app.use(express.static(publicDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
      return next();
    }
    res.sendFile(path.join(publicDir, 'index.html'));
  });
}

// 404 voor onbekende API-routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Route niet gevonden' });
});

// Error handler
app.use((err, req, res, next) => {
  if (err.status !== 403) console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

module.exports = app;
