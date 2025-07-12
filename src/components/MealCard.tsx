import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Settings } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import EnhancedFoodSearch from "./EnhancedFoodSearch";
import EnhancedCustomFoodForm from "./EnhancedCustomFoodForm";
import MealSelectionDialog from "./MealSelectionDialog"; // Import MealSelectionDialog
import { usePreferences } from "@/contexts/PreferencesContext"; // Import usePreferences
import { debug, info, warn, error } from '@/utils/logging'; // Import logging utility

import { Food, FoodVariant, FoodEntry } from '@/types/food';

import { Meal as MealType } from '@/types/meal'; // Import MealType from types/meal.d.ts

interface Meal extends MealType { // Extend the imported MealType
  type: string;
  entries: FoodEntry[];
  targetCalories?: number;
  selectedDate: string; // Add selectedDate to Meal interface
}

interface MealTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface MealCardProps {
  meal: Meal;
  totals: MealTotals;
  onFoodSelect: (food: Food, mealType: string) => void;
  onEditEntry: (entry: FoodEntry) => void;
  onEditFood: (food: Food) => void;
  onRemoveEntry: (entryId: string) => void;
  getEntryNutrition: (entry: FoodEntry) => MealTotals;
  onMealAdded: () => void; // Add onMealAdded to MealCardProps
}

const MealCard = ({
  meal,
  totals,
  onFoodSelect,
  onEditEntry,
  onEditFood,
  onRemoveEntry,
  getEntryNutrition,
  onMealAdded
}: MealCardProps) => {
  const { user } = useAuth();
  const { loggingLevel } = usePreferences(); // Get logging level
  debug(loggingLevel, "MealCard: Component rendered for meal:", meal.name);
  const [editingFoodEntry, setEditingFoodEntry] = useState<FoodEntry | null>(null);

  const handleEditFood = (entry: FoodEntry) => {
    debug(loggingLevel, "MealCard: Handling edit food for entry:", entry.id);
    setEditingFoodEntry(entry);
  };

  const handleSaveFood = () => {
    debug(loggingLevel, "MealCard: Handling save food.");
    // Close the dialog and trigger refresh
    setEditingFoodEntry(null);
    onEditFood(editingFoodEntry!.foods); // Pass the Food object
    info(loggingLevel, "MealCard: Food saved and refresh triggered.");
  };

  const handleCancelFood = () => {
    debug(loggingLevel, "MealCard: Handling cancel food.");
    setEditingFoodEntry(null);
    info(loggingLevel, "MealCard: Food edit cancelled.");
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-lg sm:text-xl">{meal.name}</CardTitle>
            <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 sm:gap-4">
              {meal.targetCalories && (
                <span className="text-xs sm:text-sm text-gray-500">
                  {Math.round(totals.calories)} / {meal.targetCalories} cal
                </span>
              )}
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" onClick={() => debug(loggingLevel, `MealCard: Add Food button clicked for ${meal.name}.`)}>
                    <Plus className="w-4 h-4 mr-1" />
                    Add Food
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Add Food to {meal.name}</DialogTitle>
                    <DialogDescription>
                      Search for foods to add to your {meal.name.toLowerCase()}.
                    </DialogDescription>
                  </DialogHeader>
                  <EnhancedFoodSearch
                    onFoodSelect={(food) => {
                      debug(loggingLevel, "MealCard: Food selected in search:", food);
                      onFoodSelect(food, meal.type);
                    }}
                  />
                </DialogContent>
              </Dialog>
              <MealSelectionDialog
                mealType={meal.type}
                selectedDate={meal.selectedDate}
                onMealAdded={onMealAdded}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {meal.entries.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No foods added yet
            </div>
          ) : (
            <div className="space-y-3">
              {meal.entries.map((entry) => {
                const food = entry.foods;
                const entryNutrition = getEntryNutrition(entry);
                const isFromMealPlan = !!entry.meal_plan_template_id; // Corrected property name

                // Handle case where food data is missing
                if (!food) {
                  warn(loggingLevel, 'MealCard: Missing food data for entry:', entry.id);
                  return (
                    <div key={entry.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg gap-4">
                      <div className="flex-1">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-1">
                          <span className="font-medium text-red-600">Food data missing</span>
                          <span className="text-sm text-gray-500">
                            {entry.quantity} {entry.unit}
                          </span>
                        </div>
                        <div className="text-sm text-red-500">
                          This food entry has missing data. Please remove and re-add.
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            debug(loggingLevel, "MealCard: Remove missing food entry button clicked:", entry.id);
                            onRemoveEntry(entry.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={entry.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg gap-4">
                    <div className="flex-1">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-1">
                        <span className="font-medium">{food.name}</span>
                        {food.brand && (
                          <Badge variant="secondary" className="text-xs w-fit">
                            {food.brand}
                          </Badge>
                        )}
                        <span className="text-sm text-gray-500">
                          {entry.quantity} {entry.unit}
                        </span>
                        {isFromMealPlan && (
                          <Badge variant="outline" className="text-xs w-fit">
                            From Plan
                          </Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                        <div>
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            {Math.round(entryNutrition.calories)}
                          </span> cal
                        </div>
                        <div>
                          <span className="font-medium text-blue-600">
                            {entryNutrition.protein.toFixed(1)}g
                          </span> protein
                        </div>
                        <div>
                          <span className="font-medium text-orange-600">
                            {entryNutrition.carbs.toFixed(1)}g
                          </span> carbs
                        </div>
                        <div>
                          <span className="font-medium text-yellow-600">
                            {entryNutrition.fat.toFixed(1)}g
                          </span> fat
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          debug(loggingLevel, "MealCard: Edit entry button clicked:", entry.id);
                          onEditEntry(entry);
                        }}
                        title="Edit entry"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      {food.user_id === user?.id && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            debug(loggingLevel, "MealCard: Edit food details button clicked:", food.id);
                            handleEditFood(entry);
                          }}
                          title="Edit food details"
                        >
                          <Settings className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          debug(loggingLevel, "MealCard: Remove entry button clicked:", entry.id);
                          onRemoveEntry(entry.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}

              <Separator />

              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pt-2 gap-4">
                <span className="font-semibold">{meal.name} Total:</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 text-xs sm:text-sm">
                  <div className="text-center">
                    <div className="font-bold text-gray-900 dark:text-gray-100">{Math.round(totals.calories)}</div>
                    <div className="text-xs text-gray-500">cal</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-blue-600">{totals.protein.toFixed(1)}g</div>
                    <div className="text-xs text-gray-500">protein</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-orange-600">{totals.carbs.toFixed(1)}g</div>
                    <div className="text-xs text-gray-500">carbs</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-yellow-600">{totals.fat.toFixed(1)}g</div>
                    <div className="text-xs text-gray-500">fat</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Food Database Dialog */}
      {editingFoodEntry && (
        <Dialog open={true} onOpenChange={(open) => !open && setEditingFoodEntry(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Food Database</DialogTitle>
              <DialogDescription>
                Edit the nutritional information for this food in your database.
              </DialogDescription>
            </DialogHeader>
            <EnhancedCustomFoodForm
              food={editingFoodEntry.foods}
              onSave={handleSaveFood}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default MealCard;
