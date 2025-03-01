// apps/dashboard/src/hooks/zone/use.create.zones.ts
import { useMutation, useSubscription, gql } from '@apollo/client';
import { useState } from 'react';
import {
  CreateZoneDocument,
  CreateZoneMutation,
  CreateZoneMutationVariables,
  Zone,
  ZoneEvent,
} from '../../graphql/generated/graphql';

// GraphQL-Subscription für ZoneEvent
const ZONE_EVENT_SUBSCRIPTION = gql`
  subscription ZoneEvent {
    zoneEvent {
      id
      categoryId
      name
      discordVoiceId
      timestamp
      eventType
      message
    }
  }
`;

export const useCreateZone = (onZoneCreated?: (data: Zone) => void) => {
  const [subscribedZone, setSubscribedZone] = useState<Zone | null>(null);

  const [createZone, mutationResult] = useMutation<CreateZoneMutation, CreateZoneMutationVariables>(
    CreateZoneDocument
  );

  // Subscription für alle Zone-Events
  useSubscription(ZONE_EVENT_SUBSCRIPTION, {
    onData: ({ data, client }) => {
      if (!data?.data) return;
      
      const eventData = data.data.zoneEvent as ZoneEvent;
      
      // Wir reagieren nur auf das 'created' Event
      if (eventData.eventType === 'created') {
        console.log('Zone created event received:', eventData);
        
        // Da wir nicht die vollständigen Zone-Daten haben, machen wir einen refetch
        client.query({
          query: gql`
            query GetZone($id: ID!) {
              zone(id: $id) {
                id
                zoneKey
                name
                minutesRequired
                pointsGranted
                lastUsageAt
                totalSecondsInZone
                isDeletedInDiscord
                categoryId
                discordVoiceId
                createdAt
                updatedAt
                category {
                  id
                  name
                  discordCategoryId
                }
              }
            }
          `,
          variables: { id: eventData.id },
          fetchPolicy: 'network-only'
        }).then(response => {
          if (response.data?.zone) {
            const newZone = response.data.zone as Zone;
            setSubscribedZone(newZone);
            
            // Aktualisieren des Apollo-Caches
            client.cache.modify({
              fields: {
                zones(existingZonesRefs = [], { readField, toReference }) {
                  if (existingZonesRefs.some((ref: any) => readField('id', ref) === newZone.id)) {
                    return existingZonesRefs;
                  }
                  return [...existingZonesRefs, toReference(newZone)];
                },
              },
            });
            
            if (onZoneCreated) {
              onZoneCreated(newZone);
            }
          }
        });
      }
    },
  });

  return {
    createZone,
    subscribedZone,
    loading: mutationResult.loading,
    error: mutationResult.error,
  };
};