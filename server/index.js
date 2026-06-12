// .env naast dit bestand laden, ongeacht vanaf welke map de server gestart wordt
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { createServer } = require('http');
const app = require('./src/app');
const { initSocket } = require('./src/socket/socketHandler');
const { ensureBots } = require('./src/services/botService');

const PORT = process.env.PORT || 3001;
const httpServer = createServer(app);

initSocket(httpServer);

// Oefenbots aanmaken/bijwerken (upsert — veilig op een bestaande database)
ensureBots().catch(err => console.error('ensureBots error:', err));

httpServer.listen(PORT, () => {
  console.log(`FootballRivals server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
