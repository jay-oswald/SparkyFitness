
import { useState, useEffect } from "react";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAuth } from "@/hooks/useAuth";
import { useActiveUser } from "@/contexts/ActiveUserContext";
import { parseISO, subDays, addDays, format } from "date-fns"; // Import date-fns functions
import { usePreferences } from "@/contexts/PreferencesContext"; // Import usePreferences
import { calculateFoodEntryNutrition } from '@/utils/nutritionCalculations'; // Import the new utility function
import { loadMiniNutritionTrendData, DayData } from '@/services/miniNutritionTrendsService';
import { formatNutrientValue } from '@/lib/utils'; // Import formatNutrientValue


interface MiniNutritionTrendsProps {
  selectedDate: string;
  refreshTrigger?: number; // Add refreshTrigger to props
}


const MiniNutritionTrends = ({ selectedDate, refreshTrigger }: MiniNutritionTrendsProps) => {
  const { user } = useAuth();
  const { activeUserId } = useActiveUser();
  const [chartData, setChartData] = useState<DayData[]>([]);
  const { formatDateInUserTimezone } = usePreferences(); // Destructure formatDateInUserTimezone

  useEffect(() => {
    if (user && activeUserId) {
      loadTrendData();
    }
  }, [user, activeUserId, selectedDate, formatDateInUserTimezone, refreshTrigger]); // Add refreshTrigger to dependencies

  const loadTrendData = async () => {
    try {
      // Calculate date range (past 14 days from selected date for mini charts) in user's timezone
      const endDate = parseISO(selectedDate); // Parse selectedDate as a calendar date
      const startDate = subDays(endDate, 13); // 14 days total including selected date
      
      const startDateStr = formatDateInUserTimezone(startDate, 'yyyy-MM-dd');
      const endDateStr = formatDateInUserTimezone(endDate, 'yyyy-MM-dd');

      // Get food entries for the past 14 days - use activeUserId
      const fetchedChartData = await loadMiniNutritionTrendData(
        activeUserId,
        startDateStr,
        endDateStr
      );
      setChartData(fetchedChartData);

    } catch (error) {
      console.error('Error loading mini trend data:', error);
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const nutrientName = payload[0].dataKey;
      const nutrientValue = payload[0].value;
      
      return (
        <div className="bg-white dark:bg-gray-800 p-2 border border-gray-200 dark:border-gray-700 rounded shadow-lg">
          <p className="text-xs font-medium text-gray-900 dark:text-gray-100">
            {formatDateInUserTimezone(parseISO(label), 'MMM dd')}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            {nutrientName === 'dietary_fiber' ? 'Fiber' : nutrientName}: {formatNutrientValue(nutrientValue, nutrientName)}
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
            {formatNutrientValue(chartData[chartData.length - 1]?.calories || 0, 'calories')}
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
            {formatNutrientValue(chartData[chartData.length - 1]?.protein || 0, 'protein')}
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
            {formatNutrientValue(chartData[chartData.length - 1]?.carbs || 0, 'carbs')}
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
            {formatNutrientValue(chartData[chartData.length - 1]?.fat || 0, 'fat')}
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

      {/* Fiber Trend */}
      <div className="space-y-1">
        <div className="flex justify-between items-center">
          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Fiber</span>
          <span className="text-xs text-green-600 font-medium">
            {formatNutrientValue(chartData[chartData.length - 1]?.dietary_fiber || 0, 'dietary_fiber')}
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
                dataKey="dietary_fiber"
                stroke="#22c55e"
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
