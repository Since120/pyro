// apps/bot/src/events/handle-zone-updated.ts
import { Client, VoiceChannel } from 'discord.js';
import { redisPubSub } from '../pubsub/redis.pubsub';
import { getChannelMapping, setChannelMapping } from '../utils/channelMapping';
import logger from 'pyro-logger';
import { ZoneEvent } from 'pyro-types';

export function handleZoneUpdated(discordClient: Client) {
  redisPubSub.subscribe('zoneEvent', async (payload: ZoneEvent) => {
    // Nur Events vom Typ 'updated' verarbeiten
    if (payload.eventType !== 'updated') {
      return;
    }

    logger.info('Received zoneEvent (updated):', payload);
    
    const { id, name, discordVoiceId } = payload;
    
    // Wenn keine Discord Voice ID vorhanden ist, können wir nichts aktualisieren
    if (!discordVoiceId) {
      logger.warn('Kein discordVoiceId in der aktualisierten Zone vorhanden.');
      return;
    }
    
    // Verwenden der vorhandenen Mappings, um die Kategorie zu identifizieren
    const discordCategoryId = await getChannelMapping(discordVoiceId);
    
    // Wenn wir eine discordCategoryId haben, bestätigen wir das Mapping
    if (discordCategoryId) {
      // Bestätige das Mapping in Redis
      logger.info(`Vorhandenes Mapping gefunden: ${discordVoiceId} -> ${discordCategoryId}`);
    } else {
      logger.warn(`Kein Mapping für Voice-Channel ${discordVoiceId} gefunden.`);
      
      // Hier könnte man optional einen Fallback-Mechanismus implementieren,
      // um die discordCategoryId zu ermitteln, z.B. durch API-Anfrage
      // Da wir aber ein Update verarbeiten, sollte das Mapping bereits existieren
    }
    
    // Nur wenn wir eine Name-Änderung haben, aktualisieren wir den Discord-Channel
    if (name) {
      try {
        const channel = await discordClient.channels.fetch(discordVoiceId);
        
        if (!channel) {
          logger.warn(`Channel mit ID ${discordVoiceId} nicht gefunden.`);
          return;
        }
        
        if (channel instanceof VoiceChannel) {
          logger.info(`Voice-Channel gefunden: ${channel.name}`);
          
          // Umbenennen des Voice-Channel-Namens
          if (name !== channel.name) {
            await channel.setName(name);
            logger.info(`Voice-Channel ${channel.name} wurde auf ${name} umbenannt.`);
          }

          // Überprüfen ob der Channel in der richtigen Kategorie ist
          const expectedCategoryId = await getChannelMapping(discordVoiceId);
          if (expectedCategoryId && channel.parentId !== expectedCategoryId) {
            logger.info(`Channel ${channel.name} wurde manuell verschoben. Verschiebe zurück in die korrekte Kategorie.`);
            
            try {
              await channel.setParent(expectedCategoryId);
              logger.info(`Channel ${channel.name} wurde wieder in die korrekte Kategorie verschoben.`);
            } catch (err) {
              logger.error(`Fehler beim Zurückverschieben des Channels ${channel.name}:`, err);
            }
          }
        }
      } catch (err) {
        logger.error('Fehler beim Aktualisieren des Voice Channels:', err);
      }
    }
  });
}