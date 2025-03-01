//apps\bot\src\hooks\categories\use.create.category.ts
import { redisPubSub } from '../../pubsub/redis.pubsub';
import { CategoryEvent } from 'pyro-types';

// Empfange Nachrichten von Redis
export function getCategoryCreatedObservable() {
  return redisPubSub.subscribe(
    'categoryEvent', 
    (message: CategoryEvent) => {
      // Nur 'created' Events verarbeiten
      if (message.eventType !== 'created') {
        return;
      }
      
      console.info('Received categoryEvent (created):', message);

      if (message) {
        const { id, name, guildId, discordCategoryId } = message;
        // Weitere Details könnten im details-Feld als JSON enthalten sein
        let details = {};
        try {
          if (message.details) {
            details = JSON.parse(message.details);
          }
        } catch (e) {
          console.error('Fehler beim Parsen der Details', e);
        }
        console.info('guildId received from Redis event:', guildId);

        // Hier kannst du dann weiter die Verarbeitung durchführen
      }
    }
  );
}