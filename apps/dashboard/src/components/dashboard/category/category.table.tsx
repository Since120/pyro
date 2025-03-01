'use client';

import React, { useState, useCallback } from 'react';
import {
  Table,
  TableBody,
  TableContainer,
  TableHead,
  TableRow,
  TableCell,
  Paper,
  Box,
  Button,
  useMediaQuery,
  CircularProgress,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import CategoryRow from './category.row';
import { Column, EditCategoryData } from './types';
import { sortCategories, Order } from './sort.utils';
import SortableTableCell from './sortable.table.cell';
import SetupCategory from './setup/setup.category';
import SetupZone from './setup/setup.zone';
import EditCategory from './edit/edit.category';
import EditZone from './edit/edit.zone';
import { useCategories } from '@/hooks/categories/use.get.categories';
import { useZones } from '@/hooks/zone/use.get.zones';
import { useUpdateCategory } from '@/hooks/categories/use.update.categories';
import { useUpdateZone } from '@/hooks/zone/use.update.zones';
import { Category as GraphQLCategory } from '@/graphql/generated/graphql';
import { useSnackbar } from 'notistack';



const columns: Column[] = [
  { key: 'name', label: 'Kategorie', align: 'left' },
  { key: 'categoryType', label: 'Kategorie Typ', align: 'left' },
  { key: 'isVisible', label: 'Sichtbar', align: 'left' },
  { key: 'trackingActive', label: 'Tracking', align: 'left' },
  { key: 'sendSetup', label: 'Setup Senden', align: 'left' },
  { key: 'lastUsage', label: 'Letzte Nutzung', align: 'left' },
];

const CategoryTable: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [order, setOrder] = useState<Order>('asc');
  const [orderBy, setOrderBy] = useState<string>('name');

  // Kategorien via API
  const { data: categoriesData, loading: categoriesLoading, error: categoriesError } = useCategories();
  const apiCategories: GraphQLCategory[] = categoriesData?.categories || [];

  // Zonen via API
  const { data: zonesData, loading: zonesLoading, error: zonesError } = useZones();

  // Enhanced categories: Jede Kategorie erhält ihre zugehörigen Zonen
  const enhancedCategories = apiCategories.map((cat: GraphQLCategory) => {
    const zones = zonesData?.zones.filter((zone: any) => zone.categoryId === cat.id) || [];
    return {
      ...cat,
      zones,
      zoneCount: zones.length,
    };
  });

  // Sortierung
  const handleRequestSort = (property: string) => {
    const isAsc = orderBy === property && order === 'asc';
    const newOrder: Order = isAsc ? 'desc' : 'asc';
    setOrder(newOrder);
    setOrderBy(property);
  };

  // Setup Wizard Modal für Kategorie-Erstellung
  const [openWizard, setOpenWizard] = useState(false);
  const handleOpenWizard = () => setOpenWizard(true);
  const handleCloseWizard = () => setOpenWizard(false);

  // Setup Zone Modal für neue Zonen
  const [openZone, setOpenZone] = useState(false);
  const handleOpenZone = () => setOpenZone(true);
  const handleCloseZone = () => setOpenZone(false);

  // Edit Zone Modal
  const [zoneEditOpen, setZoneEditOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<null | any>(null);
  const handleEditZone = (zone: any) => {
    setEditingZone(zone);
    setZoneEditOpen(true);
  };

  // Globale Selektion für Kategorien (über den Namen) und Aggregation der ausgewählten Zonen
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggleSelection = (categoryName: string) => {
    setSelected((prev) => {
      const newSelected = new Set(prev);
      if (newSelected.has(categoryName)) {
        newSelected.delete(categoryName);
      } else {
        newSelected.add(categoryName);
      }
      return newSelected;
    });
  };
  const clearCategorySelection = useCallback((categoryName: string) => {
    setSelected((prev) => {
      const newSelected = new Set(prev);
      newSelected.delete(categoryName);
      return newSelected;
    });
  }, []);
  const handleZoneSelect = useCallback(() => {
    setSelected(new Set());
  }, []);
  const [zoneSelected, setZoneSelected] = useState(false);

  // Neuer Zustand, um die in den einzelnen CategoryRow selektierten Zone-IDs zu sammeln
  const [zoneSelections, setZoneSelections] = useState<{ [categoryId: string]: string[] }>({});

  const handleZoneIdsChange = useCallback((categoryId: string, selectedZoneIds: string[]) => {
    setZoneSelections(prev => ({
      ...prev,
      [categoryId]: selectedZoneIds,
    }));
  }, []);

  const showDelete = selected.size > 0 || zoneSelected;

  const mobileButtonStyles = {
    fontSize: { xs: '0.75rem', sm: 'inherit' },
    px: { xs: 1, sm: 2 },
    py: { xs: 0.5, sm: 1 },
  };

  // Master Edit Modal (Kategorie)
  const [masterEditOpen, setMasterEditOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const handleEditCategory = (category: any) => {
    setEditingCategory(category);
    setMasterEditOpen(true);
  };

  // Delete-Hooks importieren
  const { deleteCategory } = useUpdateCategory();
  const { deleteZone } = useUpdateZone();
  const { enqueueSnackbar } = useSnackbar();
  const [deletedZones, setDeletedZones] = useState<Set<string>>(new Set());

  const handleDelete = async () => {
    if (selected.size > 0) {
      // Lösche alle selektierten Kategorien
      const categoriesToDelete = enhancedCategories.filter(cat => selected.has(cat.name));
      for (const cat of categoriesToDelete) {
        try {
          // Stelle sicher, dass keine erneute Löschung stattfindet
          if (!deletedZones.has(cat.id)) {
            await deleteCategory({ variables: { id: cat.id } });
            console.log('Kategorie gelöscht:', cat.name);
            enqueueSnackbar(`Kategorie "${cat.name}" wurde gelöscht!`, { variant: 'success' });
            // Füge die gelöschte Kategorie zu deletedZones hinzu
            setDeletedZones(prev => new Set(prev.add(cat.id)));
          }
        } catch (error: any) {
          console.error('Fehler beim Löschen der Kategorie', cat.name, error);
          const specificMessage =
            error?.graphQLErrors?.[0]?.extensions?.code === 'CATEGORY_DELETE_FORBIDDEN'
              ? 'Diese Kategorie kann nicht gelöscht werden, da noch Zonen verknüpft sind. Bitte löschen Sie diese zuerst.'
              : error?.graphQLErrors?.[0]?.message || error.message || 'Fehler beim Löschen der Kategorie!';
          enqueueSnackbar(specificMessage, { variant: 'error' });
        }
      }
    } else if (zoneSelected) {
      // Lösche alle selektierten Zonen (aus allen Kategorien aggregiert)
      const allZoneIds = Object.values(zoneSelections).flat();
      const uniqueZoneIds = Array.from(new Set(allZoneIds));
      for (const zoneId of uniqueZoneIds) {
        try {
          // Stelle sicher, dass keine erneute Löschung stattfindet
          if (!deletedZones.has(zoneId)) {
            await deleteZone({ variables: { id: zoneId } });
            console.log('Zone gelöscht:', zoneId);
            enqueueSnackbar(`Zone "${zoneId}" wurde gelöscht!`, { variant: 'success' });
            // Füge die gelöschte Zone zu deletedZones hinzu
            setDeletedZones(prev => new Set(prev.add(zoneId)));
          }
        } catch (error: any) {
          console.error('Fehler beim Löschen der Zone', zoneId, error);
          enqueueSnackbar(
            error?.graphQLErrors?.[0]?.message || error.message || 'Fehler beim Löschen der Zone!',
            { variant: 'error' }
          );
        }
      }
    }
    // Selektionen zurücksetzen, damit der Delete-Button verschwindet
    setSelected(new Set());
    setZoneSelected(false);
  };
  
  

  if (categoriesLoading || zonesLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (categoriesError || zonesError) {
    return <div>Fehler beim Laden der Daten.</div>;
  }

  return (
    <Box
      sx={{
        maxWidth: 'var(--Content-maxWidth)',
        m: 'var(--Content-margin)',
        p: 'var(--Content-padding)',
        width: 'var(--Content-width)',
      }}
    >
      {/* Button-Reihe */}
      <Box
        sx={{
          mb: 2,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'nowrap',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            gap: 2,
            flexWrap: { xs: 'wrap', sm: 'nowrap' },
          }}
        >
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              handleOpenWizard();
              setZoneSelected(false);
            }}
            size={isMobile ? 'small' : 'medium'}
            sx={mobileButtonStyles}
          >
            KATEGORIE
          </Button>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => {
              handleOpenZone();
              setZoneSelected(false);
            }}
            size={isMobile ? 'small' : 'medium'}
            sx={mobileButtonStyles}
          >
            ZONE
          </Button>
        </Box>
        {showDelete && (
          <Box sx={{ alignSelf: { xs: 'flex-end', sm: 'center' } }}>
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={handleDelete}
              size={isMobile ? 'small' : 'medium'}
              sx={mobileButtonStyles}
            >
              DELETE
            </Button>
          </Box>
        )}
      </Box>

      {/* Tabelle */}
      <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
        <Table aria-label="Categories Table" sx={{ minWidth: 800 }}>
          <TableHead>
            <TableRow>
              <TableCell />
              {columns.map((col) => (
                <SortableTableCell
                  key={col.key}
                  columnKey={col.key}
                  label={col.label}
                  orderBy={orderBy}
                  order={order}
                  onRequestSort={handleRequestSort}
                  align={col.align}
                />
              ))}
              <TableCell align="right">Edit</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortCategories(enhancedCategories, orderBy, order).map((cat: any) => (
              <CategoryRow
                key={cat.id}
                category={cat}
                defaultOpen={false}
                isSelected={selected.has(cat.name)}
                onToggleSelection={toggleSelection}
                onClearCategorySelection={clearCategorySelection}
                globalCategorySelected={selected.size > 0}
                onZoneSelect={handleZoneSelect}
                onZoneSelectionChange={setZoneSelected}
                onEditCategory={handleEditCategory}
                onEditZone={handleEditZone}
                onZoneIdsChange={handleZoneIdsChange}
              />
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Setup Wizard Modal für Kategorie-Erstellung */}
      <SetupCategory open={openWizard} onClose={handleCloseWizard} />

      {/* Setup Zone Modal für neue Zonen */}
      {openZone && (
        <SetupZone
          open={openZone}
          onClose={handleCloseZone}
          onSave={(zoneData) => {
            console.log('Neue Zone gespeichert:', zoneData);
          }}
          categories={enhancedCategories.map((cat: any) => ({ id: cat.id, name: cat.name }))}
        />
      )}

      {/* Master Edit Modal – für die Kategorie */}
      {masterEditOpen && editingCategory && (
        <EditCategory
          open={masterEditOpen}
          onClose={() => setMasterEditOpen(false)}
          onSave={(data: EditCategoryData) => {
            console.log('Saving master category edit:', data);
            setMasterEditOpen(false);
          }}
          onDelete={() => {
            console.log('Deleting master category:', editingCategory.name);
            setMasterEditOpen(false);
          }}
          initialData={{
            id: editingCategory.id,
            selectedLevel: editingCategory.categoryType,
            categoryName: editingCategory.name,
            role: editingCategory.allowedRoles,
            tracking: editingCategory.trackingActive,
            visible: editingCategory.isVisible,
            sendSetup: editingCategory.sendSetup,
          }}
        />
      )}

      {/* Edit Zone Modal – für die Zonen */}
      {zoneEditOpen && editingZone && (
        <EditZone
          open={zoneEditOpen}
          onClose={() => setZoneEditOpen(false)}
          onSave={(data) => {
            console.log('Zone updated:', data);
            setZoneEditOpen(false);
          }}
          onDelete={() => {
            console.log('Zone deleted:', editingZone.id);
            setZoneEditOpen(false);
          }}
          initialData={editingZone}
          categories={enhancedCategories.map((cat: any) => ({ id: cat.id, name: cat.name }))}
        />
      )}
    </Box>
  );
};

export default CategoryTable;
