import React from 'react';
import { Box, TextField, MenuItem, Typography } from '@mui/material';
import { ZoneCreateInput } from '@/graphql/generated/graphql';
import { useCreateZone } from '@/hooks/zone/use.create.zones';
import AsyncActionModal from '../../../core/async.action.modal';
import { useSnackbar } from 'notistack';

export interface CategoryOption {
  id: string;
  name: string;
}

interface SetupZoneProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: ZoneCreateInput) => void;
  categories: CategoryOption[];
}

const SetupZone: React.FC<SetupZoneProps> = ({ open, onClose, onSave, categories }) => {
  // Local form states
  const [categoryId, setCategoryId] = React.useState<string>('');
  const [zoneKey, setZoneKey] = React.useState<string>('');
  const [zoneName, setZoneName] = React.useState<string>('');
  const [minutesRequired, setMinutesRequired] = React.useState<number>(0);
  const [pointsGranted, setPointsGranted] = React.useState<number>(0);
  const { enqueueSnackbar } = useSnackbar();

  const isValid = () =>
    categoryId.trim() !== '' &&
    zoneKey.trim() !== '' &&
    zoneName.trim() !== '' &&
    minutesRequired > 0 &&
    pointsGranted > 0;

  // Use the createZone hook
  const { createZone } = useCreateZone();

  // Define the action to be executed
  const action = async (): Promise<ZoneCreateInput> => {
    // Create input with correct property names that match the GraphQL schema
    const input: ZoneCreateInput = {
      zoneKey,
      name: zoneName,
      minutesRequired,
      pointsGranted,
      totalSecondsInZone: 0,
      isDeletedInDiscord: false, // Corrected property name
      categoryId,
    };
    
    console.log('Creating zone with input:', input);
    
    try {
      // Execute the mutation
      await createZone({ variables: { input } });
      
      // Log success and return input
      console.log('Zone created successfully with input:', input);
      return input;
    } catch (error) {
      console.error('Error creating zone:', error);
      enqueueSnackbar('Error creating zone. Please check the console for details.', { variant: 'error' });
      throw error;
    }
  };

  // onSuccess function: called when the action was successful
  const handleSuccess = (input: ZoneCreateInput) => {
    enqueueSnackbar('Zone created successfully!', { variant: 'success' });
    onSave(input);
  };

  return (
    <AsyncActionModal<ZoneCreateInput>
      open={open}
      onClose={onClose}
      action={action}
      onSuccess={handleSuccess}
      spinnerText="Saving..."
      errorText="Something went wrong."
      successText="Zone created!"
      reloadText="Try again"
    >
      <Typography variant="h6" gutterBottom>
        Add New Zone
      </Typography>
      <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          select
          label="Select Category"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          fullWidth
        >
          {categories.map((cat) => (
            <MenuItem key={cat.id} value={cat.id}>
              {cat.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField label="Zone Key" value={zoneKey} onChange={(e) => setZoneKey(e.target.value)} fullWidth />
        <TextField label="Zone Name" value={zoneName} onChange={(e) => setZoneName(e.target.value)} fullWidth />
        <TextField
          label="Required Minutes for Target Points"
          type="number"
          value={minutesRequired}
          onChange={(e) => setMinutesRequired(Number(e.target.value))}
          fullWidth
        />
        <TextField
          label="Points per Minute"
          type="number"
          value={pointsGranted}
          onChange={(e) => setPointsGranted(Number(e.target.value))}
          fullWidth
        />
      </Box>
    </AsyncActionModal>
  );
};

export default SetupZone;