import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveUser } from "@/contexts/ActiveUserContext";
import { TrendingUp } from "lucide-react";
import { parseISO, subDays, addDays, format } from "date-fns"; // Import parseISO, subDays, addDays, format
import { usePreferences } from "@/contexts/PreferencesContext"; // Import usePreferences

interface NutritionTrendChartProps {
  selectedDate: string;
}

interface DayData {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  calorieGoal: number;
  proteinGoal: number;
  carbsGoal: number;
  fatGoal: number;
}

const NutritionTrendChart = ({ selectedDate }: NutritionTrendChartProps) => {
  const { user } = useAuth();
  const { activeUserId } = useActiveUser();
  const [chartData, setChartData] = useState<DayData[]>([]);
  const [loading, setLoading] = useState(true);
  const { formatDateInUserTimezone } = usePreferences(); // Destructure formatDateInUserTimezone

  useEffect(() => {
    if (user && activeUserId) {
      loadTrendData();
    }
  }, [user, activeUserId, selectedDate, formatDateInUserTimezone]); // Add formatDateInUserTimezone to dependencies

  const loadTrendData = async () => {
    try {
      setLoading(true);
      
      // Calculate date range (past 14 days from selected date) in user's timezone
      const endDate = parseISO(selectedDate); // Parse selectedDate as a calendar date
      const startDate = subDays(endDate, 13); // 14 days total including selected date

      const startDateStr = formatDateInUserTimezone(startDate, 'yyyy-MM-dd');
      const endDateStr = formatDateInUserTimezone(endDate, 'yyyy-MM-dd');

      // Get food entries for the past 14 days - use activeUserId
      const { data: entriesData, error: entriesError } = await supabase
        .from('food_entries')
        .select(`
          entry_date,
          quantity,
          unit,
          variant_id,
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
        .eq('user_id', activeUserId)
        .gte('entry_date', startDateStr)
        .lte('entry_date', endDateStr)
        .order('entry_date', { ascending: true });

      if (entriesError) {
        console.error('Error loading nutrition trend data:', entriesError);
        return;
      }
      console.log("DEBUG: NutritionTrendChart - Fetched entriesData:", entriesData); // New debug log

      // Group entries by date and calculate totals
      const dailyTotals: Record<string, { calories: number; protein: number; carbs: number; fat: number }> = {};
      
      entriesData?.forEach(entry => {
        const date = entry.entry_date;
        if (!dailyTotals[date]) {
          dailyTotals[date] = { calories: 0, protein: 0, carbs: 0, fat: 0 };
        }

        // Use variant nutrition if available, otherwise use base food nutrition
        const nutritionSource = entry.variant_id && entry.food_variants ? entry.food_variants : entry.foods;
        if (!nutritionSource) return;

        const multiplier = entry.quantity / (nutritionSource.serving_size || 100); // Corrected calculation
        
        dailyTotals[date].calories += (nutritionSource.calories || 0) * multiplier;
        dailyTotals[date].protein += (nutritionSource.protein || 0) * multiplier;
        dailyTotals[date].carbs += (nutritionSource.carbs || 0) * multiplier;
        dailyTotals[date].fat += (nutritionSource.fat || 0) * multiplier;
      });
      console.log("DEBUG: NutritionTrendChart - Aggregated dailyTotals:", dailyTotals); // New debug log

      // Get goals for each day in the range - use activeUserId
      const chartDataPromises = [];
      // Iterate through the date range using the user's timezone
      for (let i = 0; i < 14; i++) { // Iterate 14 times for 14 days
        const currentDateForLoop = addDays(startDate, i); // Get the current date in the loop
        const dateStr = formatDateInUserTimezone(currentDateForLoop, 'yyyy-MM-dd'); // Format date in user's timezone
        chartDataPromises.push(
          supabase.rpc('get_goals_for_date', {
            p_user_id: activeUserId,
            p_date: dateStr // Pass date in user's timezone
          }).then(({ data: goalsData }) => {
            const goals = goalsData?.[0] || { calories: 2000, protein: 150, carbs: 250, fat: 67 };
            const totals = dailyTotals[dateStr] || { calories: 0, protein: 0, carbs: 0, fat: 0 };
            
            return {
              date: dateStr,
              calories: Math.round(totals.calories),
              protein: Math.round(totals.protein * 10) / 10,
              carbs: Math.round(totals.carbs * 10) / 10,
              fat: Math.round(totals.fat * 10) / 10,
              calorieGoal: goals.calories || 2000,
              proteinGoal: goals.protein || 150,
              carbsGoal: goals.carbs || 250,
              fatGoal: goals.fat || 67
            };
          })
        );
      }

      const resolvedChartData = await Promise.all(chartDataPromises);
      console.log("DEBUG: NutritionTrendChart - Resolved chartData before setting state:", resolvedChartData); // New debug log
      setChartData(resolvedChartData);
    } catch (error) {
      console.error('Error loading trend data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDateForChart = (dateStr: string) => {
    // Use formatDateInUserTimezone to ensure the date is formatted according to user's preference
    // This is for display on the chart axis
    return formatDateInUserTimezone(parseISO(dateStr), 'MMM dd');
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-500" />
            <span>14-Day Nutrition Trends</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-gray-500">
            Loading trend data...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-500" />
          <span>14-Day Nutrition Trends</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="h-[500px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="date"
                tickFormatter={formatDateForChart}
                stroke="#6b7280"
                fontSize={12}
              />
              <YAxis stroke="#6b7280" fontSize={12} domain={[0, 'dataMax + (dataMax * 0.1)']} />
              <Tooltip
                labelFormatter={(value) => formatDateForChart(value as string)}
                formatter={(value: number, name: string) => {
                  const unit = name.includes('calorie') ? ' cal' : 'g';
                  return [`${value}${unit}`, name];
                }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="calories" 
                stroke="#22c55e" 
                strokeWidth={2}
                name="Calories"
                dot={{ fill: '#22c55e', strokeWidth: 2, r: 3 }}
              />
              <Line 
                type="monotone" 
                dataKey="protein" 
                stroke="#3b82f6" 
                strokeWidth={2}
                name="Protein"
                dot={{ fill: '#3b82f6', strokeWidth: 2, r: 3 }}
              />
              <Line 
                type="monotone" 
                dataKey="carbs" 
                stroke="#f97316" 
                strokeWidth={2}
                name="Carbs"
                dot={{ fill: '#f97316', strokeWidth: 2, r: 3 }}
              />
              <Line 
                type="monotone" 
                dataKey="fat" 
                stroke="#eab308" 
                strokeWidth={2}
                name="Fat"
                dot={{ fill: '#eab308', strokeWidth: 2, r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default NutritionTrendChart;
