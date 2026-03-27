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
  const stored = data[guildId] || {};
  return {
    systemPrompt: stored.systemPrompt ?? 'Du bist ein hilfreicher KI-Assistent in einem Discord-Server.',
    channelId: stored.channelId ?? null,
    botName: stored.botName ?? 'VoltraBot',
    channelPrompts: stored.channelPrompts || {}
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

function setChannelPrompt(guildId, channelId, prompt) {
  const data = load();
  if (!data[guildId]) data[guildId] = {};
  if (!data[guildId].channelPrompts) data[guildId].channelPrompts = {};

  const cleaned = typeof prompt === 'string' ? prompt.trim() : '';
  if (!cleaned) {
    delete data[guildId].channelPrompts[channelId];
  } else {
    data[guildId].channelPrompts[channelId] = cleaned;
  }

  save(data);
  return data[guildId].channelPrompts[channelId] || null;
}

function getChannelPrompt(guildId, channelId) {
  const g = getGuild(guildId);
  return (g.channelPrompts && g.channelPrompts[channelId]) || null;
}

module.exports = { getGuild, setGuild, getAllGuilds, setChannelPrompt, getChannelPrompt };
