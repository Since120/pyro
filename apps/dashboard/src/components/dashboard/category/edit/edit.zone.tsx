'use client';

import React, { useState } from 'react';
import { Box, Modal, Button, Typography, Fade, TextField, MenuItem, CircularProgress, Alert } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useSnackbar } from 'notistack';
import { useUpdateZone } from '@/hooks/zone/use.update.zones';
import { useResettableState } from '@/hooks/use.resettable.state';
import { useAsyncHandler } from '@/hooks/use.async.handler';
import { useZoneEvents } from '@/hooks/zone/use.zone.events';

export interface EditZoneData {
  category: string;
  zoneKey: string;
  zoneName: string;
  minutesRequired: number;
  pointsGranted: number;
}

export interface CategoryOption {
  id: string;
  name: string;
}

export interface EditZoneInitialData {
  id: string;
  category?: { id: string; name: string };
  categoryId?: string;
  zoneKey: string;
  zoneName?: string;
  name?: string;
  minutesRequired: number;
  pointsGranted: number;
}

interface EditZoneProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: EditZoneData) => void;
  onDelete: () => void;
  categories: CategoryOption[];
  initialData?: EditZoneInitialData;
}

const modalStyle = {
  position: 'absolute' as const,
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: { xs: '90%', sm: 400 },
  maxWidth: '95%',
  bgcolor: 'background.paper',
  borderRadius: '8px',
  boxShadow: 24,
  p: { xs: 2, sm: 3 },
};

const EditZone: React.FC<EditZoneProps> = ({ open, onClose, onSave, onDelete, categories, initialData }) => {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();

  // Zustandsverwaltung via useResettableState
  const [category, setCategory] = useResettableState(
    (initialData?.category?.id || initialData?.categoryId) || '',
    [initialData, open]
  );
  const [zoneKey, setZoneKey] = useResettableState(initialData?.zoneKey || '', [initialData, open]);
  const [zoneName, setZoneName] = useResettableState(initialData?.zoneName || initialData?.name || '', [initialData, open]);
  const [minutesRequired, setMinutesRequired] = useResettableState(initialData?.minutesRequired || 0, [initialData, open]);
  const [pointsGranted, setPointsGranted] = useResettableState(initialData?.pointsGranted || 0, [initialData, open]);

  // Zustände für das Rate-Limit und Operationsstatus
  const [pendingZoneId, setPendingZoneId] = useState<string | null>(null);
  const [isQueuedOperation, setIsQueuedOperation] = useState(false);
  const [queueStatusMessage, setQueueStatusMessage] = useState<string | null>(null);
  const [shouldCloseModal, setShouldCloseModal] = useState(false);

  // Hook für Zone-Events
  useZoneEvents({
    watchId: pendingZoneId,
    disableDefaultNotifications: true,
    onQueued: (event) => {
      setIsQueuedOperation(true);
      
      if (event.details) {
        try {
          const details = JSON.parse(event.details);
          if (details.estimatedDelay) {
            const delayMinutes = Math.ceil(details.estimatedDelay / 60000);
            if (delayMinutes > 0) {
              setQueueStatusMessage(`Änderung wurde in die Warteschlange eingereiht. Geschätzte Wartezeit: ${delayMinutes} Minute(n).`);
              enqueueSnackbar(`Zone "${zoneName}" wird in ${delayMinutes} Minute(n) aktualisiert`, { 
                variant: 'warning',
                autoHideDuration: 8000
              });
            }
          }
        } catch (error) {
          console.error('Fehler beim Parsen der Queue-Details:', error);
        }
      }
      
      setTimeout(() => {
        setShouldCloseModal(true);
      }, 1500);
    },
    onRateLimit: (event) => {
      setIsQueuedOperation(true);
      
      if (event.details) {
        try {
          const details = JSON.parse(event.details);
          const delayMinutes = details.delayMinutes || Math.ceil((details.delayMs || 0) / 60000);
          if (delayMinutes > 0) {
            setQueueStatusMessage(`Discord Rate Limit erreicht. Die Änderung wird in ${delayMinutes} Minute(n) durchgeführt.`);
            enqueueSnackbar(`Zone "${zoneName}" wird in ${delayMinutes} Minute(n) aktualisiert (Discord Rate Limit)`, { 
              variant: 'warning',
              autoHideDuration: 10000
            });
          }
        } catch (error) {
          console.error('Fehler beim Parsen der Rate-Limit-Details:', error);
        }
      }
      
      setShouldCloseModal(true);
    },
    onUpdateConfirmed: (event) => {
      enqueueSnackbar(`Zone "${event.name}" wurde erfolgreich aktualisiert`, { 
        variant: 'success',
        autoHideDuration: 5000
      });
      setPendingZoneId(null);
      setIsQueuedOperation(false);
    },
    onError: (event) => {
      enqueueSnackbar(`Fehler: ${event.message || 'Unbekannter Fehler'}`, { 
        variant: 'error',
        autoHideDuration: 8000
      });
      setPendingZoneId(null);
      setIsQueuedOperation(false);
    }
  });

  // Effekt zum Schließen des Modals
  React.useEffect(() => {
    if (shouldCloseModal) {
      onClose();
    }
  }, [shouldCloseModal, onClose]);

  const { updateZone, deleteZone } = useUpdateZone();

  const isValid = () =>
    category.trim() !== '' &&
    zoneKey.trim() !== '' &&
    zoneName.trim() !== '' &&
    minutesRequired > 0 &&
    pointsGranted > 0;

  const updateZoneAction = async () => {
    if (!initialData?.id) {
      throw new Error('Zone-ID fehlt');
    }
    const result = await updateZone({
      variables: {
        id: initialData.id,
        input: {
          zoneKey,
          name: zoneName,
          minutesRequired,
          pointsGranted,
          categoryId: category,
        },
      },
    });
    return result.data?.updateZone;
  };

  // Zentrale Update-Logik über useAsyncHandler
  const { loading, execute: handleSave } = useAsyncHandler(updateZoneAction, 'Fehler beim Aktualisieren der Zone!', {
    onSuccess: (result) => {
      if (result) {
        // Zone-ID für Event-Tracking setzen
        setPendingZoneId(result.id);
        setIsQueuedOperation(true);
        
        // Callback ausführen
        onSave({ category, zoneKey, zoneName, minutesRequired, pointsGranted });
      }
    },
    // Wir schließen das Modal nur, wenn kein rateLimit/queued Event entsteht
  });

  const handleDelete = async () => {
    if (initialData?.id) {
      try {
        const result = await deleteZone({ variables: { id: initialData.id } });
        
        if (result.data?.deleteZone) {
          enqueueSnackbar('Zone gelöscht!', { variant: 'success' });
          onDelete();
          onClose();
        }
      } catch (error: any) {
        console.error('Fehler beim Löschen der Zone:', error);
        enqueueSnackbar('Fehler beim Löschen der Zone!', { variant: 'error' });
      }
    } else {
      console.warn('Keine initialData oder ID vorhanden');
    }
  };

  return (
    <Modal open={open} onClose={isQueuedOperation ? undefined : onClose}>
      <Fade in={open} timeout={500}>
        <Box sx={modalStyle}>
          <Typography variant="h6" gutterBottom>
            Zone bearbeiten
          </Typography>
          
          {/* Queue-Status anzeigen */}
          {isQueuedOperation && queueStatusMessage && (
            <Alert severity="info" sx={{ mb: 2 }}>
              {queueStatusMessage}
            </Alert>
          )}
          
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Dropdown zum Auswählen der Kategorie */}
            <TextField
              select
              label="Kategorie auswählen"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              fullWidth
              disabled={isQueuedOperation}
            >
              {categories.map((cat) => (
                <MenuItem key={cat.id} value={cat.id}>
                  {cat.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField 
              label="Zone-Schlüssel" 
              value={zoneKey} 
              onChange={(e) => setZoneKey(e.target.value)} 
              fullWidth
              disabled={isQueuedOperation}
            />
            <TextField 
              label="Zone-Name" 
              value={zoneName} 
              onChange={(e) => setZoneName(e.target.value)} 
              fullWidth
              disabled={isQueuedOperation}
            />
            <TextField
              label="Benötigte Zeit (Minuten) für Zielpunkte"
              type="number"
              value={minutesRequired}
              onChange={(e) => setMinutesRequired(Number(e.target.value))}
              fullWidth
              disabled={isQueuedOperation}
            />
            <TextField
              label="Punkte pro Minute"
              type="number"
              value={pointsGranted}
              onChange={(e) => setPointsGranted(Number(e.target.value))}
              fullWidth
              disabled={isQueuedOperation}
            />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
              <Button 
                variant="outlined" 
                color="error" 
                onClick={handleDelete}
                disabled={isQueuedOperation}
              >
                Löschen
              </Button>
              {loading || isQueuedOperation ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircularProgress size={24} />
                  <Typography variant="body1">
                    {isQueuedOperation ? 'Wird verarbeitet...' : 'Speichern...'}
                  </Typography>
                </Box>
              ) : (
                <Button variant="contained" onClick={handleSave} disabled={!isValid()}>
                  Speichern
                </Button>
              )}
            </Box>
          </Box>
        </Box>
      </Fade>
    </Modal>
  );
};

export default EditZone;