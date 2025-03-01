// apps/bot/src/utils/channelMapping.ts
import { redisPubSub } from '../pubsub/redis.pubsub';
import { ApolloClient, InMemoryCache, HttpLink, gql } from '@apollo/client/core';
import fetch from 'cross-fetch';
import logger from 'pyro-logger';

// Create a dedicated Apollo client for API queries
const apiClient = new ApolloClient({
  link: new HttpLink({
    uri: process.env.API_URL + '/graphql',
    fetch,
  }),
  cache: new InMemoryCache(),
});

// GraphQL query to get all zones
const GET_ZONES = gql`
  query GetZones {
    zones {
      discordVoiceId
      category {
        discordCategoryId
      }
    }
  }
`;

/**
 * Rebuilds the channel mapping from the API data
 * This ensures that the bot knows which voice channel belongs to which category
 */
export async function rebuildChannelMapping(): Promise<void> {
  try {
    const result = await apiClient.query({ query: GET_ZONES });
    const zones = result.data?.zones;
    
    if (zones && zones.length > 0) {
      let mappingCount = 0;
      
      for (const zone of zones) {
        if (zone.discordVoiceId && zone.category && zone.category.discordCategoryId) {
          // Store the mapping in Redis
          await setChannelMapping(zone.discordVoiceId, zone.category.discordCategoryId);
          mappingCount++;
        }
      }
      
      logger.info(`Channel mapping rebuilt successfully. Mapped ${mappingCount} channels.`);
    } else {
      logger.warn('No zones found, channel mapping not rebuilt.');
    }
  } catch (error) {
    logger.error('Error rebuilding channel mapping:', error);
  }
}

/**
 * Gets the channel mapping from Redis
 * @param discordVoiceId Discord voice channel ID
 * @returns Discord category ID or null if not found
 */
export async function getChannelMapping(discordVoiceId: string): Promise<string | null> {
  return redisPubSub.redisSubscriber.get(`voiceChannel:${discordVoiceId}`);
}

/**
 * Sets the channel mapping in Redis
 * @param discordVoiceId Discord voice channel ID
 * @param discordCategoryId Discord category ID
 */
export async function setChannelMapping(discordVoiceId: string, discordCategoryId: string): Promise<void> {
  // Set the mapping in Redis
  await redisPubSub.redisPublisher.set(`voiceChannel:${discordVoiceId}`, discordCategoryId);
  
  // Publish an event to notify other services
  await redisPubSub.publish('categoryUpdateEvent', {
    discordVoiceId,
    discordCategoryId,
  });
  
  logger.debug(`Channel mapping set: ${discordVoiceId} -> ${discordCategoryId}`);
}