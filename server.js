// server.js – Express Dashboard & Landing Page
const express = require('express');
const session = require('express-session');
const fetch = require('node-fetch');
const path = require('path');
const { getGuild, setGuild, getAllGuilds } = require('./data/store');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'voltrabot_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 1000 * 60 * 60 * 24 } // 24h
}));

const DISCORD_API = 'https://discord.com/api/v10';
const CLIENT_ID = process.env.DISCORD_CLIENT_ID || 'DEINE_CLIENT_ID';
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || '';
const BASE_URL = process.env.BASE_URL || 'http://beastsmp.beastmeds.de:3000';
const REDIRECT_URI = `${BASE_URL}/auth/callback`;
const BOT_PERMISSIONS = '274877908992'; // Send Messages + Read Messages + Use Slash Commands

// ── Middleware: Auth prüfen ───────────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (req.session.user) return next();
  req.session.returnTo = req.originalUrl;
  res.redirect('/auth/login');
}

// ── Auth Routes ───────────────────────────────────────────────────────────────
app.get('/auth/login', (req, res) => {
  console.log('[Auth] Redirect URI wird verwendet:', REDIRECT_URI);
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'identify guilds',
  });
  res.redirect(`https://discord.com/oauth2/authorize?${params}`);
});

app.get('/auth/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.redirect('/?error=no_code');

  try {
    // Token tauschen
    const tokenRes = await fetch(`${DISCORD_API}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
      })
    });
    const tokens = await tokenRes.json();
    if (!tokens.access_token) throw new Error('Kein Access Token');

    // User-Daten holen
    const userRes = await fetch(`${DISCORD_API}/users/@me`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });
    const user = await userRes.json();

    // Guilds holen
    const guildsRes = await fetch(`${DISCORD_API}/users/@me/guilds`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });
    const guilds = await guildsRes.json();

    // Nur Guilds wo User Admin ist
    const adminGuilds = (Array.isArray(guilds) ? guilds : [])
      .filter(g => (BigInt(g.permissions) & BigInt(0x8)) === BigInt(0x8));

    req.session.user = user;
    req.session.guilds = adminGuilds;
    req.session.tokens = tokens;

    const returnTo = req.session.returnTo || '/dashboard';
    delete req.session.returnTo;
    res.redirect(returnTo);
  } catch (err) {
    console.error('[Auth] Fehler:', err.message);
    res.redirect('/?error=auth_failed');
  }
});

app.get('/auth/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// ── API Routes ────────────────────────────────────────────────────────────────
// Guild-Einstellungen speichern
app.post('/api/guild/:guildId', requireAuth, (req, res) => {
  const { guildId } = req.params;
  const { systemPrompt, channelId, botName } = req.body;

  // Prüfen ob User in der Guild Admin ist
  const userGuilds = req.session.guilds || [];
  const guild = userGuilds.find(g => g.id === guildId);
  if (!guild) return res.status(403).json({ error: 'Kein Zugriff auf diese Guild' });

  const updated = setGuild(guildId, {
    ...(systemPrompt !== undefined && { systemPrompt }),
    ...(channelId !== undefined && { channelId }),
    ...(botName !== undefined && { botName }),
  });

  res.json({ success: true, settings: updated });
});

// Guild-Einstellungen lesen
app.get('/api/guild/:guildId', requireAuth, (req, res) => {
  const { guildId } = req.params;
  const userGuilds = req.session.guilds || [];
  const guild = userGuilds.find(g => g.id === guildId);
  if (!guild) return res.status(403).json({ error: 'Kein Zugriff' });

  res.json(getGuild(guildId));
});

// Channels einer Guild holen (braucht Bot-Token)
app.get('/api/guild/:guildId/channels', requireAuth, async (req, res) => {
  const { guildId } = req.params;
  const userGuilds = req.session.guilds || [];
  if (!userGuilds.find(g => g.id === guildId))
    return res.status(403).json({ error: 'Kein Zugriff' });

  try {
    const r = await fetch(`${DISCORD_API}/guilds/${guildId}/channels`, {
      headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` }
    });
    const channels = await r.json();
    const textChannels = (Array.isArray(channels) ? channels : [])
      .filter(c => c.type === 0) // nur Text-Channels
      .sort((a, b) => a.position - b.position)
      .map(c => ({ id: c.id, name: c.name }));
    res.json(textChannels);
  } catch (err) {
    res.json([]); // Fallback: leere Liste
  }
});

// Session-User
app.get('/api/me', (req, res) => {
  if (!req.session.user) return res.json({ user: null });
  res.json({ user: req.session.user, guilds: req.session.guilds });
});

// ── Page Routes ───────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dashboard', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/dashboard/:guildId', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'guild.html'));
});

// Invite-Link
app.get('/invite', (req, res) => {
  const url = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&permissions=${BOT_PERMISSIONS}&scope=bot%20applications.commands`;
  res.redirect(url);
});

module.exports = app;