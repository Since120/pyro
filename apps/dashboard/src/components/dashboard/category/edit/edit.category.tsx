// Bereinigte und optimierte Version von edit.category.tsx

import React, { useState, useEffect } from 'react';
import {
  Box,
  Modal,
  Button,
  Typography,
  ButtonGroup,
  FormControlLabel,
  Switch,
  Fade,
  CircularProgress,
  Alert,
} from '@mui/material';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import PickerTextField from '../../../core/picker.text.field';
import DiscordRoleSelect from '../../../core/discord.role.select';
import { useSnackbar } from 'notistack';
import { EditCategoryData } from '../types';
import { useUpdateCategory } from '@/hooks/categories/use.update.categories';
import { useResettableState } from '@/hooks/use.resettable.state';
import { useAsyncHandler } from '@/hooks/use.async.handler';
import { useCategoryEvents } from '@/hooks/categories/use.category.events';

const style = {
  position: 'absolute' as 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: { xs: '90%', sm: 600 },
  maxWidth: '95%',
  bgcolor: 'background.paper',
  borderRadius: '8px',
  boxShadow: 24,
  p: { xs: 2, sm: 4 },
};

interface EditCategoryModalProps {
  open: boolean;
  onClose: () => void;
  onSave?: (data: EditCategoryData) => void;
  onDelete?: () => void;
  initialData?: EditCategoryData & { id: string };
}

const EditCategoryModal: React.FC<EditCategoryModalProps> = ({ open, onClose, onSave, onDelete, initialData }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { enqueueSnackbar } = useSnackbar();

  // Zustandsverwaltung via useResettableState
  const [selectedLevel, setSelectedLevel] = useResettableState(initialData?.selectedLevel || '', [initialData, open]);
  const [categoryName, setCategoryName] = useResettableState(initialData?.categoryName || '', [initialData, open]);
  const [role, setRole] = useResettableState<string[]>(initialData?.role || [], [initialData, open]);
  const [tracking, setTracking] = useResettableState(initialData?.tracking || false, [initialData, open]);
  const [visible, setVisible] = useResettableState(initialData?.visible || false, [initialData, open]);
  const [sendSetup, setSendSetup] = useResettableState(initialData?.sendSetup || false, [initialData, open]);

  // Zustand für Queue- und Event-Tracking
  const [pendingCategoryId, setPendingCategoryId] = useState<string | null>(null);
  const [isQueuedOperation, setIsQueuedOperation] = useState(false);
  const [queueStatusMessage, setQueueStatusMessage] = useState<string | null>(null);
  const [shouldCloseModal, setShouldCloseModal] = useState(false);

  // Kategoriebearbeitung mit Event-Tracking
  useEffect(() => {
    if (shouldCloseModal) {
      onClose();
    }
  }, [shouldCloseModal, onClose]);

  const isValid = () =>
    selectedLevel.trim() !== '' && categoryName.trim() !== '' && role.length > 0;

  const { updateCategory, deleteCategory } = useUpdateCategory();

  // Event-Überwachung für lokale UI-Updates
  useCategoryEvents({
    watchId: pendingCategoryId,
    disableDefaultNotifications: true, // Keine eigenen Benachrichtigungen hier!
    onQueued: (event) => {
      setIsQueuedOperation(true);
      
      // Informationen über die Warteschlange anzeigen
      if (event.details) {
        try {
          const details = JSON.parse(event.details);
          if (details.estimatedDelay) {
            const delayMinutes = Math.ceil(details.estimatedDelay / 60000);
            if (delayMinutes > 0) {
              setQueueStatusMessage(
                `Änderung wurde in die Warteschlange eingereiht. Geschätzte Wartezeit: ${delayMinutes} Minute(n).`
              );
            }
          }
        } catch (error) {
          console.error('Error parsing queue details:', error);
        }
      }
      
      // Modal nach kurzer Verzögerung schließen
      setTimeout(() => {
        setShouldCloseModal(true);
      }, 1500);
    },
    onRateLimit: (event) => {
      setIsQueuedOperation(true);
      
      // Informationen zum Rate-Limit anzeigen
      if (event.details) {
        try {
          const details = JSON.parse(event.details);
          const delayMinutes = details.delayMinutes || Math.ceil((details.delayMs || 0) / 60000);
          if (delayMinutes > 0) {
            setQueueStatusMessage(
              `Discord Rate Limit erreicht. Die Änderung wird in ${delayMinutes} Minute(n) durchgeführt.`
            );
          }
        } catch (error) {
          console.error('Error parsing rate limit details:', error);
        }
      }
      
      // Bei Rate-Limit schließen wir das Modal nach kurzer Verzögerung
      setTimeout(() => {
        setShouldCloseModal(true);
      }, 1500);
    },
    onUpdateConfirmed: (event) => {
      setPendingCategoryId(null);
      setIsQueuedOperation(false);
      
      // Erfolgsbenachrichtigung anzeigen
      enqueueSnackbar(`Kategorie "${event.name}" wurde erfolgreich in Discord aktualisiert`, { 
        variant: 'success',
        autoHideDuration: 5000 
      });
      
      // Bei Bestätigung schließen
      setShouldCloseModal(true);
    },
    onError: () => {
      // Bei Fehler Kategorie-ID zurücksetzen, aber Modal nicht schließen
      setPendingCategoryId(null);
      setIsQueuedOperation(false);
    }
  });

  // Update-Kategorie-Aktion
  const updateCategoryAction = async () => {
    if (!initialData?.id) {
      throw new Error('Kategorie-ID fehlt');
    }
    const result = await updateCategory({
      variables: {
        id: initialData.id,
        input: {
          id: initialData.id, 
          name: categoryName,
          categoryType: selectedLevel,
          isVisible: visible,
          isTrackingActive: tracking,
          isSendSetup: sendSetup,
          allowedRoles: role,
        },
      },
    });
    return result.data?.updateCategory;
  };

  // Zentrale Update-Logik
  const { loading, execute: handleSave } = useAsyncHandler(updateCategoryAction, 'Fehler beim Aktualisieren der Kategorie!', {
    onSuccess: (result) => {
      if (result) {
        // Kategorie-ID für Event-Tracking setzen
        setPendingCategoryId(result.id);
        setIsQueuedOperation(true);
        
        // Kein direktes Schließen hier - wir warten auf die Events
        
        // Ursprüngliches onSave bleibt erhalten
        if (onSave) {
          onSave({
            selectedLevel,
            categoryName,
            role,
            tracking,
            visible,
            sendSetup,
          });
        }
      }
    },
    // Keine onFinally Hook, wir lassen das Modal selbst entscheiden, wann es geschlossen wird
  });

  const handleDelete = async () => {
    if (initialData?.id) {
      try {
        const response = await deleteCategory({ variables: { id: initialData.id } });
        
        // ID für Event-Tracking setzen
        setPendingCategoryId(initialData.id);
        setIsQueuedOperation(true);
        
        if (onDelete) {
          onDelete();
        }
        
        // Modal direkt schließen, da Löschungen sofort erfolgen
        onClose();
      } catch (error: any) {
        console.error('Fehler beim Löschen der Kategorie:', error);
        const specificMessage =
          error?.graphQLErrors?.[0]?.extensions?.code === 'CATEGORY_DELETE_FORBIDDEN'
            ? 'Diese Kategorie kann nicht gelöscht werden, da noch Zonen verknüpft sind. Bitte löschen Sie diese zuerst.'
            : error?.graphQLErrors?.[0]?.message || error.message || 'Fehler beim Löschen der Kategorie!';
        enqueueSnackbar(specificMessage, { variant: 'error' });
      }
    } else {
      console.warn('Keine initialData oder ID vorhanden');
    }
  };

  return (
    <Modal open={open} onClose={isQueuedOperation ? undefined : onClose}>
      <Fade in={open} timeout={500}>
        <Box sx={style}>
          <Typography variant="h6" gutterBottom>
            Kategorie bearbeiten
          </Typography>
          
          {/* Queue-Status anzeigen */}
          {isQueuedOperation && queueStatusMessage && (
            <Alert severity="info" sx={{ mb: 2 }}>
              {queueStatusMessage}
            </Alert>
          )}
          
          {/* Ebene auswählen */}
          <Box sx={{ mt: 2, mb: 2, textAlign: 'left' }}>
            <Typography variant="subtitle1" gutterBottom>
              Ebene auswählen
            </Typography>
            <ButtonGroup orientation="vertical" fullWidth aria-label="Ebene auswählen" sx={{ mt: 2 }}>
              <Button 
                variant={selectedLevel === 'Allianz' ? 'contained' : 'outlined'} 
                onClick={() => setSelectedLevel('Allianz')}
                disabled={isQueuedOperation}
              >
                Allianz
              </Button>
              <Button 
                variant={selectedLevel === 'Organisation' ? 'contained' : 'outlined'} 
                onClick={() => setSelectedLevel('Organisation')}
                disabled={isQueuedOperation}
              >
                Organisation
              </Button>
              <Button 
                variant={selectedLevel === 'Suborganisation' ? 'contained' : 'outlined'} 
                onClick={() => setSelectedLevel('Suborganisation')}
                disabled={isQueuedOperation}
              >
                Suborganisation
              </Button>
            </ButtonGroup>
          </Box>
          
          {/* Kategorie konfigurieren */}
          <Box sx={{ mt: 2, mb: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              Kategorie konfigurieren
            </Typography>
            <Box sx={{ mt: 2 }}>
              <PickerTextField 
                label="Kategoriename" 
                value={categoryName} 
                onChange={setCategoryName} 
                enableEmojiPicker 
                enableSpecialPicker 
                disabled={isQueuedOperation}
              />
            </Box>
            <Box sx={{ mt: 2 }}>
              <DiscordRoleSelect 
                multiple 
                value={role} 
                onChange={(value) => setRole(value as string[])} 
                disabled={isQueuedOperation}
              />
            </Box>
            <Box sx={{ mt: 2, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: 'center', gap: 1 }}>
              <FormControlLabel 
                control={<Switch checked={tracking} onChange={(e) => setTracking(e.target.checked)} disabled={isQueuedOperation} />} 
                label="Tracking?" 
              />
              <FormControlLabel 
                control={<Switch checked={visible} onChange={(e) => setVisible(e.target.checked)} disabled={isQueuedOperation} />} 
                label="Sichtbar?" 
              />
              <FormControlLabel 
                control={<Switch checked={sendSetup} onChange={(e) => setSendSetup(e.target.checked)} disabled={isQueuedOperation} />} 
                label="Setup Senden?" 
              />
            </Box>
          </Box>
          
          {/* Buttons */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3, gap: 2 }}>
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
      </Fade>
    </Modal>
  );
};

export default EditCategoryModal;