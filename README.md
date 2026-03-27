# VoltraBot – Discord KI-Bot mit Web-Dashboard

Ein Discord-Bot powered by **Voltra AI** mit einer vollständigen Web-Oberfläche zum Konfigurieren.

## Features
- 🧠 **Voltra AI** als KI-Backend (deine eigene API)
- 📌 **Channel-Auswahl** – Bot ist nur in einem bestimmten Channel aktiv
- ✏️ **System-Prompt pro Server** – jeder Discord-Server hat seinen eigenen Charakter
- 🔄 **Gesprächsgedächtnis** – Kontext bleibt innerhalb eines Channels erhalten
- 🌐 **Web-Dashboard** – alles über den Browser konfigurierbar
- 🔐 **Discord OAuth2** – Login mit Discord, nur Admin-Server sichtbar
- ⚙️ **Slash Commands** – `/setchannel`, `/setprompt`, `/reset`, `/status`

---

## Setup

### 1. Repository vorbereiten
```bash
npm install
cp .env.example .env
```

### 2. Discord Application erstellen
1. Gehe zu https://discord.com/developers/applications
2. Klick "New Application" → gib einen Namen ein
3. Unter **Bot** → "Add Bot" → Token kopieren → in `.env` einfügen
4. Unter **OAuth2 → General**:
   - Redirect URI hinzufügen: `http://localhost:3000/auth/callback`
   - Client ID & Client Secret in `.env` einfügen
5. Unter **Bot**:
   - ✅ `SERVER MEMBERS INTENT` aktivieren
   - ✅ `MESSAGE CONTENT INTENT` aktivieren

### 3. .env befüllen
```env
DISCORD_TOKEN=dein_bot_token
DISCORD_CLIENT_ID=deine_client_id
DISCORD_CLIENT_SECRET=dein_client_secret
VOLTRA_API_KEY=vol_dein_api_key
SESSION_SECRET=irgendetwas_langes_und_zufälliges
PORT=3000
BASE_URL=http://localhost:3000
```

### 4. Starten
```bash
npm start
```

Dashboard erreichbar unter: **http://localhost:3000**

---

## Benutzung

### Über das Web-Dashboard
1. Öffne `http://localhost:3000`
2. Klick "Bot einladen" → Server auswählen
3. "Dashboard öffnen" → mit Discord anmelden
4. Server auswählen → Channel und System-Prompt konfigurieren
5. Speichern → Bot ist sofort aktiv!

### Über Slash Commands (im Discord)
| Command | Beschreibung |
|---|---|
| `/setchannel #channel` | Setzt den aktiven Channel |
| `/setprompt <text>` | Setzt den System-Prompt |
| `/setname <name>` | Setzt den Bot-Namen |
| `/reset` | Setzt den Gesprächsverlauf zurück |
| `/status` | Zeigt aktuelle Einstellungen |

---

## Produktion (Deployment)
Für Hosting auf z.B. Railway, Render oder VPS:
1. `BASE_URL` auf deine Domain setzen (z.B. `https://voltrabot.example.com`)
2. Redirect URI in Discord Developer Portal updaten
3. `SESSION_SECRET` auf einen sicheren Wert setzen
4. Für persistente Daten: `data/guilds.json` als Volume mounten

---

## Projektstruktur
```
discord-voltra-bot/
├── index.js          # Einstiegspunkt (Bot + Server)
├── bot.js            # Discord.js Bot Logik
├── server.js         # Express Web-Server + API
├── voltra.js         # Voltra AI API Client
├── data/
│   ├── store.js      # Guild-Einstellungen (JSON)
│   └── guilds.json   # Gespeicherte Konfigurationen (auto-erstellt)
├── public/
│   ├── index.html    # Landing Page
│   ├── dashboard.html # Server-Auswahl
│   └── guild.html    # Server-Konfiguration
├── .env.example      # Umgebungsvariablen Vorlage
└── package.json
```
