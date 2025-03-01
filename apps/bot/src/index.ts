// apps/bot/src/index.ts
import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';
import express from 'express';
import logger from 'pyro-logger';
import { 
  handleCategoryCreated, 
  handleCategoryUpdated, 
  handleCategoryDeleted, 
  handleZoneCreated, 
  handleZoneUpdated, 
  handleZoneDeleted 
} from './events';
import { rebuildChannelMapping, setupChannelUpdateListener } from './utils';
import { RolesListener } from './modules/roles.listener';

// Environment variables and setup
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;

if (!DISCORD_TOKEN) {
  logger.error('DISCORD_TOKEN ist nicht in den Umgebungsvariablen definiert.');
  process.exit(1);
}

if (!GUILD_ID) {
  logger.error('GUILD_ID ist nicht in den Umgebungsvariablen definiert.');
  process.exit(1);
}

// Discord client setup
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const app = express();
const port = process.env.BOT_PORT ? parseInt(process.env.BOT_PORT, 10) : 3003;

// Discord client events
client.on('debug', (info) => {
  logger.info('Discord.js debug:', info);
});

client.on('rateLimit', (info) => {
  logger.warn(`Rate limit hit on route ${info.route}: retry after ${info.retryAfter}ms`);
});

client.once('ready', async () => {
  logger.info('Bot ist online');

  // Rebuild channel mapping on startup
  await rebuildChannelMapping();
  
  // Setup channel update listener
  setupChannelUpdateListener(client);

  // Initialize roles listener
  new RolesListener(client);

  // Start event handlers for categories and zones
  handleCategoryCreated(client);
  handleCategoryUpdated(client);
  handleCategoryDeleted(client);
  handleZoneCreated(client);
  handleZoneUpdated(client);
  handleZoneDeleted(client);

  // Simple HTTP Status-Server einrichten
  app.get('/health', (req, res) => res.json({ status: 'ok' }));
  app.get('/', (req, res) => res.send('Bot läuft!'));
  
  app.listen(port, () => {
    logger.info(`HTTP-Status-Server läuft auf Port ${port}`);
  });
});

// Log in to Discord
client.login(DISCORD_TOKEN).catch(error => {
  logger.error('Fehler beim Login:', error);
  process.exit(1);
});