// apps/bot/src/events/handle-zone-deleted.ts
import { Client, VoiceChannel } from 'discord.js';
import { redisPubSub } from '../pubsub/redis.pubsub';
import logger from 'pyro-logger';
import { ZoneEvent } from 'pyro-types';

export function handleZoneDeleted(discordClient: Client) {
  redisPubSub.subscribe('zoneEvent', async (message: ZoneEvent) => {
    // Nur Events vom Typ 'deleted' verarbeiten
    if (message.eventType !== 'deleted') {
      return;
    }

    logger.info('Received zoneEvent (deleted):', message);
    
    try {
      const { id, discordVoiceId } = message;
      
      if (!discordVoiceId) {
        logger.warn('Kein discordVoiceId in der gelöschten Zone vorhanden.');
        return;
      }
      
      const channel = await discordClient.channels.fetch(discordVoiceId);
      
      if (!channel) {
        logger.warn(`Channel mit ID ${discordVoiceId} nicht gefunden.`);
        return;
      }
      
      if (channel instanceof VoiceChannel) {
        logger.info(`Voice-Channel gefunden: ${channel.name}`);
        
        await channel.delete();
        logger.info(`Discord-Voice-Channel gelöscht: ${channel.name}`);
        
        // Bestätigung an API senden
        await redisPubSub.publish('zoneDeleteConfirmed', {
          apiZoneId: id,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error: any) {
      logger.error('Fehler beim Löschen des Voice Channels:', error);
      
      // Fehler an API melden
      await redisPubSub.publish('zoneDeleteError', {
        apiZoneId: message.id,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
}