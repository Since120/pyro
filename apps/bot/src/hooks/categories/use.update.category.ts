//apps\bot\src\hooks\categories\use.update.category.ts
import { redisPubSub } from '../../pubsub/redis.pubsub'; // Redis Pub/Sub Mechanismus importieren
import logger from 'pyro-logger';
import { CategoryEvent } from 'pyro-types'; // Import für den neuen API-Typ

// Empfange Nachrichten von Redis für CategoryUpdate
export function getCategoryUpdateObservable() {
  return redisPubSub.subscribe('categoryEvent', (message: CategoryEvent) => {
    // Nur bei Update-Events weiterverarbeiten
    if (message.eventType !== 'updated') {
      return;
    }

    logger.info('Received categoryEvent (updated) from Redis:', message);

    const { id, name, guildId, discordCategoryId } = message;
    
    // Logik für das Verarbeiten des Updates
    if (name) {
      // Verarbeite das Update
      logger.info(`Category updated: ${name}`);
    } else {
      // Interpretiere das als Lösch-Ereignis
      logger.info('Category event ohne Name – interpretiere das als Löschen der Kategorie');
    }
  });
}

// Empfange Nachrichten von Redis für CategoryDelete
export function getCategoryDeleteObservable() {
  return redisPubSub.subscribe('categoryEvent', (message: CategoryEvent) => {
    // Nur bei Delete-Events weiterverarbeiten
    if (message.eventType !== 'deleted') {
      return;
    }

    logger.info('Received categoryEvent (deleted) from Redis:', message);

    const { id, discordCategoryId, guildId } = message;
    
    // Logik für das Löschen der Kategorie
    logger.info(`Category deleted: ${discordCategoryId}`);
  });
}
