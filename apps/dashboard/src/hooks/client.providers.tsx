'use client';

import React from 'react';
import { ApolloProvider } from '@apollo/client';
import client from '@/lib/apollo.client';
import DashboardNotificationWrapper from '@/components/DashboardNotificationWrapper';

interface ClientProvidersProps {
  children: React.ReactNode;
}

// DashboardNotificationWrapper muss INNERHALB des ApolloProvider sein,
// da er Apollo-Subscriptions verwendet
export default function ClientProviders({ children }: ClientProvidersProps) {
  return (
    <ApolloProvider client={client}>
      <DashboardNotificationWrapper>
        {children}
      </DashboardNotificationWrapper>
    </ApolloProvider>
  );
}