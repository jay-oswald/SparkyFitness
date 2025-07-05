import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useActiveUser } from "@/contexts/ActiveUserContext";
import { TrendingUp } from "lucide-react";
import { parseISO, subDays, addDays, format } from "date-fns"; // Import parseISO, subDays, addDays, format
import { usePreferences } from "@/contexts/PreferencesContext"; // Import usePreferences
import { loadNutritionTrendData, DayData } from '@/services/nutritionTrendService';

interface NutritionTrendChartProps {
  selectedDate: string;
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

      const fetchedChartData = await loadNutritionTrendData(
        activeUserId,
        startDateStr,
        endDateStr
      );
      console.log("DEBUG: NutritionTrendChart - Fetched chartData:", fetchedChartData);
      setChartData(fetchedChartData);

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
