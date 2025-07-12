import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';
import { useActiveUser } from '@/contexts/ActiveUserContext';
import { usePreferences } from '@/contexts/PreferencesContext';
import { toast } from '@/hooks/use-toast';
import { debug, error } from '@/utils/logging';
import { Food, FoodVariant } from '@/types/food';
import { searchFoods } from '@/services/foodService';
import FoodUnitSelector from '@/components/FoodUnitSelector';

interface FoodPlanSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFoodSelect: (food: Food, quantity: number, unit: string, selectedVariant: FoodVariant) => void;
}

const FoodPlanSelector: React.FC<FoodPlanSelectorProps> = ({ open, onOpenChange, onFoodSelect }) => {
  const { activeUserId } = useActiveUser();
  const { loggingLevel } = usePreferences();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Food[]>([]);
  const [isFoodUnitSelectorOpen, setIsFoodUnitSelectorOpen] = useState(false);
  const [selectedFoodForUnitSelection, setSelectedFoodForUnitSelection] = useState<Food | null>(null);

  const handleSearchFoods = useCallback(async () => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const foods = await searchFoods(activeUserId!, searchTerm, activeUserId!, false, true, true);
      setSearchResults(foods);
    } catch (err) {
      error(loggingLevel, 'Error searching foods:', err);
      toast({
        title: 'Error',
        description: 'Failed to search foods.',
        variant: 'destructive',
      });
    }
  }, [searchTerm, activeUserId, loggingLevel]);

  const handleAddFood = useCallback((food: Food) => {
    setSelectedFoodForUnitSelection(food);
    setIsFoodUnitSelectorOpen(true);
  }, []);

  const handleFoodUnitSelected = useCallback((food: Food, quantity: number, unit: string, selectedVariant: FoodVariant) => {
    onFoodSelect(food, quantity, unit, selectedVariant);
    setIsFoodUnitSelectorOpen(false);
    setSelectedFoodForUnitSelection(null);
    setSearchTerm('');
    setSearchResults([]);
    onOpenChange(false); // Close the main dialog after selection
  }, [onFoodSelect, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Food to Meal Plan</DialogTitle>
          <DialogDescription>
            Search for a food item and specify its quantity and unit.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex space-x-2">
            <Input
              placeholder="Search for food..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleSearchFoods();
                }
              }}
              className="flex-1"
            />
            <Button onClick={handleSearchFoods}>
              <Search className="h-4 w-4 mr-2" /> Search
            </Button>
          </div>

          {searchResults.length > 0 && (
            <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-2">
              {searchResults.map(food => (
                <div key={food.id} className="flex items-center justify-between p-1 hover:bg-accent rounded-sm">
                  <span>{food.name} {food.brand ? `(${food.brand})` : ''}</span>
                  <Button variant="outline" size="sm" onClick={() => handleAddFood(food)}>
                    Add
                  </Button>
                </div>
              ))}
            </div>
          )}

          {selectedFoodForUnitSelection && (
            <FoodUnitSelector
              food={selectedFoodForUnitSelection}
              open={isFoodUnitSelectorOpen}
              onOpenChange={setIsFoodUnitSelectorOpen}
              onSelect={handleFoodUnitSelected}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FoodPlanSelector;