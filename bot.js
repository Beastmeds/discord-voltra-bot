// bot.js – Discord Bot mit Voltra AI Integration
const { Client, GatewayIntentBits, Partials, ActivityType, SlashCommandBuilder, Routes } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { chat, clearHistory } = require('./voltra');
const { getGuild, setGuild, setChannelPrompt } = require('./data/store');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel]
});

// ── Slash Commands registrieren ──────────────────────────────────────────────
const commands = [
  new SlashCommandBuilder()
    .setName('setchannel')
    .setDescription('Setzt den Channel, in dem der Bot aktiv ist')
    .addChannelOption(opt =>
      opt.setName('channel').setDescription('Der Channel').setRequired(true)
    )
    .setDefaultMemberPermissions(8), // Administrator

  new SlashCommandBuilder()
    .setName('setprompt')
    .setDescription('Setzt den System-Prompt (Chat oder Guild)')
    .addStringOption(opt =>
      opt.setName('prompt').setDescription('Der System-Prompt').setRequired(true).setMaxLength(2000)
    )
    .addBooleanOption(opt =>
      opt.setName('guild').setDescription('Wenn true: als Standard-Prompt für die ganze Guild setzen').setRequired(false)
    )
    .setDefaultMemberPermissions(8),

  new SlashCommandBuilder()
    .setName('setname')
    .setDescription('Setzt den Namen des Bots für diese Guild')
    .addStringOption(opt =>
      opt.setName('name').setDescription('Bot-Name').setRequired(true)
    )
    .setDefaultMemberPermissions(8),

  new SlashCommandBuilder()
    .setName('reset')
    .setDescription('Setzt den Gesprächsverlauf in diesem Channel zurück'),

  new SlashCommandBuilder()
    .setName('status')
    .setDescription('Zeigt die aktuellen Bot-Einstellungen dieser Guild'),
].map(cmd => cmd.toJSON());

async function registerCommands() {
  if (!process.env.DISCORD_TOKEN || !process.env.DISCORD_CLIENT_ID) {
    console.warn('[Bot] DISCORD_TOKEN oder CLIENT_ID fehlt – Commands nicht registriert.');
    return;
  }
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID), { body: commands });
    console.log('[Bot] ✅ Slash Commands registriert');
  } catch (err) {
    console.error('[Bot] ❌ Command-Registrierung fehlgeschlagen:', err.message);
  }
}

// ── Events ───────────────────────────────────────────────────────────────────
client.once('ready', async () => {
  console.log(`[Bot] ✅ Eingeloggt als ${client.user.tag}`);
  client.user.setActivity('powered by Voltra AI', { type: ActivityType.Playing });
  await registerCommands();
});

client.on('guildCreate', guild => {
  console.log(`[Bot] Neuer Server: ${guild.name} (${guild.id})`);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, guildId } = interaction;
  const settings = getGuild(guildId);

  if (commandName === 'setchannel') {
    const channel = interaction.options.getChannel('channel');
    setGuild(guildId, { channelId: channel.id });
    return interaction.reply({
      content: `✅ Bot ist jetzt in <#${channel.id}> aktiv.`,
      ephemeral: true
    });
  }

  if (commandName === 'setprompt') {
    const prompt = interaction.options.getString('prompt');
    const forGuild = interaction.options.getBoolean('guild') === true;
    if (forGuild) setGuild(guildId, { systemPrompt: prompt });
    else setChannelPrompt(guildId, interaction.channelId, prompt);
    return interaction.reply({
      content: forGuild
        ? '✅ Guild-Standard System-Prompt gesetzt. (Modell bleibt immer Voltra AI)'
        : `✅ System-Prompt für <#${interaction.channelId}> gesetzt. (Modell bleibt immer Voltra AI)`,
      ephemeral: true
    });
  }

  if (commandName === 'setname') {
    const name = interaction.options.getString('name');
    setGuild(guildId, { botName: name });
    return interaction.reply({
      content: `✅ Bot-Name auf **${name}** gesetzt.`,
      ephemeral: true
    });
  }

  if (commandName === 'reset') {
    clearHistory(guildId, interaction.channelId);
    return interaction.reply({ content: '🔄 Gesprächsverlauf zurückgesetzt.', ephemeral: true });
  }

  if (commandName === 'status') {
    const s = getGuild(guildId);
    const channelPrompt = (s.channelPrompts && s.channelPrompts[interaction.channelId]) || null;
    const activePrompt = channelPrompt || s.systemPrompt;
    const promptPreviewMaxLen = 1200;
    const safePrompt = String(activePrompt || '').replace(/```/g, '`` `');
    const promptPreview = safePrompt.length > promptPreviewMaxLen
      ? safePrompt.slice(0, promptPreviewMaxLen) + '\n...[gekürzt]'
      : safePrompt;
    return interaction.reply({
      content: [
        `**⚙️ Bot-Status für ${interaction.guild.name}**`,
        `📌 Aktiver Channel: ${s.channelId ? `<#${s.channelId}>` : 'Keiner gesetzt'}`,
        `🤖 Bot-Name: ${s.botName}`,
        `🧠 Modell: Voltra AI`,
        `💬 Prompt: ${channelPrompt ? 'Channel-Override' : 'Guild-Default'}`,
        `📝 System-Prompt (dieser Chat):\n\`\`\`${promptPreview}\`\`\``
      ].join('\n'),
      ephemeral: true
    });
  }
});

client.on('messageCreate', async message => {
  if (message.author.bot) return;
  if (!message.guildId) return; // Keine DMs

  const settings = getGuild(message.guildId);

  // Nur im konfigurierten Channel antworten (oder wenn kein Channel gesetzt: nicht antworten)
  if (!settings.channelId) return;
  if (message.channelId !== settings.channelId) return;

  // Bot erwähnt oder normale Nachricht im Channel
  const content = message.content
    .replace(`<@${client.user.id}>`, '').trim();

  if (!content) return;

  try {
    await message.channel.sendTyping();

    const chatPrompt = (settings.channelPrompts && settings.channelPrompts[message.channelId]) || settings.systemPrompt;
    const reply = await chat(
      content,
      message.guildId,
      message.channelId,
      chatPrompt,
      settings.botName
    );

    // Lange Antworten aufteilen (Discord limit: 2000 Zeichen)
    if (reply.length <= 2000) {
      await message.reply(reply);
    } else {
      const chunks = reply.match(/[\s\S]{1,1900}/g) || [];
      for (const chunk of chunks) {
        await message.channel.send(chunk);
      }
    }
  } catch (error) {
    console.error('[Bot] Fehler beim Antworten:', error.message);
    await message.reply('❌ Fehler beim Verbinden mit der KI. Bitte versuche es später.');
  }
});

function startBot() {
  if (!process.env.DISCORD_TOKEN) {
    console.warn('[Bot] ⚠️  DISCORD_TOKEN nicht gesetzt – Bot startet nicht.');
    return;
  }
  client.login(process.env.DISCORD_TOKEN).catch(err => {
    console.error('[Bot] Login fehlgeschlagen:', err.message);
  });
}

module.exports = { client, startBot };
