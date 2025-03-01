// apps/dashboard/src/hooks/categories/use.get.categories.ts
import React from 'react';
import { useQuery, gql } from '@apollo/client';
import { GetCategoriesDocument, CategoryEvent, Category } from '../../graphql/generated/graphql';

// GraphQL-Subscription für CategoryEvent
const CATEGORY_EVENT_SUBSCRIPTION = gql`
  subscription CategoryEvent {
    categoryEvent {
      id
      guildId
      name
      discordCategoryId
      timestamp
      eventType
      error
      details
    }
  }
`;

export const useCategories = () => {
  const queryResult = useQuery(GetCategoriesDocument);
  const { subscribeToMore } = queryResult;

  React.useEffect(() => {
    // Abonnieren des Category-Events für Updates und Löschungen
    const unsubscribeCategoryEvent = subscribeToMore({
      document: CATEGORY_EVENT_SUBSCRIPTION,
      updateQuery: (prev, { subscriptionData }) => {
        if (!subscriptionData.data) return prev;
        
        const eventData = subscriptionData.data.categoryEvent as CategoryEvent;
        
        // Je nach Event-Typ unterschiedliche Updates durchführen
        switch (eventData.eventType) {
          case 'created':
            // Hier müssten wir eigentlich mit queryClient.refetch() arbeiten, 
            // da wir nicht die vollständigen Category-Daten haben
            return prev;
            
          case 'updated':
            // Bei Update müssen wir die Kategorie in der Liste aktualisieren
            // Da wir aber nicht alle Felder haben, ist ein refetch besser
            return prev;
            
          case 'deleted':
            // Bei Löschung können wir die Kategorie aus der Liste entfernen
            if (prev.categories) {
              return {
                ...prev,
                categories: prev.categories.filter((cat: Category) => cat.id !== eventData.id)
              };
            }
            return prev;
            
          default:
            return prev;
        }
      }
    });

    return () => {
      unsubscribeCategoryEvent();
    };
  }, [subscribeToMore]);

  return queryResult;
};