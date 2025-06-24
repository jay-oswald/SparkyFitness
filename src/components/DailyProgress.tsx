
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Target, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveUser } from "@/contexts/ActiveUserContext";
import { usePreferences } from "@/contexts/PreferencesContext";
import { debug, info, warn, error } from '@/utils/logging';
import { format, parseISO, addDays } from 'date-fns'; // Import format, parseISO, and addDays from date-fns

interface DailyProgressProps {
  selectedDate: string;
  refreshTrigger?: number;
}

const DailyProgress = ({ selectedDate, refreshTrigger }: DailyProgressProps) => {
 const { user } = useAuth();
 const { activeUserId } = useActiveUser();
 const { loggingLevel } = usePreferences();
 debug(loggingLevel, "DailyProgress: Component rendered for date:", selectedDate);

 const [dailyGoals, setDailyGoals] = useState({
   calories: 2000,
   protein: 150,
   carbs: 250,
   fat: 67,
 });
 const [dailyIntake, setDailyIntake] = useState({
   calories: 0,
   protein: 0,
   carbs: 0,
   fat: 0,
 });
 const [exerciseCalories, setExerciseCalories] = useState(0);
 const [stepsCalories, setStepsCalories] = useState(0);
 const [dailySteps, setDailySteps] = useState(0);
 const [loading, setLoading] = useState(true);

 const currentUserId = activeUserId || user?.id;
 debug(loggingLevel, "DailyProgress: Current user ID:", currentUserId);

 useEffect(() => {
   debug(loggingLevel, "DailyProgress: currentUserId, selectedDate, refreshTrigger useEffect triggered.", { currentUserId, selectedDate, refreshTrigger });
   if (currentUserId) {
     loadGoalsAndIntake();
   }
 }, [currentUserId, selectedDate, refreshTrigger, loggingLevel]);

 // Convert steps to calories (roughly 0.04 calories per step for average person)
 const convertStepsToCalories = (steps: number): number => {
   debug(loggingLevel, "DailyProgress: Converting steps to calories:", steps);
   return Math.round(steps * 0.04);
 };

 const loadGoalsAndIntake = async () => {
   info(loggingLevel, "DailyProgress: Loading goals and intake for date:", selectedDate);
   try {
     setLoading(true);
     
     // Use the database function to get goals for the selected date
     debug(loggingLevel, "DailyProgress: Fetching goals...");
     const { data: goalsData, error: goalsError } = await supabase.rpc('get_goals_for_date', {
       p_user_id: currentUserId,
       p_date: selectedDate // p_date is a DATE type, so pass the YYYY-MM-DD string directly
     });

     if (goalsError) {
       error(loggingLevel, 'DailyProgress: Error loading goals:', goalsError);
     } else if (goalsData && goalsData.length > 0) {
       info(loggingLevel, 'DailyProgress: Goals loaded successfully:', goalsData[0]);
       const goalData = goalsData[0];
       setDailyGoals({
         calories: goalData.calories || 2000,
         protein: goalData.protein || 150,
         carbs: goalData.carbs || 250,
         fat: goalData.fat || 67,
       });
     } else {
       info(loggingLevel, 'DailyProgress: No goals found for the selected date, using defaults.');
     }

     // Load daily intake from food entries
     debug(loggingLevel, "DailyProgress: Fetching food entries for intake calculation...");
     const { data: entriesData, error: entriesError } = await supabase
       .from('food_entries')
       .select(`
         quantity,
         unit,
         foods (
           calories,
           protein,
           carbs,
           fat,
           serving_size,
           serving_unit
         ),
         food_variants (
           calories,
           protein,
           carbs,
           fat,
           serving_size,
           serving_unit
         )
       `)
       .eq('user_id', currentUserId)
       .gte('entry_date', selectedDate) // Start of the selected day
       .lt('entry_date', addDays(parseISO(selectedDate), 1).toISOString().split('T')[0]); // Start of the next day

     if (entriesError) {
       error(loggingLevel, 'DailyProgress: Error loading food entries for intake:', entriesError);
     } else if (entriesData) {
       info(loggingLevel, `DailyProgress: Fetched ${entriesData.length} food entries for intake.`);
       const totals = entriesData.reduce((acc, entry) => {
         const food = entry.foods;
         const variant = entry.food_variants;

         if (!food) {
           warn(loggingLevel, "DailyProgress: Missing food data for intake entry:", entry);
           return acc;
         }

         let caloriesPerUnit = food.calories || 0;
         let proteinPerUnit = food.protein || 0;
         let carbsPerUnit = food.carbs || 0;
         let fatPerUnit = food.fat || 0;
         let baseServingSize = food.serving_size || 100;

         if (variant) {
           if (variant.calories !== null && variant.calories !== undefined &&
               variant.protein !== null && variant.protein !== undefined &&
               variant.carbs !== null && variant.carbs !== undefined &&
               variant.fat !== null && variant.fat !== undefined) {
             caloriesPerUnit = variant.calories;
             proteinPerUnit = variant.protein;
             carbsPerUnit = variant.carbs;
             fatPerUnit = variant.fat;
             baseServingSize = variant.serving_size;
           } else {
             const ratio = variant.serving_size / (food.serving_size || 100);
             caloriesPerUnit = (food.calories || 0) * ratio;
             proteinPerUnit = (food.protein || 0) * ratio;
             carbsPerUnit = (food.carbs || 0) * ratio;
             fatPerUnit = (food.fat || 0) * ratio;
             baseServingSize = variant.serving_size;
           }
         }

         const ratio = entry.quantity / baseServingSize;

         acc.calories += caloriesPerUnit * ratio;
         acc.protein += proteinPerUnit * ratio;
         acc.carbs += carbsPerUnit * ratio;
         acc.fat += fatPerUnit * ratio;

         return acc;
       }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

       info(loggingLevel, "DailyProgress: Daily intake calculated:", totals);
       setDailyIntake({
         calories: Math.round(totals.calories),
         protein: Math.round(totals.protein),
         carbs: Math.round(totals.carbs),
         fat: Math.round(totals.fat),
       });
     }

     // Load exercise calories burned
     debug(loggingLevel, "DailyProgress: Fetching exercise entries...");
     const { data: exerciseData, error: exerciseError } = await supabase
       .from('exercise_entries')
       .select('calories_burned')
       .eq('user_id', currentUserId)
       .gte('entry_date', selectedDate) // Start of the selected day
       .lt('entry_date', addDays(parseISO(selectedDate), 1).toISOString().split('T')[0]); // Start of the next day

     if (exerciseError) {
       error(loggingLevel, 'DailyProgress: Error loading exercise entries:', exerciseError);
     } else if (exerciseData) {
       info(loggingLevel, `DailyProgress: Fetched ${exerciseData.length} exercise entries.`);
       const totalExerciseCalories = exerciseData.reduce((sum, entry) => sum + entry.calories_burned, 0);
       info(loggingLevel, "DailyProgress: Total exercise calories burned:", totalExerciseCalories);
       setExerciseCalories(totalExerciseCalories);
     } else {
       info(loggingLevel, "DailyProgress: No exercise entries found.");
       setExerciseCalories(0);
     }

     // Load daily steps from body measurements
     debug(loggingLevel, "DailyProgress: Fetching daily steps...");
     const { data: stepsData, error: stepsError } = await supabase
       .from('check_in_measurements')
       .select('steps')
       .eq('user_id', currentUserId)
       .gte('entry_date', selectedDate) // Start of the selected day
       .lt('entry_date', addDays(parseISO(selectedDate), 1).toISOString().split('T')[0]); // Start of the next day

     if (stepsError) {
       error(loggingLevel, 'DailyProgress: Error loading daily steps:', stepsError);
     } else if (stepsData && stepsData.length > 0 && stepsData[0].steps) {
       error(loggingLevel, 'DailyProgress: Error loading daily steps:', stepsError);
     } else if (stepsData && stepsData.length > 0 && stepsData[0].steps) {
       info(loggingLevel, "DailyProgress: Daily steps loaded:", stepsData[0].steps);
       setDailySteps(stepsData[0].steps);
       const stepsCaloriesBurned = convertStepsToCalories(stepsData[0].steps);
       info(loggingLevel, "DailyProgress: Calories burned from steps:", stepsCaloriesBurned);
       setStepsCalories(stepsCaloriesBurned);
     } else {
       info(loggingLevel, "DailyProgress: No daily steps found.");
       setDailySteps(0);
       setStepsCalories(0);
     }
     info(loggingLevel, "DailyProgress: Goals and intake loaded successfully.");
   } catch (error) {
     error(loggingLevel, 'DailyProgress: Error in loadGoalsAndIntake:', error);
   } finally {
     setLoading(false);
     debug(loggingLevel, "DailyProgress: Loading state set to false.");
   }
 };

 if (loading) {
   debug(loggingLevel, "DailyProgress: Displaying loading message.");
   return <div>Loading daily progress...</div>;
 }

 // Calculate net calories (food calories - exercise calories - steps calories)
 const totalCaloriesBurned = Math.round(exerciseCalories) + stepsCalories;
 const netCalories = Math.round(dailyIntake.calories) - totalCaloriesBurned;
 const caloriesRemaining = dailyGoals.calories - netCalories;
 const calorieProgress = Math.max(0, (netCalories / dailyGoals.calories) * 100);
 debug(loggingLevel, "DailyProgress: Calculated progress values:", { totalCaloriesBurned, netCalories, caloriesRemaining, calorieProgress });

 info(loggingLevel, "DailyProgress: Rendering daily progress card.");
 return (
   <Card className="h-full">
     <CardHeader className="pb-2">
       <CardTitle className="flex items-center space-x-2 text-base">
         <Target className="w-4 h-4 text-green-500" />
         <span>Daily Calorie Goal</span>
       </CardTitle>
     </CardHeader>
     <CardContent className="pb-4">
       <div className="space-y-4">
         {/* Calorie Circle - Reduced size */}
         <div className="flex items-center justify-center">
           <div className="relative w-32 h-32">
             <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 36 36">
               <path
                 className="text-gray-200"
                 stroke="currentColor"
                 strokeWidth="3"
                 fill="transparent"
                 d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
               />
               <path
                 className="text-green-500"
                 stroke="currentColor"
                 strokeWidth="3"
                 fill="transparent"
                 strokeDasharray={`${Math.min(calorieProgress, 100)}, 100`}
                 d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
               />
             </svg>
             <div className="absolute inset-0 flex flex-col items-center justify-center">
               <div className="text-xl font-bold text-gray-900 dark:text-gray-50">{Math.round(caloriesRemaining)}</div>
               <div className="text-xs text-gray-500 dark:text-gray-400">remaining</div>
             </div>
           </div>
         </div>

         {/* Calorie Breakdown - Compact */}
         <div className="grid grid-cols-3 gap-2 text-center text-sm">
           <div className="space-y-1">
             <div className="text-lg font-bold text-green-600">{Math.round(dailyIntake.calories)}</div>
             <div className="text-xs text-gray-500">eaten</div>
           </div>
           <div className="space-y-1">
             <div className="text-lg font-bold text-orange-600">{totalCaloriesBurned}</div>
             <div className="text-xs text-gray-500">burned</div>
           </div>
           <div className="space-y-1">
             <div className="text-lg font-bold text-gray-900">{dailyGoals.calories}</div>
             <div className="text-xs text-gray-500">goal</div>
           </div>
         </div>

         {/* Calories Burned Breakdown - More compact */}
         {(exerciseCalories > 0 || stepsCalories > 0) && (
           <div className="text-center p-2 bg-blue-50 rounded-lg space-y-1">
             <div className="text-sm font-medium text-blue-700">
               Calories Burned Breakdown
             </div>
             {exerciseCalories > 0 && (
               <div className="text-xs text-blue-600">
                 Exercise: {Math.round(exerciseCalories)} cal
               </div>
             )}
             {stepsCalories > 0 && (
               <div className="text-xs text-blue-600 flex items-center justify-center gap-1">
                 <Zap className="w-3 h-3" />
                 Steps: {dailySteps.toLocaleString()} = {stepsCalories} cal
               </div>
             )}
           </div>
         )}

         {/* Net Calories Display - Compact */}
         <div className="text-center p-2 bg-gray-50 rounded-lg">
           <div className="text-sm font-medium text-gray-700">
             Net Calories: {Math.round(netCalories)}
           </div>
           <div className="text-xs text-gray-600">
             {Math.round(dailyIntake.calories)} eaten - {totalCaloriesBurned} burned
           </div>
         </div>

         {/* Progress Bar - Compact */}
         <div className="space-y-1">
           <div className="flex justify-between text-xs">
             <span>Daily Progress</span>
             <span>{Math.round(calorieProgress)}%</span>
           </div>
           <Progress value={calorieProgress} className="h-2" />
         </div>
       </div>
     </CardContent>
   </Card>
 );
};

export default DailyProgress;
