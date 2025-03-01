// apps/dashboard/src/hooks/categories/use.create.categories.ts
import { useMutation } from '@apollo/client';
import {
  CreateCategoryDocument,
  CreateCategoryMutation,
  CreateCategoryMutationVariables,
  Category,
  GetCategoriesDocument
} from '../../graphql/generated/graphql';

/**
 * Hook für die Erstellung von Kategorien
 * Die Mutation erfolgt, aber das Abonnieren von Events passiert in der Komponente
 */
export const useCreateCategory = (
  onCategoryCreated?: (data: Category) => void
) => {
  const [createCategory, mutationResult] = useMutation<
    CreateCategoryMutation, 
    CreateCategoryMutationVariables
  >(CreateCategoryDocument, {
    // Update Apollo cache with the newly created category
    update: (cache, { data }) => {
      if (!data?.createCategory) return;
      
      try {
        // Read existing categories from cache
        const existingData = cache.readQuery<{ categories: Category[] }>({
          query: GetCategoriesDocument
        });
        
        // TypeScript-sicherer Check
        if (existingData && existingData.categories) {
          // Add new category to cache
          cache.writeQuery({
            query: GetCategoriesDocument,
            data: {
              categories: [
                ...existingData.categories,
                data.createCategory
              ]
            }
          });
        }
        
        // Optional callback
        if (onCategoryCreated) {
          onCategoryCreated(data.createCategory);
        }
      } catch (error) {
        console.error('Error updating cache:', error);
      }
    }
  });

  return { createCategory, mutationResult };
};