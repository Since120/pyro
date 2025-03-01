// apps/dashboard/src/components/client.providers.tsx
'use client';

import React from 'react';
import { ApolloProvider } from '@apollo/client';
import client from '@/lib/apollo.client';

interface ClientProvidersProps {
	children: React.ReactNode;
}

export default function ClientProviders({ children }: ClientProvidersProps) {
	return <ApolloProvider client={client}>{children}</ApolloProvider>;
}
