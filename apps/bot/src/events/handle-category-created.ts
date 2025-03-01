// apps/bot/src/events/handle-category-created.ts
import { redisPubSub } from '../pubsub/redis.pubsub';
import { Client, ChannelType, DiscordAPIError, GuildChannelManager } from 'discord.js';
import logger from 'pyro-logger';
import { CategoryEvent } from 'pyro-types';

// Maximale Anzahl Wiederholungsversuche bei Discord-API-Fehlern
const MAX_RETRY_ATTEMPTS = 3;
// Basis-Wartezeit für exponentiellen Backoff (in ms)
const BASE_RETRY_DELAY = 1000;

export function handleCategoryCreated(discordClient: Client) {
  redisPubSub.subscribe('categoryEvent', async (message: CategoryEvent) => {
    // Only process 'created' events
    if (message.eventType !== 'created') {
      return;
    }
    
    logger.info('Received categoryEvent (created):', message);

    const { id: apiCategoryId, name, guildId, discordCategoryId } = message;

    // Eingabevalidierung für alle erforderlichen Felder
    if (!guildId || !name || !apiCategoryId) {
      logger.error('Missing required fields:', { apiCategoryId, guildId, name });
      
      // Sende Fehlermeldung zurück an API
      redisPubSub.publish('categoryEvent', {
        id: apiCategoryId || 'unknown',
        guildId: guildId || '',
        name: name || '',
        timestamp: new Date().toISOString(),
        eventType: 'error',
        error: 'Fehlende Pflichtfelder (apiCategoryId, guildId oder name)'
      } as CategoryEvent);
      
      return;
    }

    // Wenn Kategorie bereits in Discord existiert, nichts weiter tun
    if (discordCategoryId) {
      logger.info('Category already exists in Discord:', discordCategoryId);
      
      // Bestätigung zurücksenden
      redisPubSub.publish('categoryEvent', {
        id: apiCategoryId,
        guildId: guildId,
        name: name,
        discordCategoryId: discordCategoryId,
        timestamp: new Date().toISOString(),
        eventType: 'confirmation'
      } as CategoryEvent);
      
      return;
    }

    // Funktion zum Erstellen der Discord-Kategorie mit Wiederholungsversuchen
    async function createDiscordCategory(
      attemptCount: number = 0
    ): Promise<void> {
      try {
        // Guild abrufen
        const guild = await discordClient.guilds.fetch(guildId);
        
        if (!guild) {
          throw new Error(`Guild mit ID ${guildId} nicht gefunden`);
        }
        
        // Stelle sicher, dass die GuildChannelManager-Instanz existiert
        if (!guild.channels) {
          throw new Error(`GuildChannelManager für Guild ${guildId} nicht verfügbar`);
        }
        
        logger.info(`Creating Discord category "${name}" in guild ${guildId}`);
        
        // Kategorie in Discord erstellen
        const discordCategory = await guild.channels.create({
          name: name,
          type: ChannelType.GuildCategory,
          reason: `Automatisch erstellt für Kategorie ${apiCategoryId}`
        });

        // Erfolgsmeldung senden
        logger.info('Discord category created successfully:', {
          categoryId: apiCategoryId,
          discordCategoryId: discordCategory.id,
          name
        });
        
        // Bestätigung zurück an API senden
        await redisPubSub.publish('categoryEvent', {
          id: apiCategoryId,
          guildId: guildId,
          name: name,
          discordCategoryId: discordCategory.id,
          timestamp: new Date().toISOString(),
          eventType: 'confirmation'
        } as CategoryEvent);
        
      } catch (error) {
        // Detailliertes Error-Logging
        logger.error('Error creating Discord category:', error);
        
        // Für Discord API-Fehler
        if (error instanceof DiscordAPIError) {
          logger.error('Discord API error details:', {
            code: error.code,
            status: error.status,
            message: error.message,
            method: error.method,
            url: error.url,
            categoryId: apiCategoryId,
            guildId
          });
          
          // Bei bestimmten bekannten Fehlercodes automatisch wiederholen
          const retriableErrors = [
            429, // Ratelimit
            500, // Internal Server Error
            503, // Service Unavailable
            504  // Gateway Timeout
          ];
          
          if (retriableErrors.includes(error.status) && attemptCount < MAX_RETRY_ATTEMPTS) {
            // Berechnung des Retry-Delays mit exponentiellem Backoff
            const retryDelay = BASE_RETRY_DELAY * Math.pow(2, attemptCount);
            const nextAttempt = attemptCount + 1;
            
            logger.info(`Retrying Discord category creation (attempt ${nextAttempt}/${MAX_RETRY_ATTEMPTS}) in ${retryDelay}ms`);
            
            // Warte und versuche es erneut
            setTimeout(() => {
              createDiscordCategory(nextAttempt).catch(retryError => {
                logger.error(`Retry attempt ${nextAttempt} failed:`, retryError);
              });
            }, retryDelay);
            
            return;
          }
        }
        
        // Fehlermeldung an API senden
        const errorDetail = error instanceof Error ? error.message : 'Unbekannter Fehler';
        const errorStack = error instanceof Error ? error.stack : undefined;
        const errorCode = error instanceof DiscordAPIError ? error.code : undefined;
        const errorStatus = error instanceof DiscordAPIError ? error.status : undefined;
        
        try {
          await redisPubSub.publish('categoryEvent', {
            id: apiCategoryId,
            guildId: guildId,
            name: name,
            timestamp: new Date().toISOString(),
            eventType: 'error',
            error: `Discord API-Fehler: ${errorDetail}`,
            details: JSON.stringify({
              errorCode,
              errorStatus,
              errorStack,
              attempts: attemptCount + 1
            })
          } as CategoryEvent);
          
          logger.info('Error event published back to API');
        } catch (pubSubError) {
          logger.error('Failed to publish error event to Redis:', pubSubError);
        }
      }
    }

    // Starte den Prozess mit dem ersten Versuch
    await createDiscordCategory();
  });
}