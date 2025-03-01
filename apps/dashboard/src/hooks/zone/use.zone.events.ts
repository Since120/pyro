// apps/dashboard/src/hooks/zone/use.zone.events.ts

import { useEffect, useState, useCallback } from 'react';
import { useSubscription, gql } from '@apollo/client';
import { ZoneEvent as GraphQLZoneEvent } from '@/graphql/generated/graphql';
import { useSnackbar } from 'notistack';

// Erweitere die ZoneEvent Typdefinition mit zusätzlichen Feldern
export interface ZoneEvent extends GraphQLZoneEvent {
  details?: string; // Füge details hinzu
  error?: string;   // Füge error hinzu
}

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
      details
    }
  }
`;

export interface ZoneEventHookOptions {
  onCreated?: (event: ZoneEvent) => void;
  onUpdated?: (event: ZoneEvent) => void;
  onDeleted?: (event: ZoneEvent) => void;
  onConfirmation?: (event: ZoneEvent) => void;
  onError?: (event: ZoneEvent) => void;
  onQueued?: (event: ZoneEvent) => void;
  onUpdateConfirmed?: (event: ZoneEvent) => void;
  onRateLimit?: (event: ZoneEvent) => void;
  onDeleteConfirmed?: (event: ZoneEvent) => void;
  onData?: (event: ZoneEvent) => void; // Neuer allgemeiner Handler für alle Event-Typen
  disableDefaultNotifications?: boolean;
  watchId?: string | null;
}

// Vermeidet Duplikate bei Benachrichtigungen
const processedNotifications = new Set<string>();

/**
 * Zentraler Hook für alle Zone-Events mit optimierter Benachrichtigungsfunktion
 */
export function useZoneEvents({
  onCreated,
  onUpdated,
  onDeleted,
  onConfirmation,
  onError,
  onQueued,
  onUpdateConfirmed,
  onRateLimit,
  onDeleteConfirmed,
  onData,
  disableDefaultNotifications = false,
  watchId = null
}: ZoneEventHookOptions = {}) {
  const { enqueueSnackbar } = useSnackbar();
  const [lastEvent, setLastEvent] = useState<ZoneEvent | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Hilfsfunktion für eindeutige Benachrichtigungen
  const showUniqueNotification = useCallback((id: string, eventType: string, message: string, options: any) => {
    const key = `${id}-${eventType}-${Date.now().toString().substring(0, 8)}`;
    
    if (!processedNotifications.has(key)) {
      processedNotifications.add(key);
      enqueueSnackbar(message, options);
      
      // Nach 5 Sekunden aus dem Set entfernen
      setTimeout(() => {
        processedNotifications.delete(key);
      }, 5000);
    }
  }, [enqueueSnackbar]);

  // Subscription für alle ZoneEvent-Events
  const { data, loading, error } = useSubscription(ZONE_EVENT_SUBSCRIPTION, {
    onData: ({ data }) => {
      if (!isConnected) {
        setIsConnected(true);
      }
      
      if (!data?.data?.zoneEvent) {
        return;
      }
      
      // Casting zu unserem erweiterten ZoneEvent Typ
      const eventData = data.data.zoneEvent as ZoneEvent;
      setLastEvent(eventData);
      
      // Allgemeiner Handler für alle Events
      if (onData) {
        onData(eventData);
      }
      
      // Ignoriere Events, wenn sie nicht für die beobachtete ID sind (falls angegeben)
      if (watchId && eventData.id !== watchId) {
        return;
      }
      
      console.log(`[ZoneEvent] Received event: ${eventData.eventType} for ${eventData.name || eventData.id}`);
      
      try {
        // Verarbeitung je nach Event-Typ mit Fehlerbehandlung
        switch (eventData.eventType) {
          case 'created':
            if (onCreated) onCreated(eventData);
            if (!disableDefaultNotifications) {
              showUniqueNotification(
                eventData.id,
                'created',
                `Zone "${eventData.name}" wurde erfolgreich erstellt`,
                { variant: 'success', autoHideDuration: 5000 }
              );
            }
            break;
            
          case 'updated':
            if (onUpdated) onUpdated(eventData);
            break;
            
          case 'deleted':
            if (onDeleted) onDeleted(eventData);
            break;
            
          case 'confirmation':
            if (onConfirmation) onConfirmation(eventData);
            if (!disableDefaultNotifications) {
              showUniqueNotification(
                eventData.id,
                'confirmation',
                `Zone "${eventData.name}" wurde in Discord erfolgreich erstellt`,
                { variant: 'success', autoHideDuration: 5000 }
              );
            }
            break;
            
          case 'error':
            if (onError) onError(eventData);
            if (!disableDefaultNotifications && eventData.message) {
              showUniqueNotification(
                eventData.id,
                'error',
                `Fehler: ${eventData.message}`,
                { variant: 'error', autoHideDuration: 8000 }
              );
            }
            break;
            
          case 'queued':
            if (onQueued) onQueued(eventData);
            break;
            
          case 'updateConfirmed':
            if (onUpdateConfirmed) onUpdateConfirmed(eventData);
            if (!disableDefaultNotifications) {
              showUniqueNotification(
                eventData.id,
                'updateConfirmed',
                `Zone "${eventData.name}" wurde erfolgreich in Discord aktualisiert`,
                { variant: 'success', autoHideDuration: 5000 }
              );
            }
            break;
            
          case 'deleteConfirmed':
            if (onDeleteConfirmed) onDeleteConfirmed(eventData);
            if (!disableDefaultNotifications) {
              showUniqueNotification(
                eventData.id,
                'deleteConfirmed',
                `Zone wurde erfolgreich aus Discord entfernt`,
                { variant: 'success', autoHideDuration: 5000 }
              );
            }
            break;
            
          case 'rateLimit':
            if (onRateLimit) onRateLimit(eventData);
            
            if (!disableDefaultNotifications) {
              // Rate-Limit-Benachrichtigung formatieren
              try {
                if (eventData.details) {
                  const details = JSON.parse(eventData.details);
                  const delayMinutes = details.delayMinutes || Math.ceil((details.delayMs || 0) / 60000);
                  
                  if (delayMinutes > 0) {
                    const message = `Discord Rate Limit: Zone "${eventData.name}" wird in ${delayMinutes} Minute(n) aktualisiert`;
                    
                    showUniqueNotification(
                      eventData.id,
                      'rateLimit',
                      message,
                      { variant: 'warning', autoHideDuration: 10000 }
                    );
                  }
                } else if (eventData.message) {
                  showUniqueNotification(
                    eventData.id,
                    'rateLimit',
                    eventData.message,
                    { variant: 'warning', autoHideDuration: 8000 }
                  );
                } else {
                  showUniqueNotification(
                    eventData.id,
                    'rateLimit',
                    `Discord Rate Limit erreicht für Zone "${eventData.name}"`,
                    { variant: 'warning', autoHideDuration: 8000 }
                  );
                }
              } catch (error) {
                console.error('Error parsing rate limit details:', error);
                showUniqueNotification(
                  eventData.id,
                  'rateLimit',
                  `Discord Rate Limit erreicht für Zone "${eventData.name}"`,
                  { variant: 'warning', autoHideDuration: 8000 }
                );
              }
            }
            break;
            
          default:
            console.log(`Unhandled event type: ${eventData.eventType}`);
        }
      } catch (error) {
        console.error('Error handling zone event:', error);
      }
    }
  });

  return {
    lastEvent,
    loading,
    error,
    isConnected
  };
}