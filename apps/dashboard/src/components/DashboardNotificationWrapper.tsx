'use client';
import React, { createContext, useContext } from 'react';
import { useSnackbar } from 'notistack';
import { useCategoryEvents } from '@/hooks/categories/use.category.events';
import { useZoneEvents, ZoneEvent } from '@/hooks/zone/use.zone.events';

// Definiere den Context-Typ
interface NotificationContextType {
  showSuccess: (message: string) => void;
  showWarning: (message: string) => void;
  showError: (message: string) => void;
  showInfo: (message: string) => void;
}

// Erstelle den Context mit Default-Werten
const NotificationContext = createContext<NotificationContextType>({
  showSuccess: () => {},
  showWarning: () => {},
  showError: () => {},
  showInfo: () => {},
});

// Hook zum Verwenden des Notification-Contexts
export const useNotification = () => useContext(NotificationContext);

// Set für verfolgte Event-IDs, um Duplikate zu vermeiden
const processedEvents = new Set<string>();

// Hilfsfunktion zum Verfolgen von Events
const trackEvent = (id: string, eventType: string): boolean => {
  // Eindeutiger Key ohne Timestamp für konsistente Duplikaterkennung
  const key = `${id}-${eventType}`;
  
  if (processedEvents.has(key)) {
    console.log(`[DashboardNotificationWrapper] Event ${key} bereits verarbeitet, überspringe`);
    return false; // Event bereits verarbeitet
  }
  
  console.log(`[DashboardNotificationWrapper] Neues Event ${key} wird verarbeitet`);
  
  // Event als verarbeitet markieren
  processedEvents.add(key);
  
  // Nach 5 Sekunden aus dem Set entfernen (synchronisiert mit Hook-Timeouts)
  setTimeout(() => {
    processedEvents.delete(key);
    console.log(`[DashboardNotificationWrapper] Tracking für ${key} entfernt`);
  }, 5000);
  
  return true; // Neues Event
};

/**
 * Zentraler Wrapper für alle Dashboard-Benachrichtigungen
 * Verwaltet globale Events und stellt eine zentrale API für Benachrichtigungen bereit
 */
const DashboardNotificationWrapper: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { enqueueSnackbar } = useSnackbar();

  // Einfache Helfer-Funktionen für Benachrichtigungen
  const showSuccess = (message: string) => enqueueSnackbar(message, { variant: 'success', autoHideDuration: 5000 });
  const showWarning = (message: string) => enqueueSnackbar(message, { variant: 'warning', autoHideDuration: 8000 });
  const showError = (message: string) => enqueueSnackbar(message, { variant: 'error', autoHideDuration: 8000 });
  const showInfo = (message: string) => enqueueSnackbar(message, { variant: 'info', autoHideDuration: 5000 });

  // Context-Wert mit den Notification-Funktionen
  const contextValue = {
    showSuccess,
    showWarning,
    showError,
    showInfo,
  };

  // Überwache ALLE Kategorie-Events für das Dashboard,
  // aber blocke die Event-Typen, die von Komponenten-spezifischen Hooks behandelt werden
  useCategoryEvents({
    disableDefaultNotifications: true, // Keine Standard-Benachrichtigungen
    onUpdateConfirmed: (event) => {
      // Benachrichtigung NUR, wenn das Event noch nicht verarbeitet wurde
      if (trackEvent(event.id, 'updateConfirmed')) {
        // WICHTIG: Verbesserte Nachricht - "Änderung" statt "Kategorie"
        showSuccess(`Änderung an "${event.name}" wurde erfolgreich in Discord übernommen`);
      }
    },
    onConfirmation: (event) => {
      // Nur in die Konsole loggen, keine Benachrichtigung anzeigen - 
      // setup.category.tsx kümmert sich um die Benachrichtigung
      console.log(`[DashboardNotificationWrapper] Confirmation event received for category "${event.name}"`);
      
      // Das Event trotzdem als verarbeitet markieren, damit andere Komponenten wissen, dass es schon behandelt wurde
      trackEvent(event.id, 'confirmation');
    },
    onRateLimit: (event) => {
      if (trackEvent(event.id, 'rateLimit')) {
        try {
          if (event.details) {
            const details = JSON.parse(event.details);
            const delayMinutes = details.delayMinutes || Math.ceil((details.delayMs || 0) / 60000);
            
            if (delayMinutes > 0) {
              // WICHTIG: Verbesserte Nachricht - "Änderung" statt "Kategorie"
              showWarning(`Discord Rate Limit: Änderung an "${event.name}" wird in ${delayMinutes} Minute(n) durchgeführt`);
            }
          }
        } catch (error) {
          console.error('Fehler beim Parsen der Rate-Limit-Details:', error);
        }
      }
    },
    onError: (event) => {
      if (trackEvent(event.id, 'error') && event.error) {
        showError(`Fehler: ${event.error}`);
      }
    }
  });
  
  // Überwache ALLE Zone-Events für das Dashboard
  useZoneEvents({
    disableDefaultNotifications: true, // Keine Standard-Benachrichtigungen
    onUpdateConfirmed: (event) => {
      // Benachrichtigung NUR, wenn das Event noch nicht verarbeitet wurde
      if (trackEvent(event.id, 'updateConfirmed')) {
        showSuccess(`Zone "${event.name}" wurde erfolgreich in Discord aktualisiert`);
      }
    },
    onRateLimit: (event) => {
      if (trackEvent(event.id, 'rateLimit')) {
        try {
          if (event.details) {
            const details = JSON.parse(event.details);
            const delayMinutes = details.delayMinutes || Math.ceil((details.delayMs || 0) / 60000);
            
            if (delayMinutes > 0) {
              showWarning(`Discord Rate Limit: Zone "${event.name}" wird in ${delayMinutes} Minute(n) aktualisiert`);
            }
          }
        } catch (error) {
          console.error('Fehler beim Parsen der Rate-Limit-Details:', error);
        }
      }
    },
    onError: (event) => {
      // WICHTIG: Standardisierte Nutzung von error und message
      if (trackEvent(event.id, 'error') && (event.error || event.message)) {
        showError(`Fehler: ${event.error || event.message}`);
      }
    }
  });
  
  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
};

export default DashboardNotificationWrapper;