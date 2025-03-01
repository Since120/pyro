// apps/bot/src/events/handle-category-updated.ts
import { Client, ChannelType } from 'discord.js';
import { redisPubSub } from '../pubsub/redis.pubsub';
import logger from 'pyro-logger';
import { CategoryEvent } from 'pyro-types';

export function handleCategoryUpdated(discordClient: Client) {
  // Bessere Logging beim Start
  logger.info('🔄 Initialisiere Category-Update Handler');
  
  const subscription = redisPubSub.subscribe('categoryEvent', async (payload: CategoryEvent) => {
    // Nur Events vom Typ 'updated' verarbeiten
    if (payload.eventType !== 'updated') {
      return;
    }

    logger.info('Received categoryEvent (updated):', payload);
    
    try {
      // 1. Validierung der kritischen Felder
      if (!payload.discordCategoryId || !payload.guildId || !payload.name) {
        logger.warn('⚠️ Unvollständiges Update-Event:', {
          id: payload.id,
          hasDiscordId: !!payload.discordCategoryId,
          hasGuildId: !!payload.guildId,
          hasName: !!payload.name
        });
        return;
      }

      // 2. Guild und Kategorie suchen
      const guild = await discordClient.guilds.fetch(payload.guildId);
      const category = await guild.channels.fetch(payload.discordCategoryId);
      
      if (!category) {
        logger.error('❌ Kategorie nicht gefunden:', payload.discordCategoryId);
        await redisPubSub.publish('categoryUpdateError', {
          apiCategoryId: payload.id,
          error: 'Discord category not found',
          originalPayload: payload,
          timestamp: new Date().toISOString()
        });
        return;
      }

      // 3. Überprüfen ob Änderung notwendig ist
      // Der isDeletedInDiscord Parameter wird aus den Details extrahiert, falls vorhanden
      let isDeletedInDiscord = false;
      try {
        if (payload.details) {
          const details = JSON.parse(payload.details);
          isDeletedInDiscord = details.isDeletedInDiscord === true;
        }
      } catch (e) {
        logger.error('Fehler beim Parsen der Details', e);
      }
      
      if (category.name === payload.name && !isDeletedInDiscord) {
        logger.info('✅ Keine Namensänderung erforderlich');
        
        // Trotzdem eine Bestätigung senden, dass alles ok ist
        await redisPubSub.publish('categoryUpdateConfirmed', {
          apiCategoryId: payload.id,
          discordCategoryId: payload.discordCategoryId,
          guildId: payload.guildId,
          name: payload.name,
          noChangeNeeded: true,
          timestamp: new Date().toISOString()
        });
        
        return;
      }

      // 4. Kategorie aktualisieren
      await category.edit({
        name: payload.name,
        reason: `Update für Kategorie ${payload.id}`
      });

      logger.info(`✅ Kategorie ${payload.discordCategoryId} aktualisiert: "${payload.name}"`);
      
      // 5. Erfolgsbestätigung senden
      await redisPubSub.publish('categoryUpdateConfirmed', {
        apiCategoryId: payload.id,
        discordCategoryId: payload.discordCategoryId,
        guildId: payload.guildId,
        name: payload.name,
        timestamp: new Date().toISOString()
      });

      // 6. Bei Löschung in Discord
      if (isDeletedInDiscord) {
        await category.delete(`Löschung angefordert für Kategorie ${payload.id}`);
        logger.warn(`🗑️ Kategorie ${payload.discordCategoryId} gelöscht`);
      }

    } catch (error: any) {
      logger.error('❌ Update fehlgeschlagen:', error);
      
      await redisPubSub.publish('categoryUpdateError', {
        apiCategoryId: payload.id,
        error: error.message,
        originalPayload: payload,
        timestamp: new Date().toISOString()
      });
    }
  });
}