// Datei: apps/dashboard/src/hooks/categories/use.category.events.ts

import { useEffect, useState, useCallback } from 'react';
import { useSubscription, gql } from '@apollo/client';
import { CategoryEvent } from '@/graphql/generated/graphql';
import { useSnackbar } from 'notistack';

const CATEGORY_EVENT_SUBSCRIPTION = gql`
  subscription CategoryEvent {
    categoryEvent {
      id
      guildId
      name
      discordCategoryId
      timestamp
      eventType
      error
      details
    }
  }
`;

export interface CategoryEventHookOptions {
  onCreated?: (event: CategoryEvent) => void;
  onUpdated?: (event: CategoryEvent) => void;
  onDeleted?: (event: CategoryEvent) => void;
  onConfirmation?: (event: CategoryEvent) => void;
  onError?: (event: CategoryEvent) => void;
  onQueued?: (event: CategoryEvent) => void;
  onUpdateConfirmed?: (event: CategoryEvent) => void;
  onRateLimit?: (event: CategoryEvent) => void;
  onDeleteConfirmed?: (event: CategoryEvent) => void;
  onData?: (event: CategoryEvent) => void; // Neuer allgemeiner Handler für alle Event-Typen
  disableDefaultNotifications?: boolean; // Parameter, um standardmäßige Snackbars zu deaktivieren
  watchId?: string | null;
}

// Vermeidet Duplikate bei Benachrichtigungen
const processedNotifications = new Set<string>();

/**
 * Zentraler Hook für alle Kategorie-Events mit optimierter Benachrichtigungsfunktion
 */
export function useCategoryEvents({
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
  disableDefaultNotifications = false, // Standardmäßig Benachrichtigungen aktivieren
  watchId = null
}: CategoryEventHookOptions = {}) {
  const { enqueueSnackbar } = useSnackbar();
  const [lastEvent, setLastEvent] = useState<CategoryEvent | null>(null);
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

  // Subscription für alle CategoryEvent-Events
  const { data, loading, error } = useSubscription(CATEGORY_EVENT_SUBSCRIPTION, {
    onData: ({ data }) => {
      if (!isConnected) {
        setIsConnected(true);
      }
      
      if (!data?.data?.categoryEvent) {
        return;
      }
      
      const eventData = data.data.categoryEvent as CategoryEvent;
      setLastEvent(eventData);
      
      // Allgemeiner Handler für alle Events
      if (onData) {
        onData(eventData);
      }
      
      // Ignoriere Events, wenn sie nicht für die beobachtete ID sind (falls angegeben)
      if (watchId && eventData.id !== watchId) {
        return;
      }
      
      console.log(`[CategoryEvent] Received event: ${eventData.eventType} for ${eventData.name || eventData.id}`);
      
      try {
        // Verarbeitung je nach Event-Typ mit Fehlerbehandlung
        switch (eventData.eventType) {
          case 'created':
            if (onCreated) onCreated(eventData);
            if (!disableDefaultNotifications) {
              showUniqueNotification(
                eventData.id,
                'created',
                `Kategorie "${eventData.name}" wurde erfolgreich erstellt`,
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
                `Kategorie "${eventData.name}" wurde in Discord erfolgreich erstellt`,
                { variant: 'success', autoHideDuration: 5000 }
              );
            }
            break;
            
          case 'error':
            if (onError) onError(eventData);
            if (!disableDefaultNotifications && eventData.error) {
              showUniqueNotification(
                eventData.id,
                'error',
                `Fehler: ${eventData.error}`,
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
                `Kategorie "${eventData.name}" wurde erfolgreich in Discord aktualisiert`,
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
                `Kategorie wurde erfolgreich aus Discord entfernt`,
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
                    const message = `Discord Rate Limit: Kategorie "${eventData.name}" wird in ${delayMinutes} Minute(n) aktualisiert`;
                    
                    showUniqueNotification(
                      eventData.id,
                      'rateLimit',
                      message,
                      { variant: 'warning', autoHideDuration: 10000 }
                    );
                  }
                } else if (eventData.error) {
                  showUniqueNotification(
                    eventData.id,
                    'rateLimit',
                    eventData.error,
                    { variant: 'warning', autoHideDuration: 8000 }
                  );
                } else {
                  showUniqueNotification(
                    eventData.id,
                    'rateLimit',
                    `Discord Rate Limit erreicht für Kategorie "${eventData.name}"`,
                    { variant: 'warning', autoHideDuration: 8000 }
                  );
                }
              } catch (error) {
                console.error('Error parsing rate limit details:', error);
                showUniqueNotification(
                  eventData.id,
                  'rateLimit',
                  `Discord Rate Limit erreicht für Kategorie "${eventData.name}"`,
                  { variant: 'warning', autoHideDuration: 8000 }
                );
              }
            }
            break;
            
          default:
            console.log(`Unhandled event type: ${eventData.eventType}`);
        }
      } catch (error) {
        console.error('Error handling category event:', error);
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