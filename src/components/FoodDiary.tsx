import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, parseISO, addDays } from "date-fns"; // Import parseISO and addDays
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useActiveUser } from "@/contexts/ActiveUserContext";
import { usePreferences } from "@/contexts/PreferencesContext";
import DiaryTopControls from "./DiaryTopControls";
import MealCard from "./MealCard";
import ExerciseCard from "./ExerciseCard";
import EditFoodEntryDialog from "./EditFoodEntryDialog";
import EnhancedCustomFoodForm from "./EnhancedCustomFoodForm";
import FoodUnitSelector from "./FoodUnitSelector";
import { debug, info, warn, error } from '@/utils/logging'; // Import logging utility
import { calculateFoodEntryNutrition } from '@/utils/nutritionCalculations'; // Import the new utility function
import { toast } from "@/hooks/use-toast"; // Import toast
import {
  loadFoodEntries,
  loadGoals,
  addFoodEntry,
  removeFoodEntry,
} from '@/services/foodDiaryService';
import { Food, FoodVariant, FoodEntry } from '@/types/food';
import { ExpandedGoals } from '@/types/goals'; // Import ExpandedGoals


interface Meal {
  name: string;
  type: string;
  entries: FoodEntry[];
  targetCalories?: number;
}

interface MealTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface FoodDiaryProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
}

const FoodDiary = ({ selectedDate, onDateChange }: FoodDiaryProps) => {
  const { activeUserId } = useActiveUser();
  const { formatDate, formatDateInUserTimezone, parseDateInUserTimezone, loggingLevel } = usePreferences(); // Call usePreferences here
  debug(loggingLevel, "FoodDiary component rendered for date:", selectedDate);
  const [date, setDate] = useState<Date>(new Date(selectedDate));
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [foodEntries, setFoodEntries] = useState<FoodEntry[]>([]);
  const [editingEntry, setEditingEntry] = useState<FoodEntry | null>(null);
  const [goals, setGoals] = useState<ExpandedGoals>({
    calories: 2000, protein: 150, carbs: 250, fat: 67, water_goal: 8,
    saturated_fat: 20, polyunsaturated_fat: 10, monounsaturated_fat: 25, trans_fat: 0,
    cholesterol: 300, sodium: 2300, potassium: 3500, dietary_fiber: 25, sugars: 50,
    vitamin_a: 900, vitamin_c: 90, calcium: 1000, iron: 18,
    target_exercise_calories_burned: 0, target_exercise_duration_minutes: 0,
    protein_percentage: null, carbs_percentage: null, fat_percentage: null
  });
  const [dayTotals, setDayTotals] = useState({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [selectedMealType, setSelectedMealType] = useState<string>("");
  const [isUnitSelectorOpen, setIsUnitSelectorOpen] = useState(false);

  const currentUserId = activeUserId;
  debug(loggingLevel, "Current user ID:", currentUserId);

  useEffect(() => {
    debug(loggingLevel, "selectedDate useEffect triggered:", selectedDate);
    // Use parseDateInUserTimezone to correctly interpret the selectedDate string
    // based on the user's timezone, ensuring the date object reflects the intended calendar day.
    setDate(parseDateInUserTimezone(selectedDate));
  }, [selectedDate, parseDateInUserTimezone]); // Add parseDateInUserTimezone to dependency array

  const _calculateDayTotals = useCallback((entries: FoodEntry[]) => {
    debug(loggingLevel, "Calculating day totals for entries:", entries);
    const totals = entries.reduce((acc, entry) => {
      const entryNutrition = calculateFoodEntryNutrition(entry); // Use the already fixed calculateFoodEntryNutrition
      acc.calories += entryNutrition.calories;
      acc.protein += entryNutrition.protein;
      acc.carbs += entryNutrition.carbs;
      acc.fat += entryNutrition.fat;
      return acc;
    }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

    info(loggingLevel, "Day totals calculated:", totals);
    setDayTotals(totals);
  }, [loggingLevel]); // Dependencies for _calculateDayTotals

  const _loadFoodEntries = useCallback(async () => {
    debug(loggingLevel, "Loading food entries for date:", selectedDate);
    debug(loggingLevel, `Querying food_entries for user: ${currentUserId} and entry_date: ${selectedDate}`); // Added debug log
    try {
      const data = await loadFoodEntries(currentUserId, selectedDate); // Use imported loadFoodEntries
      info(loggingLevel, "Food entries loaded successfully:", data);
      setFoodEntries(data || []);
      _calculateDayTotals(data || []);
    } catch (err) {
      error(loggingLevel, "Error loading food entries:", err);
    }
  }, [currentUserId, selectedDate, loggingLevel, _calculateDayTotals]); // Dependencies for _loadFoodEntries

  const _loadGoals = useCallback(async () => {
    debug(loggingLevel, "Loading goals for date:", selectedDate);
    try {
      const goalData = await loadGoals(currentUserId, selectedDate); // Use imported loadGoals
      info(loggingLevel, 'Goals loaded successfully:', goalData);
      setGoals(goalData); // Directly set the ExpandedGoals object
    } catch (err) {
      error(loggingLevel, 'Error loading goals:', err);
    }
  }, [currentUserId, selectedDate, loggingLevel]); // Dependencies for _loadGoals

  useEffect(() => {
    debug(loggingLevel, "currentUserId, selectedDate, refreshTrigger useEffect triggered.", { currentUserId, selectedDate, refreshTrigger });
    if (currentUserId) {
      _loadFoodEntries();
      _loadGoals();
    }
  }, [currentUserId, selectedDate, refreshTrigger, _loadFoodEntries, _loadGoals]); // Add memoized functions to dependency array

  const getEntryNutrition = useCallback((entry: FoodEntry): MealTotals => {
    debug(loggingLevel, "Calculating entry nutrition for entry:", entry);
    const nutrition = calculateFoodEntryNutrition(entry);
    debug(loggingLevel, "Calculated nutrition for entry:", nutrition);
    return nutrition;
  }, [loggingLevel]);

  const getMealData = useCallback((mealType: string): Meal => {
    debug(loggingLevel, "Getting meal data for meal type:", mealType);
    const mealNames = {
      breakfast: "Breakfast",
      lunch: "Lunch",
      dinner: "Dinner",
      snacks: "Snacks"
    };

    const entries = foodEntries.filter(entry => entry.meal_type === mealType);
    debug(loggingLevel, `Found ${entries.length} entries for meal type ${mealType}.`);

    return {
      name: mealNames[mealType as keyof typeof mealNames] || mealType,
      type: mealType,
      entries: entries,
      targetCalories: goals.calories / 4 // Simple distribution
    };
  }, [foodEntries, goals, loggingLevel]);

  const getMealTotals = useCallback((mealType: string): MealTotals => {
    debug(loggingLevel, "Calculating meal totals for meal type:", mealType);
    const entries = foodEntries.filter(entry => entry.meal_type === mealType);
    const totals = entries.reduce((acc, entry) => {
      const entryNutrition = getEntryNutrition(entry);
      acc.calories += entryNutrition.calories;
      acc.protein += entryNutrition.protein;
      acc.carbs += entryNutrition.carbs;
      acc.fat += entryNutrition.fat;
      return acc;
    }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
    debug(loggingLevel, `Calculated totals for ${mealType}:`, totals);
    return totals;
  }, [foodEntries, getEntryNutrition, loggingLevel]);

  const handleDateSelect = useCallback((newDate: Date | undefined) => {
    debug(loggingLevel, "Handling date select:", newDate);
    if (newDate) {
      setDate(newDate);
      const dateString = formatDateInUserTimezone(newDate, 'yyyy-MM-dd'); // Use formatDateInUserTimezone
      info(loggingLevel, "Date selected:", dateString);
      onDateChange(dateString);
    }
  }, [debug, loggingLevel, setDate, formatDateInUserTimezone, info, onDateChange]);

  const handlePreviousDay = useCallback(() => {
    debug(loggingLevel, "Handling previous day button click.");
    const previousDay = new Date(date);
    previousDay.setDate(previousDay.getDate() - 1);
    handleDateSelect(previousDay);
  }, [debug, loggingLevel, date, handleDateSelect]);

  const handleNextDay = useCallback(() => {
    debug(loggingLevel, "Handling next day button click.");
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    handleDateSelect(nextDay);
  }, [debug, loggingLevel, date, handleDateSelect]);

  const handleDataChange = useCallback(() => {
    debug(loggingLevel, "Handling data change, triggering refresh.");
    setRefreshTrigger(prev => prev + 1);
  }, [debug, loggingLevel, setRefreshTrigger]);

  const handleFoodSelect = useCallback((food: Food, mealType: string) => {
    debug(loggingLevel, "Handling food select:", { food, mealType });
    setSelectedFood(food);
    setSelectedMealType(mealType);
    setIsUnitSelectorOpen(true);
  }, [debug, loggingLevel, setSelectedFood, setSelectedMealType, setIsUnitSelectorOpen]);

  const handleFoodUnitSelect = useCallback(async (food: Food, quantity: number, unit: string, variantId?: string) => {
    debug(loggingLevel, "Handling food unit select:", { food, quantity, unit, variantId });
    try {
      await addFoodEntry({
        user_id: currentUserId,
        food_id: food.id,
        meal_type: selectedMealType,
        quantity: quantity,
        unit: unit,
        variant_id: variantId,
        entry_date: formatDateInUserTimezone(parseDateInUserTimezone(selectedDate), 'yyyy-MM-dd'),
      });
      info(loggingLevel, "Food entry added successfully.");
      toast({
        title: "Success",
        description: "Food entry added successfully",
      });
      handleDataChange();
    } catch (err) {
      error(loggingLevel, "Error adding food entry:", err);
    }
  }, [debug, loggingLevel, addFoodEntry, currentUserId, selectedMealType, formatDateInUserTimezone, parseDateInUserTimezone, selectedDate, info, toast, handleDataChange, error]);

  const handleRemoveEntry = useCallback(async (entryId: string) => {
    debug(loggingLevel, "Handling remove entry:", entryId);
    try {
      await removeFoodEntry(entryId);
      info(loggingLevel, "Food entry removed successfully.");
      toast({
        title: "Success",
        description: "Food entry removed successfully",
      });
      handleDataChange();
    } catch (err) {
      error(loggingLevel, "Error removing food entry:", err);
    }
  }, [debug, loggingLevel, removeFoodEntry, info, toast, handleDataChange, error]);

  const handleEditEntry = useCallback((entry: FoodEntry) => {
    debug(loggingLevel, "Handling edit food entry:", entry);
    setEditingEntry(entry);
  }, [debug, loggingLevel, setEditingEntry]);

  const handleEditFood = useCallback((food: Food) => {
    debug(loggingLevel, "Handling edit food, triggering data change for food:", food);
    // This function is called when a food item's details are edited from within MealCard.
    // It triggers a data refresh for the entire diary.
    handleDataChange();
  }, [debug, loggingLevel, handleDataChange]);


  // Listen for global food diary refresh events
  useEffect(() => {
    debug(loggingLevel, "Setting up foodDiaryRefresh event listener.");
    const handleRefresh = () => {
      info(loggingLevel, "Received foodDiaryRefresh event, triggering refresh.");
      setRefreshTrigger(prev => prev + 1);
    };

    window.addEventListener('foodDiaryRefresh', handleRefresh);
    return () => {
      debug(loggingLevel, "Cleaning up foodDiaryRefresh event listener.");
      window.removeEventListener('foodDiaryRefresh', handleRefresh);
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Date Navigation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Food Diary</span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={handlePreviousDay}
                className="h-8 w-8"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "justify-start text-left font-normal",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? formatDate(date) : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={handleDateSelect}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              <Button
                variant="outline"
                size="icon"
                onClick={handleNextDay}
                className="h-8 w-8"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Top Controls Section */}
      <DiaryTopControls
        selectedDate={selectedDate}
        onDateChange={onDateChange}
        dayTotals={dayTotals}
        goals={goals}
        onGoalsUpdated={handleDataChange}
        refreshTrigger={refreshTrigger}
      />

      {/* Main Content - Meals and Exercise */}
      <div className="space-y-6">
        <MealCard
          meal={getMealData("breakfast")}
          totals={getMealTotals("breakfast")}
          onFoodSelect={handleFoodSelect}
          onEditEntry={handleEditEntry}
          onEditFood={handleEditFood}
          onRemoveEntry={handleRemoveEntry}
          getEntryNutrition={getEntryNutrition}
          key={`breakfast-${refreshTrigger}`}
        />
        <MealCard
          meal={getMealData("lunch")}
          totals={getMealTotals("lunch")}
          onFoodSelect={handleFoodSelect}
          onEditEntry={handleEditEntry}
          onEditFood={handleEditFood}
          onRemoveEntry={handleRemoveEntry}
          getEntryNutrition={getEntryNutrition}
          key={`lunch-${refreshTrigger}`}
        />
        <MealCard
          meal={getMealData("dinner")}
          totals={getMealTotals("dinner")}
          onFoodSelect={handleFoodSelect}
          onEditEntry={handleEditEntry}
          onEditFood={handleEditFood}
          onRemoveEntry={handleRemoveEntry}
          getEntryNutrition={getEntryNutrition}
          key={`dinner-${refreshTrigger}`}
        />
        <MealCard
          meal={getMealData("snacks")}
          totals={getMealTotals("snacks")}
          onFoodSelect={handleFoodSelect}
          onEditEntry={handleEditEntry}
          onEditFood={handleEditFood}
          onRemoveEntry={handleRemoveEntry}
          getEntryNutrition={getEntryNutrition}
          key={`snacks-${refreshTrigger}`}
        />

        {/* Exercise Section */}
        <ExerciseCard
          selectedDate={selectedDate}
          onExerciseChange={handleDataChange}
          key={`exercise-${refreshTrigger}`}
        />
      </div>

      {/* Food Unit Selector Dialog */}
      {selectedFood && (
        <FoodUnitSelector
          food={selectedFood}
          open={isUnitSelectorOpen}
          onOpenChange={setIsUnitSelectorOpen}
          onSelect={handleFoodUnitSelect}
          showUnitSelector={true}
        />
      )}

      {/* Edit Food Entry Dialog */}
      {editingEntry && (
        <EditFoodEntryDialog
          entry={editingEntry}
          open={true}
          onOpenChange={(open) => !open && setEditingEntry(null)}
          onSave={handleDataChange}
        />
      )}
    </div>
  );
};

export default FoodDiary;
