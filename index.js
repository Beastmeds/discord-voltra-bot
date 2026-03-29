// index.js – Startet Bot + Webserver zusammen
require('dotenv').config();
const app = require('./server');
const { startBot } = require('./bot');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`[Web] ✅ Dashboard läuft auf https://beastsmp.beastmeds.de:${PORT}`);
});

startBot();
