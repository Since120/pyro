// apps/dashboard/src/components/core/discord.role.select.tsx
import React from 'react';
import {
	FormControl,
	InputLabel,
	Select,
	MenuItem,
	SelectChangeEvent,
	Chip,
	Box,
	Typography,
	useTheme,
} from '@mui/material';
import { useDiscordRoles } from '@/hooks/roles/use.discord.roles';
import { DiscordRole } from '@/graphql/generated/graphql'; // Import des generierten Typs

export interface DiscordRoleSelectProps {
	multiple?: boolean;
	value: string | string[];
	onChange: (value: string | string[]) => void;
	disabled?: boolean; // Disabled-Property hinzugefügt
}

// Konvertiert den integer Farbwert in einen hexadezimalen Farbstring.
// Falls der Wert ungültig oder 0 ist, wird "#808080" (neutraler Grau) zurückgegeben.
const getColorHex = (color: number): string => {
	if (typeof color !== 'number' || isNaN(color) || color === 0) {
		return '#808080';
	}
	return '#' + color.toString(16).padStart(6, '0').toUpperCase();
};

const DiscordRoleSelect: React.FC<DiscordRoleSelectProps> = ({ 
	multiple = false, 
	value, 
	onChange, 
	disabled = false // Standardwert hinzugefügt
}) => {
	const theme = useTheme();
	const { data, loading, error } = useDiscordRoles();
	const roles: DiscordRole[] = data?.discordRoles || [];

	const handleChange = (event: SelectChangeEvent<typeof value>) => {
		onChange(event.target.value);
	};

	if (loading) return <div>Lade Rollen...</div>;
	if (error) return <div>Fehler beim Laden der Rollen.</div>;

	return (
		<FormControl fullWidth disabled={disabled}>
			<InputLabel id="discord-role-select-label">Rolle(n) auswählen</InputLabel>
			<Select
				labelId="discord-role-select-label"
				multiple={multiple}
				value={value}
				label="Rolle(n) auswählen"
				onChange={handleChange}
				renderValue={(selected) => {
					const selectedArray: string[] = Array.isArray(selected) ? selected : [];
					return (
						<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
							{selectedArray.map((roleId) => {
								const role = roles.find((r) => r.id === roleId);
								return (
									<Chip
										key={roleId}
										label={
											<Typography
												sx={{
													// Im Dark Mode soll der Text schwarz, im Light Mode weiß sein
													color: theme.palette.mode === 'dark' ? '#000000' : '#FFFFFF',
												}}
											>
												{role ? role.name : roleId}
											</Typography>
										}
										size="small"
										onDelete={
											multiple && !disabled // Nur bei multiple und wenn nicht disabled
												? (e) => {
														e.stopPropagation();
														e.preventDefault();
														const newValue = selectedArray.filter((id) => id !== roleId);
														onChange(newValue);
													}
												: undefined
										}
										deleteIcon={
											multiple && !disabled ? ( // Nur bei multiple und wenn nicht disabled
												<span
													onMouseDown={(e) => {
														e.stopPropagation();
														e.preventDefault();
													}}
												>
													×
												</span>
											) : undefined
										}
										sx={{
											backgroundColor: role && role.color !== 0 ? getColorHex(role.color) : undefined,
										}}
									/>
								);
							})}
						</Box>
					);
				}}
			>
				{roles.map((role) => (
					<MenuItem key={role.id} value={role.id}>
						<Typography sx={{ color: getColorHex(role.color) }}>{role.name}</Typography>
					</MenuItem>
				))}
			</Select>
		</FormControl>
	);
};

export default DiscordRoleSelect;