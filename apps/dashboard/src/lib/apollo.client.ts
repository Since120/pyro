import { ApolloClient, InMemoryCache, HttpLink, split, from } from '@apollo/client';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient } from 'graphql-ws';
import { getMainDefinition } from '@apollo/client/utilities';
import { onError } from '@apollo/client/link/error';

const apiUrl = process.env.NEXT_PUBLIC_API_URL;
if (!apiUrl) {
	throw new Error('NEXT_PUBLIC_API_URL is not defined');
}

// Erweiterter Error-Link mit detailliertem Logging
const errorLink = onError(({ graphQLErrors, networkError, operation, forward }) => {
	if (graphQLErrors) {
		graphQLErrors.forEach((err, index) => {
			console.error(`[GraphQL Error ${index}]:`, err);
			console.error('Operation:', operation.operationName);
		});
	}
	if (networkError) {
		console.error('[Network Error]:', networkError);
	}
	// Wichtig: Operation weiterleiten, auch bei Fehlern
	return forward(operation);
});

// HTTP Link für Queries und Mutationen
const httpLink = new HttpLink({
	uri: `${apiUrl}/graphql`,
});

// WebSocket Link für Subscriptions mit erweiterten Debug-Optionen
const wsLink = new GraphQLWsLink(
	createClient({
		url: apiUrl.replace(/^http/, 'ws') + '/graphql',
		connectionParams: () => ({
			reconnect: true,
			timeout: 30000,
		}),
		// Hinzufügen von Verbindungs-Logging
		on: {
			connected: () => console.log('WebSocket connected to GraphQL endpoint'),
			connecting: () => console.log('Connecting to GraphQL WebSocket...'),
			closed: (event) => console.log('WebSocket connection closed', event),
			error: (error) => console.error('WebSocket connection error:', error),
		},
		// Verbindungs-Stabilität verbessern
		retryAttempts: 5,
		shouldRetry: () => true,
		keepAlive: 10000, // 10 Sekunden Ping-Intervall
	})
);

// Split Link: sendet Subscription-Operationen an den wsLink, alle anderen an den httpLink
const splitLink = split(
	({ query }) => {
		const definition = getMainDefinition(query);
		return definition.kind === 'OperationDefinition' && definition.operation === 'subscription';
	},
	wsLink,
	httpLink
);

// Apollo-Client mit kombiniertem Link (Error + Split)
const client = new ApolloClient({
	link: from([errorLink, splitLink]),
	cache: new InMemoryCache(),
	connectToDevTools: process.env.NODE_ENV !== 'production',
	defaultOptions: {
		watchQuery: {
			fetchPolicy: 'cache-and-network',
			errorPolicy: 'all',
		},
		query: {
			fetchPolicy: 'network-only',
			errorPolicy: 'all',
		},
		mutate: {
			errorPolicy: 'all',
		}
		// 'subscription' wurde entfernt, da es nicht Teil des DefaultOptions-Typs ist
	},
});

export default client;