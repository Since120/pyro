// apps/bot/src/events/handle-zone-created.ts
import { Client, ChannelType } from 'discord.js';
import { redisPubSub } from '../pubsub/redis.pubsub';
import logger from 'pyro-logger';
import { setChannelMapping } from '../utils/channelMapping';
import { ZoneEvent } from 'pyro-types';

export function handleZoneCreated(discordClient: Client) {
  redisPubSub.subscribe('zoneEvent', (message: ZoneEvent) => {
    // Nur Events vom Typ 'created' verarbeiten
    if (message.eventType !== 'created') {
      return;
    }

    logger.info('Received zoneEvent (created):', message);
    
    const { id: apiZoneId, name, categoryId, discordVoiceId } = message;
    
    if (!categoryId) {
      logger.error('Keine Kategorie-ID in der Zone gefunden');
      return;
    }

    // Wir benötigen die discordCategoryId
    // Da diese im ZoneEvent nicht direkt verfügbar ist, müssen wir sie aus dem Event-Kontext oder der API holen
    // Temporäre Lösung: API-Anfrage machen oder Fallback verwenden

    // Für jetzt verwenden wir einen Fallback-Mechanismus, der in der Produktion ersetzt werden sollte:
    // 1. Versuchen, die discordCategoryId aus einer Redis Query zu bekommen
    // 2. Fallback auf eine Umgebungsvariable oder Konfiguration
    
    // Hier sollte die Logik implementiert werden, um die discordCategoryId zu ermitteln
    // z.B. einen Redis-Lookup basierend auf categoryId ausführen
    // Für dieses Beispiel verwenden wir eine statische Implementierung
    const discordCategoryId = process.env.DEFAULT_DISCORD_CATEGORY_ID;
    
    if (!discordCategoryId) {
      logger.error('Keine Discord-Kategorie-ID gefunden');
      return;
    }
    
    // Guild-ID aus der Umgebungsvariable verwenden
    const guildId = process.env.GUILD_ID;
    
    if (!guildId) {
      logger.error('GuildId fehlt in der Nachricht und auch in der Umgebungsvariable GUILD_ID');
      return;
    }

    logger.info(`Verwende Guild-ID: ${guildId} für Zone "${name}"`);

    // Discord-Guild anhand der übergebenen Guild-ID abrufen
    discordClient.guilds.fetch(guildId)
      .then(guild => {
        // Einen Voice-Channel mit dem Namen der Zone in der entsprechenden Discord-Kategorie erstellen
        guild.channels.create({
          name: name || 'Neue Zone',
          type: ChannelType.GuildVoice,
          parent: discordCategoryId,  // Setzt den Voice-Channel in die richtige Kategorie
          reason: `API Zone erstellt: ${apiZoneId}`
        })
        .then(voiceChannel => {
          logger.info(`Discord Voice-Channel erstellt: ${voiceChannel.name} (${voiceChannel.id})`);
          
          // Speichern der Channel-Zuordnung für den Guardian-Service
          setChannelMapping(voiceChannel.id, discordCategoryId!)
            .then(() => {
              logger.info(`Channel-Zuordnung gesetzt: ${voiceChannel.id} -> ${discordCategoryId}`);
            })
            .catch(err => {
              logger.error('Fehler beim Setzen der Channel-Zuordnung:', err);
            });
          
          // Zone in der API mit der Discord Voice-ID aktualisieren
          redisPubSub.publish('zoneUpdated', {
            id: apiZoneId,
            discordVoiceId: voiceChannel.id
          });
          
          logger.info('Zone in API erfolgreich mit Discord Voice-ID aktualisiert');
        })
        .catch(err => {
          logger.error('Fehler beim Erstellen des Discord Voice-Channels:', err);
        });
      })
      .catch(err => {
        logger.error(`Fehler beim Abrufen der Guild mit ID ${guildId}:`, err);
      });
  });
}