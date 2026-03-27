// data/store.js – Speichert Guild-Einstellungen in einer JSON-Datei
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'guilds.json');

function load() {
  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, '{}');
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch { return {}; }
}

function save(data) {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

function getGuild(guildId) {
  const data = load();
  return data[guildId] || {
    systemPrompt: 'Du bist ein hilfreicher KI-Assistent in einem Discord-Server.',
    channelId: null,
    botName: 'VoltraBot'
  };
}

function setGuild(guildId, settings) {
  const data = load();
  data[guildId] = { ...(data[guildId] || {}), ...settings };
  save(data);
  return data[guildId];
}

function getAllGuilds() {
  return load();
}

module.exports = { getGuild, setGuild, getAllGuilds };
