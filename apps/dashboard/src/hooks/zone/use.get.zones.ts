// apps/dashboard/src/hooks/zone/use.get.zones.ts
import React from 'react';
import { useQuery, useSubscription, gql } from '@apollo/client';
import { GetZonesDocument, ZoneEvent } from '../../graphql/generated/graphql';

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

export const useZones = () => {
  const { loading, error, data, refetch } = useQuery(GetZonesDocument);
  
  // Subscription für alle Zone-Events
  useSubscription(ZONE_EVENT_SUBSCRIPTION, {
    onData: ({ data }) => {
      if (!data?.data) return;
      
      const eventData = data.data.zoneEvent as ZoneEvent;
      console.log(`Zone event: ${eventData.eventType}`, eventData);
      
      // Bei jeder Änderung an Zonen aktualisieren wir die Daten
      refetch();
    }
  });

  return {
    loading,
    error,
    data,
    refetch
  };
};