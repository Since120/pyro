// apps/dashboard/src/components/dashboard/category/setup/setup.category.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Modal,
  Button,
  Typography,
  ButtonGroup,
  FormControlLabel,
  Switch,
  Card,
  CardContent,
  Fade,
  CircularProgress,
  Tooltip,
  IconButton,
  Alert,
  AlertTitle,
} from '@mui/material';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import SetupStepper from '../../../core/setup.stepper';
import PickerTextField from '../../../core/picker.text.field';
import DiscordRoleSelect from '../../../core/discord.role.select';
import { useCreateCategory } from '@/hooks/categories/use.create.categories';
import { useCategories } from '@/hooks/categories/use.get.categories';
import { useDiscordRoles } from '@/hooks/roles/use.discord.roles';
import { CreateCategoryInput, DiscordRole } from '@/graphql/generated/graphql';
import { useSnackbar } from 'notistack';
import { useCategoryEvents } from '@/hooks/categories/use.category.events';
import RefreshIcon from '@mui/icons-material/Refresh';

const steps = ['Select Level', 'Configure Category', 'Summary'];

const style = {
  position: 'absolute' as const,
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

interface SetupProps {
  open: boolean;
  onClose: () => void;
}

const MAX_CREATION_WAIT_TIME = 30000; // 30 Sekunden maximale Wartezeit für die Kategorieerstllung

const Setup: React.FC<SetupProps> = ({ open, onClose }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();

  // Stepper state
  const [activeStep, setActiveStep] = useState(0);
  const [skipped, setSkipped] = useState(new Set<number>());

  const [showDetailedNotifications, setShowDetailedNotifications] = useState(false);

  // Track the ID of the category we're creating for confirmation matching
  const [pendingCategoryId, setPendingCategoryId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [creationError, setCreationError] = useState<string | null>(null);
  const [creationRetryCount, setCreationRetryCount] = useState(0);
  const [lastSnackbarId, setLastSnackbarId] = useState<string | number | null>(null);
  const [showContinueButton, setShowContinueButton] = useState(false);

  // STEP 1: Select level
  const [selectedLevel, setSelectedLevel] = useState<string>('');
  
  // STEP 2: Configure category
  const [categoryName, setCategoryName] = useState<string>('');
  const [role, setRole] = useState<string[]>([]);
  const [tracking, setTracking] = useState<boolean>(false);
  const [visible, setVisible] = useState<boolean>(false);
  const [sendSetup, setSendSetup] = useState<boolean>(false);

  // Apollo hooks
  const { createCategory, mutationResult } = useCreateCategory();
  const { data: categoriesData } = useCategories();
  const { data: discordData } = useDiscordRoles();
  const discordRoles: DiscordRole[] = discordData?.discordRoles || [];

  // Timeout für die Kategorieerstllung
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    if (creating && pendingCategoryId) {
      timeoutId = setTimeout(() => {
        // Nach 30 Sekunden ohne Antwort die Option zum Fortfahren anbieten
        setShowContinueButton(true);
        // Benachrichtigung anzeigen
        const snackbarId = enqueueSnackbar(
          'Discord reagiert nicht rechtzeitig. Möglicherweise wurde die Kategorie trotzdem erstellt.',
          { 
            variant: 'warning',
            persist: true,
            action: (key) => (
              <Button 
                color="inherit" 
                size="small"
                onClick={() => {
                  closeSnackbar(key);
                  setCreating(false);
                  handleReset();
                  onClose();
                }}
              >
                Trotzdem schließen
              </Button>
            )
          }
        );
        setLastSnackbarId(snackbarId);
      }, MAX_CREATION_WAIT_TIME);
    }
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (lastSnackbarId) closeSnackbar(lastSnackbarId);
    };
  }, [creating, pendingCategoryId, enqueueSnackbar, closeSnackbar, onClose]);

  // Verwenden des verbesserten Hooks für Category-Events
  const { isConnected, connectionAttempts, hasTimedOut } = useCategoryEvents({
    // Nur Events für unsere pending Kategorie verfolgen
    watchId: pendingCategoryId,
    
    // Disable default notifications to prevent duplicates
    disableDefaultNotifications: true,
    
    // Callback für Timeout-Fall
    onConnectionTimeout: () => {
      if (creating) {
        setCreationError('Verbindung zum Event-System konnte nicht hergestellt werden.');
        setShowContinueButton(true);
      }
    },
    
    // Event-Handler für Confirmation-Events
    onConfirmation: (event) => {
      console.log('Confirmation event received!', event);
      
      // Wenn ein lastes Snackbar offen ist, dieses schließen
      if (lastSnackbarId) {
        closeSnackbar(lastSnackbarId);
        setLastSnackbarId(null);
      }
      
      // Discord category was created successfully
      setCreating(false);
      setPendingCategoryId(null);
      setCreationError(null);
      enqueueSnackbar(`Kategorie "${categoryName}" wurde erfolgreich in Discord erstellt!`, { 
        variant: 'success',
        autoHideDuration: 6000
      });
      handleReset();
      onClose();
    },
    
    // Event-Handler für Error-Events
    onError: (event) => {
      console.log('Error event received!', event);
      
      // Discord-seitige Fehler behandeln
      const errorMessage = event.error 
        ? `Fehler beim Erstellen der Discord-Kategorie: ${event.error}` 
        : 'Fehler beim Erstellen der Discord-Kategorie';
      
      setCreationError(errorMessage);
      setCreating(false);
      // Keine automatische Schließung - User soll entscheiden können
      setShowContinueButton(true);
      
      enqueueSnackbar(errorMessage, { 
        variant: 'error',
        persist: true,
        action: (key) => (
          <Button 
            color="inherit" 
            size="small"
            onClick={() => {
              closeSnackbar(key);
              handleRetryCreation();
            }}
          >
            Erneut versuchen
          </Button>
        )
      });
    }
  });

  // Zeige Verbindungsstatus, wenn wir gerade eine Kategorie erstellen
  useEffect(() => {
    if (creating && !isConnected && connectionAttempts > 0 && showDetailedNotifications) {
      enqueueSnackbar(`Verbinde mit Event-System (Versuch ${connectionAttempts}/5)...`, { 
        variant: 'info',
        autoHideDuration: 3000
      });
    }
    // Immer noch in die Konsole loggen für Debug-Zwecke
    if (creating && !isConnected) {
      console.log(`Verbinde mit Event-System (Versuch ${connectionAttempts}/5)...`);
    }
  }, [connectionAttempts, creating, isConnected, enqueueSnackbar, showDetailedNotifications]);

  // Erneuter Versuch eine Kategorie zu erstellen
  const handleRetryCreation = useCallback(async () => {
    if (creationRetryCount >= 3) {
      enqueueSnackbar(
        'Die maximale Anzahl an Wiederholungsversuchen wurde erreicht. Bitte versuchen Sie es später erneut.',
        { variant: 'error', autoHideDuration: 8000 }
      );
      return;
    }
    
    setCreationRetryCount(prev => prev + 1);
    setCreationError(null);
    setShowContinueButton(false);
    
    try {
      await handleCreateCategory();
    } catch (error) {
      console.error('Retry creation failed:', error);
      setCreationError('Erneuter Versuch fehlgeschlagen');
      setShowContinueButton(true);
    }
  }, [creationRetryCount, enqueueSnackbar]);

  const isStepValid = () => {
    if (activeStep === 0) return selectedLevel.trim() !== '';
    if (activeStep === 1) return categoryName.trim() !== '' && role.length > 0;
    return true;
  };

  // Helper to get role names from IDs
  const getDynamicRoleNames = (selectedRoleIds: string[]): string[] =>
    selectedRoleIds.map((id) => {
      const found = discordRoles.find((r) => r.id === id);
      return found ? found.name : id;
    });

  // Create category action with improved error handling
  const handleCreateCategory = async (): Promise<void> => {
    try {
      setCreating(true);
      setCreationError(null);
      setShowContinueButton(false);
      
      // Validiere Eingaben nochmal
      if (!categoryName.trim()) {
        throw new Error('Kategoriename darf nicht leer sein');
      }
      
      if (role.length === 0) {
        throw new Error('Mindestens eine Rolle muss ausgewählt sein');
      }
      
      const input: CreateCategoryInput = {
        name: categoryName,
        categoryType: selectedLevel,
        isVisible: visible,
        isTrackingActive: tracking,  
        isSendSetup: sendSetup,      
        allowedRoles: role,
        guildId: process.env.NEXT_PUBLIC_GUILD_ID || '1226186397195702363',
      };
      
      console.log('Creating category with input:', input);
      
      // Execute the mutation with timeout handling
      try {
        const result = await createCategory({ 
          variables: { input },
          // Optimistisches UI-Update deaktivieren, da wir auf die Bestätigung warten
          optimisticResponse: undefined
        });
        
        if (result.data?.createCategory) {
          // Store the category ID for confirmation matching
          setPendingCategoryId(result.data.createCategory.id);
          
          // Show initial notification
          if (showDetailedNotifications) {
            const snackbarId = enqueueSnackbar(
              `Kategorie "${categoryName}" in Datenbank erstellt! Warte auf Discord-Bestätigung...`, 
              { variant: 'info', autoHideDuration: 5000 }
            );
            setLastSnackbarId(snackbarId);
          }
          
          console.log(`Kategorie "${categoryName}" in Datenbank erstellt! Warte auf Discord-Bestätigung...`);        
          console.log('Erstellte Kategorie-ID:', result.data.createCategory.id);
          console.log('Warte auf Bestätigungsevent...');
        } else {
          throw new Error('Keine Antwort vom Server erhalten');
        }
      } catch (graphqlError: any) {
        console.error('GraphQL-Fehler beim Erstellen der Kategorie:', graphqlError);
        setCreationError(`GraphQL-Fehler: ${graphqlError.message || 'Unbekannter Fehler'}`);
        setCreating(false);
        setShowContinueButton(true);
        
        enqueueSnackbar(`Fehler beim Erstellen der Kategorie: ${graphqlError.message || 'Unbekannter Fehler'}`, { 
          variant: 'error',
          persist: true,
          action: (key) => (
            <Button color="inherit" size="small" onClick={() => {
              closeSnackbar(key);
              handleRetryCreation();
            }}>
              Erneut versuchen
            </Button>
          )
        });
      }
    } catch (error: any) {
      setCreating(false);
      setCreationError(error.message || 'Unbekannter Fehler bei der Eingabevalidierung');
      console.error('Fehler beim Erstellen der Kategorie:', error);
      enqueueSnackbar(`Fehler: ${error.message || 'Unbekannter Fehler'}`, { 
        variant: 'error',
        autoHideDuration: 8000
      });
    }
  };

  // Handle Next/Back button clicks
  const handleNext = () => {
    if (!isStepValid()) return;
    
    if (activeStep === steps.length - 1) {
      // On the last step, initiate category creation
      handleCreateCategory();
      return;
    }
    
    let newSkipped = skipped;
    if (skipped.has(activeStep)) {
      newSkipped = new Set(newSkipped.values());
      newSkipped.delete(activeStep);
    }
    
    setActiveStep((prev) => prev + 1);
    setSkipped(newSkipped);
  };

  const handleBack = () => setActiveStep((prev) => prev - 1);

  const handleReset = () => {
    setActiveStep(0);
    setSelectedLevel('');
    setCategoryName('');
    setRole([]);
    setTracking(false);
    setVisible(false);
    setSendSetup(false);
    setPendingCategoryId(null);
    setCreating(false);
    setCreationError(null);
    setCreationRetryCount(0);
    setShowContinueButton(false);
    if (lastSnackbarId) {
      closeSnackbar(lastSnackbarId);
      setLastSnackbarId(null);
    }
  };

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      const timer = setTimeout(() => handleReset(), 1000);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Render steps
  const renderStep1 = () => (
    <Box sx={{ mt: 2, mb: 2, textAlign: 'left' }}>
      <Typography variant="h6" gutterBottom>
        Level auswählen
      </Typography>
      <ButtonGroup orientation="vertical" fullWidth aria-label="Select level" sx={{ mt: 2 }}>
        <Button
          variant={selectedLevel === 'Allianz' ? 'contained' : 'outlined'}
          onClick={() => setSelectedLevel('Allianz')}
        >
          Allianz
        </Button>
        <Button
          variant={selectedLevel === 'Organisation' ? 'contained' : 'outlined'}
          onClick={() => setSelectedLevel('Organisation')}
        >
          Organisation
        </Button>
        <Button
          variant={selectedLevel === 'Suborganisation' ? 'contained' : 'outlined'}
          onClick={() => setSelectedLevel('Suborganisation')}
        >
          Suborganisation
        </Button>
      </ButtonGroup>
    </Box>
  );

  const renderStep2 = () => (
    <Box sx={{ mt: 2, mb: 2 }}>
      <Typography variant="h6" gutterBottom>
        Kategorie konfigurieren
      </Typography>
      <Box sx={{ mt: 2 }}>
        <PickerTextField
          label="Kategoriename"
          value={categoryName}
          onChange={setCategoryName}
          enableEmojiPicker={true}
          enableSpecialPicker={true}
        />
      </Box>
      <Box sx={{ mt: 2 }}>
        <DiscordRoleSelect multiple={true} value={role} onChange={(value) => setRole(value as string[])} />
      </Box>
      <Box
        sx={{
          mt: 2,
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'flex-start', sm: 'center' },
          gap: 1,
        }}
      >
        <FormControlLabel
          control={<Switch checked={tracking} onChange={(e) => setTracking(e.target.checked)} />}
          label="Tracking aktivieren?"
        />
        <FormControlLabel
          control={<Switch checked={visible} onChange={(e) => setVisible(e.target.checked)} />}
          label="Sichtbar?"
        />
        <FormControlLabel
          control={<Switch checked={sendSetup} onChange={(e) => setSendSetup(e.target.checked)} />}
          label="Setup senden?"
        />
      </Box>
      <Box sx={{ mt: 1 }}>
        <FormControlLabel
          control={
            <Switch 
              checked={showDetailedNotifications} 
              onChange={(e) => setShowDetailedNotifications(e.target.checked)} 
              size="small"
            />
          }
          label={
            <Typography variant="caption">
              Detaillierte Benachrichtigungen anzeigen
            </Typography>
          }
        />
      </Box>
    </Box>
  );

  const renderStep3 = () => (
    <Box sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h5" align="center" gutterBottom>
        Zusammenfassung
      </Typography>
      <Card sx={{ maxWidth: 600, mx: 'auto', p: 2, boxShadow: 3 }}>
        <CardContent>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: '1fr 2fr',
              gap: 2,
            }}
          >
            <Typography variant="subtitle1">
              <strong>Level:</strong>
            </Typography>
            <Typography variant="body1">{selectedLevel || 'Nicht ausgewählt'}</Typography>
            <Typography variant="subtitle1">
              <strong>Kategoriename:</strong>
            </Typography>
            <Typography variant="body1">{categoryName || 'Nicht eingegeben'}</Typography>
            <Typography variant="subtitle1">
              <strong>Rollen:</strong>
            </Typography>
            <Typography variant="body1">
              {role.length > 0 ? getDynamicRoleNames(role).join(', ') : 'Nicht ausgewählt'}
            </Typography>
            <Typography variant="subtitle1">
              <strong>Tracking:</strong>
            </Typography>
            <Typography variant="body1">{tracking ? 'Ja' : 'Nein'}</Typography>
            <Typography variant="subtitle1">
              <strong>Sichtbar:</strong>
            </Typography>
            <Typography variant="body1">{visible ? 'Ja' : 'Nein'}</Typography>
            <Typography variant="subtitle1">
              <strong>Setup senden:</strong>
            </Typography>
            <Typography variant="body1">{sendSetup ? 'Ja' : 'Nein'}</Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return renderStep1();
      case 1:
        return renderStep2();
      case 2:
        return renderStep3();
      default:
        return 'Unbekannter Schritt';
    }
  };

  // Zeige Verbindungs- und Fehlerstatus in der UI
  const renderStatusInfo = () => {
    // Zeige nur, wenn wir gerade eine Kategorie erstellen
    if (!creating && !creationError) return null;
    
    return (
      <Box sx={{ mb: 2, width: '100%' }}>
        {creationError ? (
          <Alert 
            severity="error" 
            action={
              <IconButton 
                size="small" 
                onClick={handleRetryCreation}
                disabled={creationRetryCount >= 3}
              >
                <RefreshIcon fontSize="small" />
              </IconButton>
            }
          >
            <AlertTitle>Fehler</AlertTitle>
            {creationError}
            {creationRetryCount >= 3 && (
              <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                Maximale Anzahl an Wiederholungsversuchen erreicht. Bitte versuchen Sie es später erneut.
              </Typography>
            )}
          </Alert>
        ) : creating ? (
          <Alert 
            severity={isConnected ? "info" : "warning"}
            variant="outlined"
          >
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <CircularProgress size={16} sx={{ mr: 1 }} />
              <Typography variant="body2">
                {isConnected 
                  ? 'Verbunden. Erstelle Kategorie in Discord...' 
                  : hasTimedOut 
                    ? 'Verbindungstimeout erreicht. Status unbekannt.' 
                    : `Verbinde mit Event-System (${connectionAttempts}/5)...`
                }
              </Typography>
            </Box>
          </Alert>
        ) : null}
      </Box>
    );
  };

  return (
    <Modal open={open} onClose={creating ? undefined : onClose}>
      <Fade in={open} timeout={500}>
        <Box sx={style}>
          <SetupStepper steps={steps} activeStep={activeStep} />
          {renderStepContent(activeStep)}
          
          {/* Status- und Fehleranzeige */}
          {renderStatusInfo()}
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box sx={{ display: 'flex', flexDirection: 'row', pt: 2 }}>
              <Button 
                color="inherit" 
                disabled={activeStep === 0 || creating} 
                onClick={handleBack} 
                sx={{ mr: 1 }}
              >
                Zurück
              </Button>
              <Box sx={{ flex: '1 1 auto' }} />
              
              {/* Fortfahren-Button bei Fehlern oder Timeouts */}
              {showContinueButton && (
                <Button 
                  variant="outlined" 
                  color="warning" 
                  onClick={() => {
                    setCreating(false);
                    handleReset();
                    onClose();
                  }}
                  sx={{ mr: 1 }}
                >
                  Trotzdem schließen
                </Button>
              )}
              
              {/* Hauptbutton: Weiter/Erstellen/Laden */}
              {creating ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <CircularProgress size={24} />
                  <Typography variant="body2">
                    Erstelle Kategorie...
                  </Typography>
                </Box>
              ) : (
                <Button 
                  onClick={handleNext} 
                  disabled={!isStepValid()}
                  variant={activeStep === steps.length - 1 ? "contained" : "outlined"}
                  color={activeStep === steps.length - 1 ? "primary" : "inherit"}
                >
                  {activeStep === steps.length - 1 ? 'Erstellen' : 'Weiter'}
                </Button>
              )}
            </Box>
          </Box>
        </Box>
      </Fade>
    </Modal>
  );
};

export default Setup;