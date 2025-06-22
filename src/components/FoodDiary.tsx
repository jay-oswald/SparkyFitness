import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveUser } from "@/contexts/ActiveUserContext";
import { usePreferences } from "@/contexts/PreferencesContext";
import DiaryTopControls from "./DiaryTopControls";
import MealCard from "./MealCard";
import ExerciseCard from "./ExerciseCard";
import EditFoodEntryDialog from "./EditFoodEntryDialog";
import EnhancedCustomFoodForm from "./EnhancedCustomFoodForm";
import FoodUnitSelector from "./FoodUnitSelector";
import { debug, info, warn, error } from '@/utils/logging'; // Import logging utility

interface Food {
  id: string;
  name: string;
  brand?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  serving_size: number;
  serving_unit: string;
  user_id?: string;
}

interface FoodEntry {
  id: string;
  food_id: string;
  meal_type: string;
  quantity: number;
  unit: string;
  variant_id?: string;
  foods: Food;
}

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
  const { user } = useAuth();
  const { activeUserId } = useActiveUser();
  const { formatDate, formatDateInUserTimezone, loggingLevel } = usePreferences(); // Call usePreferences here
  debug(loggingLevel, "FoodDiary component rendered for date:", selectedDate);
  const [date, setDate] = useState<Date>(new Date(selectedDate));
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [foodEntries, setFoodEntries] = useState<FoodEntry[]>([]);
  const [editingEntry, setEditingEntry] = useState<FoodEntry | null>(null);
  const [goals, setGoals] = useState({ calories: 2000, protein: 150, carbs: 250, fat: 67 });
  const [dayTotals, setDayTotals] = useState({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [selectedMealType, setSelectedMealType] = useState<string>("");
  const [isUnitSelectorOpen, setIsUnitSelectorOpen] = useState(false);

  const currentUserId = activeUserId || user?.id;
  debug(loggingLevel, "Current user ID:", currentUserId);

  useEffect(() => {
    debug(loggingLevel, "selectedDate useEffect triggered:", selectedDate);
    setDate(new Date(selectedDate));
  }, [selectedDate]);

  useEffect(() => {
    debug(loggingLevel, "currentUserId, selectedDate, refreshTrigger useEffect triggered.", { currentUserId, selectedDate, refreshTrigger });
    if (currentUserId) {
      loadFoodEntries();
      loadGoals();
    }
  }, [currentUserId, selectedDate, refreshTrigger]);

  const loadFoodEntries = async () => {
    debug(loggingLevel, "Loading food entries for date:", selectedDate);
    try {
      const { data, error: supabaseError } = await supabase
        .from('food_entries')
        .select(`
          *,
          foods (*)
        `)
        .eq('user_id', currentUserId)
        .eq('entry_date', selectedDate);

      if (supabaseError) {
        error(loggingLevel, "Error loading food entries:", supabaseError);
      } else {
        info(loggingLevel, "Food entries loaded successfully:", data);
        setFoodEntries(data || []);
        calculateDayTotals(data || []);
      }
    } catch (err) {
      error(loggingLevel, "Error loading food entries:", err);
    }
  };

  const loadGoals = async () => {
    debug(loggingLevel, "Loading goals for date:", selectedDate);
    try {
      const { data, error: supabaseError } = await supabase.rpc('get_goals_for_date', {
        p_user_id: currentUserId,
        p_date: selectedDate
      });

      if (supabaseError) {
        error(loggingLevel, 'Error loading goals:', supabaseError);
      } else if (data && data.length > 0) {
        info(loggingLevel, 'Goals loaded successfully:', data[0]);
        const goalData = data[0];
        setGoals({
          calories: goalData.calories || 2000,
          protein: goalData.protein || 150,
          carbs: goalData.carbs || 250,
          fat: goalData.fat || 67,
        });
      } else {
        info(loggingLevel, 'No goals found for the selected date, using defaults.');
      }
    } catch (err) {
      error(loggingLevel, 'Error loading goals:', err);
    }
  };

  const calculateDayTotals = (entries: FoodEntry[]) => {
    debug(loggingLevel, "Calculating day totals for entries:", entries);
    const totals = entries.reduce((acc, entry) => {
      const food = entry.foods;
      if (!food) return acc;

      const servingSize = food.serving_size || 100;
      const ratio = entry.quantity / servingSize;

      acc.calories += (food.calories || 0) * ratio;
      acc.protein += (food.protein || 0) * ratio;
      acc.carbs += (food.carbs || 0) * ratio;
      acc.fat += (food.fat || 0) * ratio;

      return acc;
    }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

    info(loggingLevel, "Day totals calculated:", totals);
    setDayTotals(totals);
  };

  const handleDateSelect = (newDate: Date | undefined) => {
    debug(loggingLevel, "Handling date select:", newDate);
    if (newDate) {
      setDate(newDate);
      const dateString = formatDateInUserTimezone(newDate, 'yyyy-MM-dd'); // Use formatDateInUserTimezone
      info(loggingLevel, "Date selected:", dateString);
      onDateChange(dateString);
    }
  };

  const handlePreviousDay = () => {
    debug(loggingLevel, "Handling previous day button click.");
    const previousDay = new Date(date);
    previousDay.setDate(previousDay.getDate() - 1);
    handleDateSelect(previousDay);
  };

  const handleNextDay = () => {
    debug(loggingLevel, "Handling next day button click.");
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    handleDateSelect(nextDay);
  };

  const handleDataChange = () => {
    debug(loggingLevel, "Handling data change, triggering refresh.");
    setRefreshTrigger(prev => prev + 1);
  };

  const handleFoodSelect = (food: Food, mealType: string) => {
    debug(loggingLevel, "Handling food select:", { food, mealType });
    setSelectedFood(food);
    setSelectedMealType(mealType);
    setIsUnitSelectorOpen(true);
  };

  const handleFoodUnitSelect = async (food: Food, quantity: number, unit: string, variantId?: string) => {
    debug(loggingLevel, "Handling food unit select:", { food, quantity, unit, variantId });
    try {
      const { error: supabaseError } = await supabase
        .from('food_entries')
        .insert([
          {
            user_id: currentUserId,
            food_id: food.id,
            meal_type: selectedMealType,
            quantity: quantity,
            unit: unit,
            variant_id: variantId,
            entry_date: formatDateInUserTimezone(new Date(selectedDate), 'yyyy-MM-dd'), // Ensure date is in user's timezone
          },
        ]);

      if (supabaseError) {
        error(loggingLevel, "Error adding food entry:", supabaseError);
      } else {
        info(loggingLevel, "Food entry added successfully.");
        handleDataChange();
      }
    } catch (err) {
      error(loggingLevel, "Error adding food entry:", err);
    }
  };

  const handleRemoveEntry = async (entryId: string) => {
    debug(loggingLevel, "Handling remove entry:", entryId);
    try {
      const { error: supabaseError } = await supabase
        .from('food_entries')
        .delete()
        .eq('id', entryId);

      if (supabaseError) {
        error(loggingLevel, "Error removing food entry:", supabaseError);
      } else {
        info(loggingLevel, "Food entry removed successfully.");
        handleDataChange();
      }
    } catch (err) {
      error(loggingLevel, "Error removing food entry:", err);
    }
  };

  const handleEditFood = (entry: FoodEntry) => {
    debug(loggingLevel, "Handling edit food entry:", entry);
    // This will trigger the data refresh when the nutrition form is used
    handleDataChange();
  };

  const getEntryNutrition = (entry: FoodEntry): MealTotals => {
    debug(loggingLevel, "Calculating entry nutrition for entry:", entry);
    const food = entry.foods;
    if (!food) {
      warn(loggingLevel, "Food data missing for entry:", entry);
      return { calories: 0, protein: 0, carbs: 0, fat: 0 };
    }

    // Fix: Calculate ratio based on quantity vs serving_size, not just multiply by quantity
    const servingSize = food.serving_size || 100;
    const ratio = entry.quantity / servingSize;
    debug(loggingLevel, "Calculated ratio:", ratio);

    const nutrition = {
      calories: (food.calories || 0) * ratio,
      protein: (food.protein || 0) * ratio,
      carbs: (food.carbs || 0) * ratio,
      fat: (food.fat || 0) * ratio,
    };
    debug(loggingLevel, "Calculated nutrition for entry:", nutrition);
    return nutrition;
  };

  const getMealData = (mealType: string): Meal => {
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
  };

  const getMealTotals = (mealType: string): MealTotals => {
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
  };

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
          onEditEntry={setEditingEntry}
          onEditFood={handleEditFood}
          onRemoveEntry={handleRemoveEntry}
          getEntryNutrition={getEntryNutrition}
          key={`breakfast-${refreshTrigger}`}
        />
        <MealCard
          meal={getMealData("lunch")}
          totals={getMealTotals("lunch")}
          onFoodSelect={handleFoodSelect}
          onEditEntry={setEditingEntry}
          onEditFood={handleEditFood}
          onRemoveEntry={handleRemoveEntry}
          getEntryNutrition={getEntryNutrition}
          key={`lunch-${refreshTrigger}`}
        />
        <MealCard
          meal={getMealData("dinner")}
          totals={getMealTotals("dinner")}
          onFoodSelect={handleFoodSelect}
          onEditEntry={setEditingEntry}
          onEditFood={handleEditFood}
          onRemoveEntry={handleRemoveEntry}
          getEntryNutrition={getEntryNutrition}
          key={`dinner-${refreshTrigger}`}
        />
        <MealCard
          meal={getMealData("snacks")}
          totals={getMealTotals("snacks")}
          onFoodSelect={handleFoodSelect}
          onEditEntry={setEditingEntry}
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
