// apps/dashboard/src/hooks/categories/use.category.events.ts

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
  onData?: (event: CategoryEvent) => void; // Allgemeiner Handler für alle Event-Typen
  disableDefaultNotifications?: boolean; // Standardbenachrichtigungen deaktivieren
  watchId?: string | null; // Spezifische Kategorie-ID überwachen
}

// Globales Set für bereits verarbeitete Benachrichtigungen
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
  disableDefaultNotifications = false,
  watchId = null
}: CategoryEventHookOptions = {}) {
  const { enqueueSnackbar } = useSnackbar();
  const [lastEvent, setLastEvent] = useState<CategoryEvent | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Hilfsfunktion für eindeutige Benachrichtigungen (VERBESSERT)
  const showUniqueNotification = useCallback((id: string, eventType: string, message: string, options: any) => {
    // WICHTIG: Einfacher Key ohne Timestamp für konsistente Duplikaterkennung
    const key = `${id}-${eventType}`;
    
    if (!processedNotifications.has(key)) {
      console.log(`[CategoryEvent] Zeige Benachrichtigung für ${key}: "${message}"`);
      processedNotifications.add(key);
      enqueueSnackbar(message, options);
      
      // Nach 5 Sekunden aus dem Set entfernen
      setTimeout(() => {
        processedNotifications.delete(key);
        console.log(`[CategoryEvent] Benachrichtigungssperre für ${key} entfernt`);
      }, 5000);
    } else {
      console.log(`[CategoryEvent] Doppelte Benachrichtigung unterdrückt für ${key}: "${message}"`);
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
      
      console.log(`[CategoryEvent] Event empfangen: ${eventData.eventType} für ${eventData.name || eventData.id}`);
      
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
                // WICHTIG: Verbesserte Nachricht - "Änderung" statt "Kategorie"
                `Änderung an "${eventData.name}" wurde erfolgreich in Discord übernommen`,
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
                    // WICHTIG: Verbesserte Nachricht - "Änderung" statt "Kategorie"
                    const message = `Discord Rate Limit: Änderung an "${eventData.name}" wird in ${delayMinutes} Minute(n) durchgeführt`;
                    
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
                  // WICHTIG: Verbesserte Nachricht - "Änderung" statt "Kategorie"
                  showUniqueNotification(
                    eventData.id,
                    'rateLimit',
                    `Discord Rate Limit erreicht für Änderung an "${eventData.name}"`,
                    { variant: 'warning', autoHideDuration: 8000 }
                  );
                }
              } catch (error) {
                console.error('Fehler beim Parsen der Rate-Limit-Details:', error);
                showUniqueNotification(
                  eventData.id,
                  'rateLimit',
                  // WICHTIG: Verbesserte Nachricht - "Änderung" statt "Kategorie"
                  `Discord Rate Limit erreicht für Änderung an "${eventData.name}"`,
                  { variant: 'warning', autoHideDuration: 8000 }
                );
              }
            }
            break;
            
          default:
            console.log(`Unbehandelter Event-Typ: ${eventData.eventType}`);
        }
      } catch (error) {
        console.error('Fehler bei der Verarbeitung des Kategorie-Events:', error);
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