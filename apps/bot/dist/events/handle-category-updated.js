"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleCategoryUpdated = handleCategoryUpdated;
const redis_pubsub_1 = require("../pubsub/redis.pubsub");
const pyro_logger_1 = __importDefault(require("pyro-logger"));
function handleCategoryUpdated(discordClient) {
    // Bessere Logging beim Start
    pyro_logger_1.default.info('🔄 Initialisiere Category-Update Handler');
    const subscription = redis_pubsub_1.redisPubSub.subscribe('categoryEvent', async (payload) => {
        // Nur Events vom Typ 'updated' verarbeiten
        if (payload.eventType !== 'updated') {
            return;
        }
        pyro_logger_1.default.info('Received categoryEvent (updated):', payload);
        try {
            // 1. Validierung der kritischen Felder
            if (!payload.discordCategoryId || !payload.guildId || !payload.name) {
                pyro_logger_1.default.warn('⚠️ Unvollständiges Update-Event:', {
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
                pyro_logger_1.default.error('❌ Kategorie nicht gefunden:', payload.discordCategoryId);
                await redis_pubsub_1.redisPubSub.publish('categoryUpdateError', {
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
            }
            catch (e) {
                pyro_logger_1.default.error('Fehler beim Parsen der Details', e);
            }
            if (category.name === payload.name && !isDeletedInDiscord) {
                pyro_logger_1.default.info('✅ Keine Namensänderung erforderlich');
                // Trotzdem eine Bestätigung senden, dass alles ok ist
                await redis_pubsub_1.redisPubSub.publish('categoryUpdateConfirmed', {
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
            pyro_logger_1.default.info(`✅ Kategorie ${payload.discordCategoryId} aktualisiert: "${payload.name}"`);
            // 5. Erfolgsbestätigung senden
            await redis_pubsub_1.redisPubSub.publish('categoryUpdateConfirmed', {
                apiCategoryId: payload.id,
                discordCategoryId: payload.discordCategoryId,
                guildId: payload.guildId,
                name: payload.name,
                timestamp: new Date().toISOString()
            });
            // 6. Bei Löschung in Discord
            if (isDeletedInDiscord) {
                await category.delete(`Löschung angefordert für Kategorie ${payload.id}`);
                pyro_logger_1.default.warn(`🗑️ Kategorie ${payload.discordCategoryId} gelöscht`);
            }
        }
        catch (error) {
            pyro_logger_1.default.error('❌ Update fehlgeschlagen:', error);
            await redis_pubsub_1.redisPubSub.publish('categoryUpdateError', {
                apiCategoryId: payload.id,
                error: error.message,
                originalPayload: payload,
                timestamp: new Date().toISOString()
            });
        }
    });
}
