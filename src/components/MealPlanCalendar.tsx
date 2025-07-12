import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { format, addDays, subDays } from 'date-fns';
import { CalendarIcon, ChevronLeft, ChevronRight, Plus, Copy, LogIn, X, Edit, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useActiveUser } from '@/contexts/ActiveUserContext';
import { usePreferences } from '@/contexts/PreferencesContext';
import { toast } from '@/hooks/use-toast';
import { debug, info, warn, error } from '@/utils/logging';
import { Meal, MealPlanEntry } from '@/types/meal';
import { getMealPlanEntries, createMealPlanEntry, updateMealPlanEntry, deleteMealPlanEntry, logDayMealPlanToDiary } from '@/services/mealService';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import MealSelection from './MealSelection'; // Import the new component
import FoodSearch from './FoodSearch'; // To select individual foods to add (or EnhancedFoodSearch)
import { Food } from '@/types/food'; // Assuming Food type is available

interface MealPlanCalendarProps {
  // No specific props needed for now, as it manages its own state
}

const MealPlanCalendar: React.FC<MealPlanCalendarProps> = () => {
  const { activeUserId } = useActiveUser();
  const { formatDate, formatDateInUserTimezone, parseDateInUserTimezone, loggingLevel } = usePreferences();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [mealPlanEntries, setMealPlanEntries] = useState<MealPlanEntry[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isAddMealDialogOpen, setIsAddMealDialogOpen] = useState(false);
  const [showFoodSearch, setShowFoodSearch] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState<'breakfast' | 'lunch' | 'dinner' | 'snacks' | null>(null);

  const fetchMealPlanEntries = useCallback(async () => {
    if (!activeUserId) return;
    try {
      // Fetch entries for a wider range to support weekly/monthly views if implemented later
      const startOfWeek = subDays(selectedDate, selectedDate.getDay()); // Sunday
      const endOfWeek = addDays(startOfWeek, 6); // Saturday
      const entries = await getMealPlanEntries(activeUserId, formatDateInUserTimezone(startOfWeek, 'yyyy-MM-dd'), formatDateInUserTimezone(endOfWeek, 'yyyy-MM-dd'));
      setMealPlanEntries(entries);
    } catch (err) {
      error(loggingLevel, 'Failed to fetch meal plan entries:', err);
      toast({
        title: 'Error',
        description: 'Failed to load meal plan.',
        variant: 'destructive',
      });
    }
  }, [activeUserId, selectedDate, loggingLevel, formatDateInUserTimezone]);

  useEffect(() => {
    fetchMealPlanEntries();
  }, [fetchMealPlanEntries, refreshTrigger]);

  const handleDateSelect = useCallback((date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
    }
  }, []);

  const handlePreviousDay = useCallback(() => {
    setSelectedDate(prev => subDays(prev, 1));
  }, []);

  const handleNextDay = useCallback(() => {
    setSelectedDate(prev => addDays(prev, 1));
  }, []);

  const handleAddMealClick = (mealType: 'breakfast' | 'lunch' | 'dinner' | 'snacks') => {
    setSelectedMealType(mealType);
    setIsAddMealDialogOpen(true);
  };

  const handleMealSelected = useCallback(async (meal: Meal) => {
    setIsAddMealDialogOpen(false);
    if (!activeUserId || !selectedMealType) return;

    try {
      await createMealPlanEntry(activeUserId, {
        meal_id: meal.id,
        plan_date: formatDateInUserTimezone(selectedDate, 'yyyy-MM-dd'),
        meal_type: selectedMealType,
      });
      toast({ title: 'Success', description: `Meal "${meal.name}" added to plan.` });
      setRefreshTrigger(prev => prev + 1);
    } catch (err) {
      error(loggingLevel, 'Failed to add meal to plan:', err);
      toast({ title: 'Error', description: 'Failed to add meal to plan.', variant: 'destructive' });
    }
  }, [activeUserId, selectedDate, selectedMealType, loggingLevel, formatDateInUserTimezone]);

  const handleFoodSelectedForPlanning = useCallback((food: Food) => {
    setShowFoodSearch(false);
    // Prompt for quantity/unit, then create meal plan entry
    const createEntry = async () => {
      if (!activeUserId || !selectedMealType || !food.default_variant) return;
      try {
        await createMealPlanEntry(activeUserId, {
          food_id: food.id,
          variant_id: food.default_variant.id,
          quantity: 1, // Default quantity, user can edit later
          unit: food.default_variant.serving_unit,
          plan_date: formatDateInUserTimezone(selectedDate, 'yyyy-MM-dd'),
          meal_type: selectedMealType,
        });
        toast({ title: 'Success', description: `Food "${food.name}" added to plan.` });
        setRefreshTrigger(prev => prev + 1);
      } catch (err) {
        error(loggingLevel, 'Failed to add food to plan:', err);
        toast({ title: 'Error', description: 'Failed to add food to plan.', variant: 'destructive' });
      }
    };
    createEntry();
  }, [activeUserId, selectedDate, selectedMealType, loggingLevel, formatDateInUserTimezone]);

  const handleDeletePlanEntry = useCallback(async (planId: string) => {
    if (!activeUserId || !window.confirm('Are you sure you want to remove this item from your plan?')) return;
    try {
      await deleteMealPlanEntry(activeUserId, planId);
      toast({ title: 'Success', description: 'Item removed from plan.' });
      setRefreshTrigger(prev => prev + 1); // Refresh the view
    } catch (err) {
      error(loggingLevel, 'Failed to delete meal plan entry:', err);
      toast({ title: 'Error', description: 'Failed to remove item from plan.', variant: 'destructive' });
    }
  }, [activeUserId, loggingLevel]);

  const handleEditPlanEntry = useCallback(async (entry: MealPlanEntry) => {
    if (!activeUserId) return;
    // First, delete the existing entry optimistically
    try {
      await deleteMealPlanEntry(activeUserId, entry.id!);
      setRefreshTrigger(prev => prev + 1);
      
      // Then, open the dialog to add a new one in its place
      handleAddMealClick(entry.meal_type as 'breakfast' | 'lunch' | 'dinner' | 'snacks');
    } catch (err) {
      error(loggingLevel, 'Failed to initiate edit for meal plan entry:', err);
      toast({ title: 'Error', description: 'Could not start edit process.', variant: 'destructive' });
      setRefreshTrigger(prev => prev + 1); // Refresh to show the original item again if delete failed
    }
  }, [activeUserId, loggingLevel]);

  const handleLogDayToDiary = useCallback(async () => {
    if (!activeUserId) return;
    try {
      await logDayMealPlanToDiary(activeUserId, formatDateInUserTimezone(selectedDate, 'yyyy-MM-dd'));
      toast({ title: 'Success', description: 'Day\'s meal plan logged to diary.' });
      // Optionally, trigger a refresh of the FoodDiary component
      window.dispatchEvent(new Event('foodDiaryRefresh'));
    } catch (err) {
      error(loggingLevel, 'Failed to log day meal plan to diary:', err);
      toast({ title: 'Error', description: 'Failed to log day\'s meal plan to diary.', variant: 'destructive' });
    }
  }, [activeUserId, selectedDate, loggingLevel, formatDateInUserTimezone]);

  const handleCopyDayPlan = useCallback(async () => {
    if (!activeUserId) return;
    const targetDate = prompt('Enter target date (YYYY-MM-DD) to copy this day\'s plan to:');
    if (targetDate) {
      try {
        await logDayMealPlanToDiary(activeUserId, formatDateInUserTimezone(selectedDate, 'yyyy-MM-dd'), targetDate);
        toast({ title: 'Success', description: `Day's meal plan copied to ${targetDate}.` });
        setRefreshTrigger(prev => prev + 1); // Refresh calendar to show copied entries
      } catch (err) {
        error(loggingLevel, 'Failed to copy day meal plan:', err);
        toast({ title: 'Error', description: 'Failed to copy day\'s meal plan.', variant: 'destructive' });
      }
    }
  }, [activeUserId, selectedDate, loggingLevel, formatDateInUserTimezone]);

  const getMealPlanEntriesForDate = (date: Date) => {
    const dateString = formatDateInUserTimezone(date, 'yyyy-MM-dd');
    if (!Array.isArray(mealPlanEntries)) {
      return [];
    }
    // The plan_date from the backend might be a full ISO string (e.g., "2025-07-11T00:00:00.000Z").
    // We must ensure we only compare the date part.
    return mealPlanEntries.filter(entry => entry.plan_date && entry.plan_date.startsWith(dateString));
  };

  const renderMealPlanSection = (mealType: 'breakfast' | 'lunch' | 'dinner' | 'snacks') => {
    const entries = getMealPlanEntriesForDate(selectedDate).filter(entry => entry.meal_type === mealType);
    return (
      <Card key={mealType}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg font-semibold capitalize">{mealType}</CardTitle>
          <Button variant="ghost" size="icon" onClick={() => handleAddMealClick(mealType)}>
            <Plus className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-muted-foreground text-sm">No planned items.</p>
          ) : (
            <div className="space-y-2">
              {entries.map(entry => (
                <div key={entry.id} className="flex items-center justify-between text-sm border-b pb-1">
                  <span>{entry.meal_name || entry.food_name}</span>
                  <div className="flex items-center space-x-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEditPlanEntry(entry)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Replace Entry</p>
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDeletePlanEntry(entry.id!)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Delete Entry</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
            <span>Meal Plan</span>
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
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? formatDate(selectedDate) : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
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
        <CardContent className="flex justify-end space-x-2">
          <Button onClick={handleCopyDayPlan} variant="outline">
            <Copy className="h-4 w-4 mr-2" /> Copy Day Plan
          </Button>
          <Button onClick={handleLogDayToDiary}>
            <LogIn className="h-4 w-4 mr-2" /> Log Day to Diary
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {renderMealPlanSection('breakfast')}
        {renderMealPlanSection('lunch')}
        {renderMealPlanSection('dinner')}
        {renderMealPlanSection('snacks')}
      </div>

      <Dialog open={isAddMealDialogOpen} onOpenChange={setIsAddMealDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Meal to {selectedMealType ? selectedMealType.charAt(0).toUpperCase() + selectedMealType.slice(1) : ''}</DialogTitle>
            <DialogDescription>
              Select a meal from your library to add to the plan.
            </DialogDescription>
          </DialogHeader>
          <MealSelection onMealSelect={handleMealSelected} />
        </DialogContent>
      </Dialog>

      {showFoodSearch && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <FoodSearch
            onFoodSelect={handleFoodSelectedForPlanning}
            // You might need to pass a prop to close the search
          />
          <Button
            className="absolute top-4 right-4"
            variant="ghost"
            size="icon"
            onClick={() => setShowFoodSearch(false)}
          >
            <X className="h-6 w-6" />
          </Button>
        </div>
      )}
    </div>
    </TooltipProvider>
  );
};

export default MealPlanCalendar;