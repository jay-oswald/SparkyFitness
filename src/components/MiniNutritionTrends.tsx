
import { useState, useEffect } from "react";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveUser } from "@/contexts/ActiveUserContext";

interface MiniNutritionTrendsProps {
  selectedDate: string;
}

interface DayData {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

const MiniNutritionTrends = ({ selectedDate }: MiniNutritionTrendsProps) => {
  const { user } = useAuth();
  const { activeUserId } = useActiveUser();
  const [chartData, setChartData] = useState<DayData[]>([]);

  useEffect(() => {
    if (user && activeUserId) {
      loadTrendData();
    }
  }, [user, activeUserId, selectedDate]);

  const loadTrendData = async () => {
    try {
      // Calculate date range (past 14 days from selected date for mini charts)
      const endDate = new Date(selectedDate);
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - 13); // 14 days total including selected date
      
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

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
        console.error('Error loading mini trend data:', entriesError);
        return;
      }

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

        const multiplier = entry.quantity;
        
        dailyTotals[date].calories += (nutritionSource.calories || 0) * multiplier;
        dailyTotals[date].protein += (nutritionSource.protein || 0) * multiplier;
        dailyTotals[date].carbs += (nutritionSource.carbs || 0) * multiplier;
        dailyTotals[date].fat += (nutritionSource.fat || 0) * multiplier;
      });

      // Create chart data for all dates in range
      const chartDataArray: DayData[] = [];
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const totals = dailyTotals[dateStr] || { calories: 0, protein: 0, carbs: 0, fat: 0 };
        
        // Only include dates that have some nutrition data
        if (totals.calories > 0 || totals.protein > 0 || totals.carbs > 0 || totals.fat > 0) {
          chartDataArray.push({
            date: dateStr,
            calories: Math.round(totals.calories),
            protein: Math.round(totals.protein * 10) / 10,
            carbs: Math.round(totals.carbs * 10) / 10,
            fat: Math.round(totals.fat * 10) / 10,
          });
        }
      }

      setChartData(chartDataArray);
    } catch (error) {
      console.error('Error loading mini trend data:', error);
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const nutrientName = payload[0].dataKey;
      const nutrientValue = payload[0].value;
      const unit = nutrientName === 'calories' ? 'cal' : 'g';
      
      return (
        <div className="bg-white dark:bg-gray-800 p-2 border border-gray-200 dark:border-gray-700 rounded shadow-lg">
          <p className="text-xs font-medium text-gray-900 dark:text-gray-100">
            {new Date(label).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            {nutrientName}: {nutrientValue}{unit}
          </p>
        </div>
      );
    }
    return null;
  };

  if (chartData.length === 0) {
    return (
      <div className="mt-4 p-3 text-center text-sm text-gray-500 bg-gray-50 dark:bg-gray-800 rounded-lg">
        No trend data available for the past 14 days
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        14-Day Nutrition Trends
      </div>
      
      {/* Calories Trend */}
      <div className="space-y-1">
        <div className="flex justify-between items-center">
          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Calories</span>
          <span className="text-xs text-green-600 font-medium">
            {chartData[chartData.length - 1]?.calories || 0} cal
          </span>
        </div>
        <div className="h-6 bg-gray-100 dark:bg-gray-800 rounded">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis dataKey="date" hide />
              <YAxis hide />
              <Tooltip content={<CustomTooltip />} />
              <Line 
                type="monotone" 
                dataKey="calories" 
                stroke="#22c55e" 
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      {/* Protein Trend */}
      <div className="space-y-1">
        <div className="flex justify-between items-center">
          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Protein</span>
          <span className="text-xs text-blue-600 font-medium">
            {chartData[chartData.length - 1]?.protein || 0}g
          </span>
        </div>
        <div className="h-6 bg-gray-100 dark:bg-gray-800 rounded">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis dataKey="date" hide />
              <YAxis hide />
              <Tooltip content={<CustomTooltip />} />
              <Line 
                type="monotone" 
                dataKey="protein" 
                stroke="#3b82f6" 
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      {/* Carbs Trend */}
      <div className="space-y-1">
        <div className="flex justify-between items-center">
          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Carbs</span>
          <span className="text-xs text-orange-600 font-medium">
            {chartData[chartData.length - 1]?.carbs || 0}g
          </span>
        </div>
        <div className="h-6 bg-gray-100 dark:bg-gray-800 rounded">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis dataKey="date" hide />
              <YAxis hide />
              <Tooltip content={<CustomTooltip />} />
              <Line 
                type="monotone" 
                dataKey="carbs" 
                stroke="#f97316" 
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      {/* Fat Trend */}
      <div className="space-y-1">
        <div className="flex justify-between items-center">
          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Fat</span>
          <span className="text-xs text-yellow-600 font-medium">
            {chartData[chartData.length - 1]?.fat || 0}g
          </span>
        </div>
        <div className="h-6 bg-gray-100 dark:bg-gray-800 rounded">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis dataKey="date" hide />
              <YAxis hide />
              <Tooltip content={<CustomTooltip />} />
              <Line 
                type="monotone" 
                dataKey="fat" 
                stroke="#eab308" 
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default MiniNutritionTrends;
