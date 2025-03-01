// apps/bot/src/events/handle-category-deleted.ts
import { Client } from 'discord.js';
import { redisPubSub } from '../pubsub/redis.pubsub';
import logger from 'pyro-logger';
import { CategoryEvent } from 'pyro-types';

export function handleCategoryDeleted(discordClient: Client) {
  redisPubSub.subscribe('categoryEvent', async (message: CategoryEvent) => {
    // Nur Events vom Typ 'deleted' verarbeiten
    if (message.eventType !== 'deleted') {
      return;
    }

    logger.info('Received categoryEvent (deleted):', message);

    try {
      // 1. Validierung
      if (!message.discordCategoryId) {
        logger.warn('Löschung ignoriert: Keine discordCategoryId', message);
        return;
      }
      
      if (!message.guildId) {
        logger.error('Fehlende guildId:', message);
        return;
      }

      // 2. Kanal löschen
      const guild = await discordClient.guilds.fetch(message.guildId);
      const channel = await guild.channels.fetch(message.discordCategoryId);

      if (channel) {
        await channel.delete(`API Delete: ${message.id}`);
        
        // 3. Bestätigung senden
        await redisPubSub.publish('categoryDeleteConfirmed', {
          apiCategoryId: message.id,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error: any) {
      logger.error('Löschung fehlgeschlagen:', error);
      await redisPubSub.publish('categoryDeleteError', {
        apiCategoryId: message.id,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
}