const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Collection, Partials } = require('discord.js');
require('dotenv').config();
const { connectDB } = require('./utils/db');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [Partials.Channel, Partials.Message],
});

client.commands = new Collection();

// ---------- commands/ klasorunu yukle ----------
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));

  if (command && command.data && typeof command.execute === 'function') {
    client.commands.set(command.data.name, command);
    console.log(`[KOMUT YUKLENDI] /${command.data.name}`);
  } else {
    console.warn(`[UYARI] ${file} gecerli bir komut degil (data/execute eksik).`);
  }
}

// ---------- events/ klasorunu yukle ----------
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
  const event = require(path.join(eventsPath, file));

  if (!event || !event.name || typeof event.execute !== 'function') {
    console.warn(`[UYARI] ${file} gecerli bir event degil (name/execute eksik).`);
    continue;
  }

  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }

  console.log(`[EVENT YUKLENDI] ${event.name}`);
}

(async () => {
  try {
    await connectDB();
  } catch (err) {
    console.error('[MONGODB] Baglanti hatasi:', err.message);
    console.error('MONGO_URI degiskenini .env dosyanda kontrol et. Bot MongoDB olmadan da acilir ama warn/auto/rolver gibi komutlar calismaz.');
  }

  client.login(process.env.TOKEN);
})();