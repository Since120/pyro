// components/ClientSnackbarProvider.tsx
'use client';
import React from 'react';
import { SnackbarProvider } from 'notistack';

const ClientSnackbarProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
	return (
		<SnackbarProvider maxSnack={3} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} autoHideDuration={3000}>
			{children}
		</SnackbarProvider>
	);
};

export default ClientSnackbarProvider;
