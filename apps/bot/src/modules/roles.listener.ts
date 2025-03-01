// apps/bot/src/modules/roles.listener.ts
import { Client } from 'discord.js';
import { redisPubSub } from '../pubsub/redis.pubsub';
import { DiscordRole, DiscordRoleTags, RoleEvent } from 'pyro-types';
import logger from 'pyro-logger';

export class RolesListener {
  constructor(private readonly client: Client) {
    this.initialize();
    logger.info('Roles Listener initialisiert');
  }

  private initialize() {
    // Auf den standardisierten Event-Typ 'roleEvent' hören
    redisPubSub.subscribe('roleEvent', async (payload: unknown) => {
      try {
        const roleEventPayload = payload as RoleEvent;
        
        // Nur Anfragen (Requests) verarbeiten
        if (roleEventPayload.eventType !== 'request') {
          return;
        }
        
        const { requestId, guildId } = roleEventPayload;
        
        
        const guild = await this.client.guilds.fetch(guildId);
        
        const roles = guild.roles.cache.map(role => ({
          __typename: 'DiscordRole' as const,
          id: role.id,
          name: role.name,
          color: role.color,
          isHoist: role.hoist,
          position: role.position,
          permissions: role.permissions.bitfield.toString(),
          isManaged: role.managed,
          isMentionable: role.mentionable,
          createdAt: role.createdAt.toISOString(),
          createdTimestamp: role.createdTimestamp,
          tags: role.tags ? {
            __typename: 'DiscordRoleTags' as const,
            botId: role.tags.botId,
            integrationId: role.tags.integrationId,
            isPremiumSubscriberRole: role.tags.premiumSubscriberRole 
          } : null
        }));

        // Standardisiertes Event-Format für die Antwort verwenden
        const roleEvent: RoleEvent = {
          eventType: 'response',
          guildId,
          requestId,
          timestamp: new Date().toISOString(),
          roles
        };
        
        // Event über den standardisierten Kanal veröffentlichen
        await redisPubSub.publish('roleEvent', roleEvent);
        
      } catch (error) {
        const errorMessage = error instanceof Error 
          ? error.message 
          : 'Unbekannter Fehler';
        
        // Fehlerantwort als RoleEvent formatieren und senden
        try {
          const roleEventPayload = payload as RoleEvent;
          const requestId = roleEventPayload.requestId;
          const guildId = roleEventPayload.guildId;
          
          const errorEvent: RoleEvent = {
            eventType: 'error',
            guildId,
            requestId,
            timestamp: new Date().toISOString(),
            error: errorMessage
          };
          
          // Fehler über den standardisierten Kanal veröffentlichen
          await redisPubSub.publish('roleEvent', errorEvent);
        } catch (e) {
          logger.error('Fehler beim Extrahieren der Anfragedaten aus dem Payload:', e);
        }
        
        logger.error('Fehler beim Abrufen der Rollen:', error);
      }
    });
    
    // Für Rückwärtskompatibilität auch auf 'rolesRequest' hören, aber warnen
    redisPubSub.subscribe('rolesRequest', async (payload: unknown) => {
      logger.warn('Veralteter Event-Typ "rolesRequest" empfangen - bitte auf "roleEvent" mit eventType="request" umstellen');
      
      try {
        const { requestId, guildId } = payload as { requestId: string; guildId: string };
        
        // Umwandlung in standardisiertes Format und Weiterleitung
        const roleEvent: RoleEvent = {
          eventType: 'request',
          guildId,
          requestId,
          timestamp: new Date().toISOString()
        };
        
        // Weiterleitung an den Standardhandler
        redisPubSub.publish('roleEvent', roleEvent);
      } catch (error) {
        logger.error('Fehler bei der Verarbeitung des veralteten rolesRequest:', error);
      }
    });
  }
}