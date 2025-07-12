import React, { useState, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useActiveUser } from "@/contexts/ActiveUserContext";
import { usePreferences } from "@/contexts/PreferencesContext";
import { debug, info, warn, error } from '@/utils/logging';
import { toast } from "@/hooks/use-toast";
import { api } from '@/services/api'; // Import api service
import { Meal } from '@/types/meal';

interface MealSelectionDialogProps {
  mealType: string;
  selectedDate: string;
  onMealAdded: () => void;
}

const MealSelectionDialog: React.FC<MealSelectionDialogProps> = ({ mealType, selectedDate, onMealAdded }) => {
  const { activeUserId } = useActiveUser();
  const { loggingLevel } = usePreferences();
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Meal[]>([]);
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Debounce searchTerm
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500); // 500ms delay

    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm]);

  const handleSearch = useCallback(async () => {
    debug(loggingLevel, `Searching meals for term: ${debouncedSearchTerm}`);
    if (!activeUserId || !debouncedSearchTerm.trim()) { // Only search if there's an active user and a non-empty search term
      setSearchResults([]); // Clear results if search term is empty
      return;
    }
    try {
      const results = await api.get('/meals/search', { params: { searchTerm: debouncedSearchTerm } });
      setSearchResults(results);
      debug(loggingLevel, "Meal search results:", results);
    } catch (err) {
      error(loggingLevel, "Error searching meals:", err);
      toast({
        title: "Error",
        description: "Failed to search meals.",
        variant: "destructive",
      });
    }
  }, [activeUserId, loggingLevel, debouncedSearchTerm]);

  // Trigger search when debouncedSearchTerm changes
  useEffect(() => {
    handleSearch();
  }, [debouncedSearchTerm, handleSearch]);

  const handleAddMeal = useCallback(async () => {
    if (!selectedMeal || !activeUserId) {
      warn(loggingLevel, "No meal selected or active user ID missing.");
      return;
    }
    debug(loggingLevel, `Adding meal ${selectedMeal.name} to diary for date ${selectedDate}, meal type ${mealType}`);
    try {
      await api.post('/foods/food-entries/add-meal', { body: { mealId: selectedMeal.id, mealType, entryDate: selectedDate } });
      info(loggingLevel, `Successfully added meal ${selectedMeal.name} to diary.`);
      toast({
        title: "Success",
        description: `Meal "${selectedMeal.name}" added to diary.`,
      });
      onMealAdded();
      setIsDialogOpen(false);
      setSelectedMeal(null); // Clear selected meal after adding
      setSearchTerm(''); // Clear search term
      setSearchResults([]); // Clear search results
    } catch (err) {
      error(loggingLevel, "Error adding meal to diary:", err);
      toast({
        title: "Error",
        description: "Failed to add meal to diary.",
        variant: "destructive",
      });
    }
  }, [activeUserId, loggingLevel, selectedMeal, mealType, selectedDate, onMealAdded, toast]);

  useEffect(() => {
    if (!isDialogOpen) {
      // Reset state when dialog closes
      setSearchTerm('');
      setDebouncedSearchTerm('');
      setSearchResults([]);
      setSelectedMeal(null);
    }
  }, [isDialogOpen]);

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="w-4 h-4 mr-1" />
          Add Meal
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Add Meal to {mealType.charAt(0).toUpperCase() + mealType.slice(1)}</DialogTitle>
        </DialogHeader>
        <DialogDescription>
          Search for and select a meal to add its foods to your diary.
        </DialogDescription>
        <div className="grid gap-4 py-4">
          <div className="flex items-center space-x-2">
            <Input
              placeholder="Search for a meal..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <ScrollArea className="h-[200px] w-full rounded-md border p-4">
            {searchResults.length === 0 && debouncedSearchTerm.trim() !== '' ? (
              <p className="text-center text-gray-500">No meals found for "{debouncedSearchTerm}". Try a different search term.</p>
            ) : searchResults.length === 0 ? (
              <p className="text-center text-gray-500">Start typing to search for meals.</p>
            ) : (
              <ul>
                {searchResults.map((meal) => (
                  <li
                    key={meal.id}
                    className={`p-2 cursor-pointer hover:bg-gray-100 ${selectedMeal?.id === meal.id ? 'bg-gray-200' : ''}`}
                    onClick={() => setSelectedMeal(meal)}
                  >
                    {meal.name} {meal.description && `(${meal.description})`}
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
          {selectedMeal && (
            <div className="mt-4 p-4 border rounded-md">
              <h3 className="font-semibold">Selected Meal: {selectedMeal.name}</h3>
              <p className="text-sm text-gray-600">{selectedMeal.description}</p>
              <p className="text-sm text-gray-600">Foods in this meal:</p>
              <ul className="list-disc list-inside text-sm text-gray-600">
                {selectedMeal.foods && selectedMeal.foods.length > 0 ? (
                  selectedMeal.foods.map((food, index) => (
                    <li key={index}>{food.food_name} - {food.quantity}{food.unit}</li>
                  ))
                ) : (
                  <li>No foods defined for this meal.</li>
                )}
              </ul>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={handleAddMeal} disabled={!selectedMeal}>
            <Plus className="w-4 h-4 mr-1" />
            Add Selected Meal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MealSelectionDialog;