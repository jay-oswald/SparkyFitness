import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, X, Search } from 'lucide-react';
import { useActiveUser } from '@/contexts/ActiveUserContext';
import { usePreferences } from '@/contexts/PreferencesContext';
import { toast } from '@/hooks/use-toast';
import { debug, info, warn, error } from '@/utils/logging';
import { Food, FoodVariant } from '@/types/food';
import { Meal, MealFood } from '@/types/meal'; // Assuming you'll create this type
import { createMeal, updateMeal, getMealById } from '@/services/mealService'; // Assuming you'll create this service
import { searchFoods, getFoodVariantsByFoodId } from '@/services/foodService'; // Existing food service

interface MealBuilderProps {
  mealId?: string; // Optional: if editing an existing meal
  onSave?: (meal: Meal) => void;
  onCancel?: () => void;
}

const MealBuilder: React.FC<MealBuilderProps> = ({ mealId, onSave, onCancel }) => {
  const { activeUserId } = useActiveUser();
  const { loggingLevel } = usePreferences();
  const [mealName, setMealName] = useState('');
  const [mealDescription, setMealDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [mealFoods, setMealFoods] = useState<MealFood[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Food[]>([]);
  const [selectedFoodForQuantity, setSelectedFoodForQuantity] = useState<Food | null>(null);
  const [quantityInput, setQuantityInput] = useState<number>(1);
  const [unitInput, setUnitInput] = useState<string>('');
  const [foodVariants, setFoodVariants] = useState<FoodVariant[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (mealId) {
      const fetchMeal = async () => {
        try {
          const meal = await getMealById(activeUserId!, mealId);
          if (meal) {
            setMealName(meal.name);
            setMealDescription(meal.description || '');
            setIsPublic(meal.is_public || false);
            setMealFoods(meal.foods || []);
          }
        } catch (err) {
          error(loggingLevel, 'Failed to fetch meal for editing:', err);
          toast({
            title: 'Error',
            description: 'Failed to load meal for editing.',
            variant: 'destructive',
          });
        }
      };
      fetchMeal();
    }
  }, [mealId, activeUserId, loggingLevel]);

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

  const handleAddFoodToMeal = useCallback(async (food: Food) => {
    setSelectedFoodForQuantity(food);
    setQuantityInput(1); // Default quantity
    setUnitInput(food.default_variant?.serving_unit || 'g'); // Default unit from food
    setSelectedVariantId(food.default_variant?.id);

    try {
      const variants = await getFoodVariantsByFoodId(activeUserId!, food.id);
      setFoodVariants(variants);
    } catch (err) {
      error(loggingLevel, 'Error fetching food variants:', err);
      setFoodVariants([]);
    }
  }, [activeUserId, loggingLevel]);

  const handleConfirmAddFood = useCallback(() => {
    if (selectedFoodForQuantity && quantityInput > 0 && unitInput.trim()) {
      const newMealFood: MealFood = {
        food_id: selectedFoodForQuantity.id,
        food_name: selectedFoodForQuantity.name,
        variant_id: selectedVariantId,
        quantity: quantityInput,
        unit: unitInput,
        // Add other nutritional info if needed for display in builder
      };
      setMealFoods(prev => [...prev, newMealFood]);
      setSelectedFoodForQuantity(null); // Close the quantity input
      setSearchTerm(''); // Clear search term
      setSearchResults([]); // Clear search results
      toast({
        title: 'Success',
        description: `${selectedFoodForQuantity.name} added to meal.`,
      });
    } else {
      toast({
        title: 'Warning',
        description: 'Please enter a valid quantity and unit.',
        variant: 'destructive',
      });
    }
  }, [selectedFoodForQuantity, quantityInput, unitInput, selectedVariantId, loggingLevel]);

  const handleRemoveFoodFromMeal = useCallback((index: number) => {
    setMealFoods(prev => prev.filter((_, i) => i !== index));
    toast({
      title: 'Removed',
      description: 'Food removed from meal.',
    });
  }, []);

  const handleSaveMeal = useCallback(async () => {
    if (!mealName.trim()) {
      toast({
        title: 'Error',
        description: 'Meal name cannot be empty.',
        variant: 'destructive',
      });
      return;
    }
    if (mealFoods.length === 0) {
      toast({
        title: 'Error',
        description: 'A meal must contain at least one food item.',
        variant: 'destructive',
      });
      return;
    }

    const mealData = {
      name: mealName,
      description: mealDescription,
      is_public: isPublic,
      foods: mealFoods.map(mf => ({
        food_id: mf.food_id,
        variant_id: mf.variant_id,
        quantity: mf.quantity,
        unit: mf.unit,
      })),
    };

    try {
      let resultMeal;
      if (mealId) {
        resultMeal = await updateMeal(activeUserId!, mealId, mealData);
        toast({
          title: 'Success',
          description: 'Meal updated successfully!',
        });
      } else {
        resultMeal = await createMeal(activeUserId!, mealData);
        toast({
          title: 'Success',
          description: 'Meal created successfully!',
        });
      }
      onSave?.(resultMeal);
    } catch (err) {
      error(loggingLevel, 'Error saving meal:', err);
      toast({
        title: 'Error',
        description: `Failed to save meal: ${err instanceof Error ? err.message : String(err)}`,
        variant: 'destructive',
      });
    }
  }, [mealName, mealDescription, isPublic, mealFoods, mealId, activeUserId, onSave, loggingLevel]);

  const calculateMealNutrition = useCallback(() => {
    let totalCalories = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;

    mealFoods.forEach(mf => {
      // This is a simplified calculation. In a real app, you'd fetch the full nutrition
      // for the selected variant and scale it by quantity.
      // For now, we'll assume mf.food_name is enough to identify and sum up.
      // A more robust solution would involve storing the nutritional values directly
      // in meal_foods or fetching them dynamically.
      const food = searchResults.find(f => f.id === mf.food_id);
      const variant = foodVariants.find(v => v.id === mf.variant_id) || (food ? food.default_variant : undefined) || { serving_size: 1, calories: 0, protein: 0, carbs: 0, fat: 0 };

      // Assuming mf.quantity and mf.unit are compatible with variant.serving_size and variant.serving_unit
      // This part needs careful unit conversion logic in a real application.
      // For simplicity, let's assume mf.quantity is in terms of variant.serving_size
      const scale = mf.quantity / (variant.serving_size || 1);

      totalCalories += (variant.calories || 0) * scale;
      totalProtein += (variant.protein || 0) * scale;
      totalCarbs += (variant.carbs || 0) * scale;
      totalFat += (variant.fat || 0) * scale;
    });

    return { totalCalories, totalProtein, totalCarbs, totalFat };
  }, [mealFoods, searchResults, foodVariants]);

  const { totalCalories, totalProtein, totalCarbs, totalFat } = calculateMealNutrition();

  return (
    <div className="space-y-6 pt-4">
        <div className="space-y-2">
          <Label htmlFor="mealName">Meal Name</Label>
          <Input
            id="mealName"
            value={mealName}
            onChange={(e) => setMealName(e.target.value)}
            placeholder="e.g., High Protein Breakfast"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="mealDescription">Description (Optional)</Label>
          <Input
            id="mealDescription"
            value={mealDescription}
            onChange={(e) => setMealDescription(e.target.value)}
            placeholder="e.g., My go-to morning meal"
          />
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="isPublic"
            checked={isPublic}
            onCheckedChange={(checked: boolean) => setIsPublic(checked)}
          />
          <Label htmlFor="isPublic">Share with Public</Label>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Foods in Meal</h3>
          {mealFoods.length === 0 ? (
            <p className="text-muted-foreground">No foods added to this meal yet.</p>
          ) : (
            <div className="space-y-2">
              {mealFoods.map((mf, index) => (
                <div key={index} className="flex items-center justify-between p-2 border rounded-md">
                  <span>{mf.food_name} - {mf.quantity} {mf.unit}</span>
                  <Button variant="ghost" size="icon" onClick={() => handleRemoveFoodFromMeal(index)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <div className="text-sm text-muted-foreground">
            Total Nutrition: Calories: {totalCalories.toFixed(0)}, Protein: {totalProtein.toFixed(1)}g, Carbs: {totalCarbs.toFixed(1)}g, Fat: {totalFat.toFixed(1)}g
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Add Food to Meal</h3>
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
                  <Button variant="outline" size="sm" onClick={() => handleAddFoodToMeal(food)}>
                    Add
                  </Button>
                </div>
              ))}
            </div>
          )}

          {selectedFoodForQuantity && (
            <Card className="p-4 space-y-3">
              <CardTitle className="text-md">Add {selectedFoodForQuantity.name}</CardTitle>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input
                    id="quantity"
                    type="number"
                    value={quantityInput}
                    onChange={(e) => setQuantityInput(parseFloat(e.target.value))}
                    min="0.1"
                    step="0.1"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unit">Unit</Label>
                  <Input
                    id="unit"
                    value={unitInput}
                    onChange={(e) => setUnitInput(e.target.value)}
                    placeholder="e.g., g, oz, piece"
                  />
                </div>
              </div>
              {foodVariants.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="variant">Serving Variant</Label>
                  <select
                    id="variant"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={selectedVariantId}
                    onChange={(e) => setSelectedVariantId(e.target.value)}
                  >
                    {foodVariants.map(variant => (
                      <option key={variant.id} value={variant.id}>
                        {variant.serving_size} {variant.serving_unit} ({variant.calories} kcal)
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <Button onClick={handleConfirmAddFood} className="w-full">Confirm Add</Button>
            </Card>
          )}
        </div>

        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={handleSaveMeal}>Save Meal</Button>
        </div>
    </div>
  );
};

export default MealBuilder;