// Bereinigte Version von use.update.categories.ts
// Entfernt die doppelte Subscription

import { useMutation } from '@apollo/client';
import {
  UpdateCategoryDocument,
  DeleteCategoryDocument,
  UpdateCategoryMutation,
  UpdateCategoryMutationVariables,
  DeleteCategoryMutation,
  DeleteCategoryMutationVariables,
  Category,
  GetCategoriesDocument
} from '../../graphql/generated/graphql';

/**
 * Hook für Update und Delete von Kategorien.
 * Verzichtet auf eigene Subscriptions, um Duplikate zu vermeiden.
 */
export const useUpdateCategory = (
  onCategoryUpdated?: (data: Category) => void,
  onCategoryDeleted?: (id: string) => void
) => {
  // Mutations für Update und Delete
  const [updateCategory, updateResult] = useMutation<UpdateCategoryMutation, UpdateCategoryMutationVariables>(
    UpdateCategoryDocument, {
      // Update Apollo Cache beim erfolgreichen Update
      update(cache, { data }) {
        if (!data?.updateCategory) return;
        
        try {
          // Cache mit aktualisierter Kategorie aktualisieren
          const updatedCategory = data.updateCategory;
          
          cache.modify({
            fields: {
              categories(existingCategoriesRefs = [], { readField, toReference }) {
                // Kategorie im Cache finden und aktualisieren
                const newRefs = [...existingCategoriesRefs];
                const index = newRefs.findIndex(
                  (ref: any) => readField('id', ref) === updatedCategory.id
                );
                
                if (index !== -1) {
                  // Kategorie aktualisieren, wenn gefunden
                  newRefs[index] = toReference(updatedCategory);
                }
                
                return newRefs;
              },
            },
          });
          
          // Optional: Callback für UI-Updates aufrufen
          if (onCategoryUpdated) {
            onCategoryUpdated(updatedCategory);
          }
        } catch (error) {
          console.error('Error updating cache:', error);
        }
      }
    }
  );

  const [deleteCategory, deleteResult] = useMutation<DeleteCategoryMutation, DeleteCategoryMutationVariables>(
    DeleteCategoryDocument, {
      // Update Apollo Cache beim erfolgreichen Löschen
      update(cache, { data }) {
        if (!data?.deleteCategory) return;
        
        try {
          // Gelöschte Kategorie aus dem Cache entfernen
          const deletedCategoryId = data.deleteCategory.id;
          
          cache.modify({
            fields: {
              categories(existingCategoriesRefs = [], { readField }) {
                // Kategorie aus der Liste filtern
                return existingCategoriesRefs.filter(
                  (ref: any) => readField('id', ref) !== deletedCategoryId
                );
              },
            },
          });
          
          // Optional: Callback für UI-Updates aufrufen
          if (onCategoryDeleted) {
            onCategoryDeleted(deletedCategoryId);
          }
        } catch (error) {
          console.error('Error updating cache after deletion:', error);
        }
      }
    }
  );

  return {
    updateCategory,
    updateResult,
    deleteCategory,
    deleteResult
  };
};