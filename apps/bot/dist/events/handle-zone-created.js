"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleZoneCreated = handleZoneCreated;
// apps/bot/src/events/handle-zone-created.ts
const discord_js_1 = require("discord.js");
const redis_pubsub_1 = require("../pubsub/redis.pubsub");
const pyro_logger_1 = __importDefault(require("pyro-logger"));
const channelMapping_1 = require("../utils/channelMapping");
function handleZoneCreated(discordClient) {
    redis_pubsub_1.redisPubSub.subscribe('zoneEvent', (message) => {
        // Nur Events vom Typ 'created' verarbeiten
        if (message.eventType !== 'created') {
            return;
        }
        pyro_logger_1.default.info('Received zoneEvent (created):', message);
        const { id: apiZoneId, name, categoryId, discordVoiceId } = message;
        if (!categoryId) {
            pyro_logger_1.default.error('Keine Kategorie-ID in der Zone gefunden');
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
            pyro_logger_1.default.error('Keine Discord-Kategorie-ID gefunden');
            return;
        }
        // Guild-ID aus der Umgebungsvariable verwenden
        const guildId = process.env.GUILD_ID;
        if (!guildId) {
            pyro_logger_1.default.error('GuildId fehlt in der Nachricht und auch in der Umgebungsvariable GUILD_ID');
            return;
        }
        pyro_logger_1.default.info(`Verwende Guild-ID: ${guildId} für Zone "${name}"`);
        // Discord-Guild anhand der übergebenen Guild-ID abrufen
        discordClient.guilds.fetch(guildId)
            .then(guild => {
            // Einen Voice-Channel mit dem Namen der Zone in der entsprechenden Discord-Kategorie erstellen
            guild.channels.create({
                name: name || 'Neue Zone',
                type: discord_js_1.ChannelType.GuildVoice,
                parent: discordCategoryId, // Setzt den Voice-Channel in die richtige Kategorie
                reason: `API Zone erstellt: ${apiZoneId}`
            })
                .then(voiceChannel => {
                pyro_logger_1.default.info(`Discord Voice-Channel erstellt: ${voiceChannel.name} (${voiceChannel.id})`);
                // Speichern der Channel-Zuordnung für den Guardian-Service
                (0, channelMapping_1.setChannelMapping)(voiceChannel.id, discordCategoryId)
                    .then(() => {
                    pyro_logger_1.default.info(`Channel-Zuordnung gesetzt: ${voiceChannel.id} -> ${discordCategoryId}`);
                })
                    .catch(err => {
                    pyro_logger_1.default.error('Fehler beim Setzen der Channel-Zuordnung:', err);
                });
                // Zone in der API mit der Discord Voice-ID aktualisieren
                redis_pubsub_1.redisPubSub.publish('zoneUpdated', {
                    id: apiZoneId,
                    discordVoiceId: voiceChannel.id
                });
                pyro_logger_1.default.info('Zone in API erfolgreich mit Discord Voice-ID aktualisiert');
            })
                .catch(err => {
                pyro_logger_1.default.error('Fehler beim Erstellen des Discord Voice-Channels:', err);
            });
        })
            .catch(err => {
            pyro_logger_1.default.error(`Fehler beim Abrufen der Guild mit ID ${guildId}:`, err);
        });
    });
}
