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
        
        // Fehler als standardisiertes Event zurücksenden
        await redisPubSub.publish('categoryEvent', {
          id: payload.id,
          guildId: payload.guildId,
          name: payload.name,
          discordCategoryId: payload.discordCategoryId,
          timestamp: new Date().toISOString(),
          eventType: 'error',
          error: 'Discord category not found'
        } as CategoryEvent);
        
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
        
        // WICHTIG: Erfolgsbestätigung als standardisiertes Event zurücksenden
        await redisPubSub.publish('categoryEvent', {
          id: payload.id,
          guildId: payload.guildId,
          name: payload.name,
          discordCategoryId: payload.discordCategoryId,
          timestamp: new Date().toISOString(),
          eventType: 'updateConfirmed',
          details: JSON.stringify({
            noChangeNeeded: true
          })
        } as CategoryEvent);
        
        return;
      }

      // 4. Kategorie aktualisieren
      await category.edit({
        name: payload.name,
        reason: `Update für Kategorie ${payload.id}`
      });

      logger.info(`✅ Kategorie ${payload.discordCategoryId} aktualisiert: "${payload.name}"`);
      
      // 5. WICHTIG: Erfolgsbestätigung als standardisiertes Event zurücksenden
      await redisPubSub.publish('categoryEvent', {
        id: payload.id,
        guildId: payload.guildId,
        name: payload.name,
        discordCategoryId: payload.discordCategoryId,
        timestamp: new Date().toISOString(),
        eventType: 'updateConfirmed'
      } as CategoryEvent);

      // 6. Bei Löschung in Discord
      if (isDeletedInDiscord) {
        await category.delete(`Löschung angefordert für Kategorie ${payload.id}`);
        logger.warn(`🗑️ Kategorie ${payload.discordCategoryId} gelöscht`);
      }

    } catch (error: any) {
      logger.error('❌ Update fehlgeschlagen:', error);
      
      // Fehler als standardisiertes Event zurücksenden
      await redisPubSub.publish('categoryEvent', {
        id: payload.id,
        guildId: payload.guildId || '',
        name: payload.name || '',
        discordCategoryId: payload.discordCategoryId,
        timestamp: new Date().toISOString(),
        eventType: 'error',
        error: error.message || 'Unknown error'
      } as CategoryEvent);
    }
  });
}