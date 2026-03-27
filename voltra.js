// voltra.js – Kommunikation mit der Voltra AI API
const fetch = require('node-fetch');
require('dotenv').config();

// Conversation history pro Guild & Channel (in-memory)
const histories = new Map();

function getKey(guildId, channelId) {
  return `${guildId}:${channelId}`;
}

function getHistory(guildId, channelId) {
  const key = getKey(guildId, channelId);
  if (!histories.has(key)) histories.set(key, []);
  return histories.get(key);
}

function clearHistory(guildId, channelId) {
  histories.delete(getKey(guildId, channelId));
}

async function chat(message, guildId, channelId, systemPrompt) {
  const history = getHistory(guildId, channelId);

  // Neue Nachricht in History
  history.push({ role: 'user', content: message });

  // Nur die letzten 20 Nachrichten senden (Kontextfenster begrenzen)
  const recentHistory = history.slice(-20);

  try {
    const response = await fetch(process.env.VOLTRA_API_URL || 'https://voltraai.onrender.com/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.VOLTRA_API_KEY
      },
      body: JSON.stringify({
        message,
        system: systemPrompt,
        history: recentHistory.slice(0, -1) // Ohne die aktuelle Nachricht
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Voltra API Fehler: ${response.status} – ${err}`);
    }

    const data = await response.json();
    const reply = data.response || data.message || data.content || 'Keine Antwort erhalten.';

    // Antwort in History speichern
    history.push({ role: 'assistant', content: reply });

    return reply;
  } catch (error) {
    console.error('[Voltra] Fehler:', error.message);
    // Fehlgeschlagene Nachricht aus History entfernen
    history.pop();
    throw error;
  }
}

module.exports = { chat, clearHistory, getHistory };
